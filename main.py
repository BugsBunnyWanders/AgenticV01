# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import json
import asyncio
import base64

from pathlib import Path
from dotenv import load_dotenv

from google.genai.types import (
    # Part, # No longer directly used here for tool outputs
    Content, # Still used for sending to agent
    Blob,
    Part, # Still needed for sending text to agent
)

from google.adk.runners import Runner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types
from google.adk.events import Event # For type hinting if needed, and checking event types


from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from google_search_agent.agent import root_agent
from tools.browser_tool import SCREENSHOT_ACTION_FILENAME # Import the screenshot filename

#
# ADK Streaming
#

# Load Gemini API Key
load_dotenv()

# print the GOOGLE_API_KEY
print(os.getenv("GOOGLE_API_KEY"))


APP_NAME = "ADK Streaming example"
session_service = InMemorySessionService()


# This function seems to be unused now that session creation is in the endpoint.
# def start_agent_session(session_id, is_audio=False):
#     """Starts an agent session"""
#     pass 


async def agent_to_client_messaging(websocket, live_events):
    """Agent to client communication, handles multi-part messages and screenshot sending."""
    while True:
        async for event in live_events:
            # Enhanced logging for ADK event stream
            event_type_str = type(event).__name__
            is_interrupted = getattr(event, 'interrupted', None)
            is_turn_complete = getattr(event, 'turn_complete', None)
            has_content = event.content is not None
            num_parts = len(event.content.parts) if has_content and event.content.parts else 0
            print(f"[ADK_EVENT_TRACE] Type: {event_type_str}, Interrupted: {is_interrupted}, TurnComplete: {is_turn_complete}, HasContent: {has_content}, NumParts: {num_parts}")

            if has_content and num_parts > 0:
                for i, part_detail in enumerate(event.content.parts):
                    part_info = []
                    if part_detail.text:
                        part_info.append(f"text_len={len(part_detail.text)}")
                    if part_detail.inline_data:
                        part_info.append(f"inline_data_mime={part_detail.inline_data.mime_type}, data_len={len(part_detail.inline_data.data) if part_detail.inline_data.data else 0}")
                    if part_detail.function_call:
                        part_info.append(f"fn_call={part_detail.function_call.name}")
                    if part_detail.function_response:
                        part_info.append(f"fn_resp={part_detail.function_response.name}")
                    if part_detail.code_execution_result:
                        part_info.append(f"code_exec_outcome={part_detail.code_execution_result.outcome}")
                    print(f"  [ADK_EVENT_PART_DETAIL] Part {i}: {', '.join(part_info)}")

            # If the turn complete or interrupted, send it
            if event.turn_complete or event.interrupted:
                message = {
                    "turn_complete": event.turn_complete,
                    "interrupted": event.interrupted,
                }
                print(f"[AGENT TO CLIENT SENDING]: Turn status: {message}")
                await websocket.send_text(json.dumps(message))
                print(f"[AGENT TO CLIENT SENT]: Turn status: {message}")
                continue

            # Process all parts in the event content (only if not turn_complete/interrupted)
            if event.content and event.content.parts:
                is_tool_response_text = False # Flag to check if we just sent a tool's text output
                tool_name_if_any = None

                if event.content.role == "tool" and event.content.parts:
                    # Check if it's a function_call part (tool invocation by LLM) or function_response part (tool result)
                    # We are interested in the *result* of a tool call, which will not have a function_call attribute here,
                    # but the role itself indicates it's a tool's output part.
                    # The actual tool name for screenshot logic is better derived when processing the part itself.
                    pass # Placeholder for tool name logic if needed broadly

                for part in event.content.parts:
                    if not part:
                        continue

                    message_to_send = None
                    log_message = ""

                    if part.inline_data and part.inline_data.mime_type.startswith("audio/pcm"):
                        audio_data = part.inline_data.data
                        if audio_data:
                            message_to_send = {
                            "mime_type": "audio/pcm",
                            "data": base64.b64encode(audio_data).decode("ascii")
                            }
                            log_message = f"audio/pcm: {len(audio_data)} bytes."
                    # REMOVED: Direct image handling from part.inline_data for tool responses
                    # elif part.inline_data and part.inline_data.mime_type.startswith("image/jpeg"):
                    # ...
                    elif part.text:
                        message_to_send = {
                            "mime_type": "text/plain",
                            "data": part.text,
                            "partial": event.partial 
                        }
                        log_message = f"text/plain (partial: {event.partial}, role: {event.content.role}): {part.text[:100]}..."
                        if event.content.role == "tool":
                            is_tool_response_text = True
                            # Try to get tool name from the function_response if available, or function_call if it's part of an invocation echo
                            if part.function_response and part.function_response.name:
                                tool_name_if_any = part.function_response.name
                                print(f"[TOOL_DEBUG]: Detected tool name from function_response: {tool_name_if_any}")
                            elif part.function_call and part.function_call.name:
                                tool_name_if_any = part.function_call.name # This might be the case if the LLM is just saying it will call a tool
                                print(f"[TOOL_DEBUG]: Detected tool name from function_call: {tool_name_if_any}")
                            else:
                                tool_name_if_any = "unknown_tool_from_text_part" # Fallback
                                print(f"[TOOL_DEBUG]: No tool name detected, using fallback: {tool_name_if_any}")
                                print(f"[TOOL_DEBUG]: Part details - function_response: {part.function_response}, function_call: {part.function_call}")
                    elif part.code_execution_result:
                        # Ensure output is treated as a string
                        output_str = str(part.code_execution_result.output if part.code_execution_result.output is not None else "")
                        print(
                            f"  Debug: Code Execution Result: {part.code_execution_result.outcome} - Output:\n{output_str}"
                        )
                        message_to_send = {
                            "mime_type": "text/plain", # Assuming code execution output is text for the client
                            "data": output_str, # Send the actual output string
                            "partial": event.partial # This might always be False for code execution results
                        }
                        log_message = f"text/plain (code_exec, partial: {event.partial}, role: {event.content.role}): {output_str[:100]}..."
                        # Code execution itself doesn't produce screenshots in our current setup
                        # So, is_tool_response_text remains false here, and tool_name_if_any is not set for screenshot logic based on this part.
                    
                    if message_to_send:
                        await websocket.send_text(json.dumps(message_to_send))
                        print(f"[AGENT TO CLIENT]: {log_message}")
                    else:
                        print(f"[AGENT TO CLIENT]: Skipping empty or unhandled part: {part}")
                
                # After processing all parts, if a tool response text was sent, check for screenshot or generated images
                # Only check for screenshots if the tool is one that's expected to produce one.
                browser_tools_that_screenshot = ["browse_url", "click_element_by_id", "type_into_element_by_id", "scroll_page_at_url"]
                image_generation_tools = ["create_image"]

                if is_tool_response_text and tool_name_if_any in browser_tools_that_screenshot:
                    print(f"[AGENT TO CLIENT]: Tool '{tool_name_if_any}' text response sent, checking for screenshot: {SCREENSHOT_ACTION_FILENAME}")
                    if os.path.exists(SCREENSHOT_ACTION_FILENAME):
                        try:
                            with open(SCREENSHOT_ACTION_FILENAME, "rb") as f_img:
                                image_data = f_img.read()
                            
                            screenshot_message = {
                                "mime_type": "image/jpeg",
                                "data": base64.b64encode(image_data).decode("utf-8")
                            }
                            await websocket.send_text(json.dumps(screenshot_message))
                            print(f"[AGENT TO CLIENT]: Sent screenshot {SCREENSHOT_ACTION_FILENAME} ({len(image_data)} bytes).")
                        except Exception as e_screenshot:
                            print(f"[AGENT TO CLIENT ERROR]: Failed to read/send screenshot {SCREENSHOT_ACTION_FILENAME}: {e_screenshot}")
                    else:
                        print(f"[AGENT TO CLIENT]: Screenshot file {SCREENSHOT_ACTION_FILENAME} not found after tool {tool_name_if_any} execution.")
                
                # Check for generated images after image generation tools
                elif is_tool_response_text and tool_name_if_any in image_generation_tools:
                    print(f"[AGENT TO CLIENT]: Tool '{tool_name_if_any}' text response sent, checking for generated images in assets/images/")
                    try:
                        # Get the most recently modified image file in assets/images
                        images_dir = Path("assets/images")
                        print(f"[IMAGE_DEBUG]: Checking images directory: {images_dir.absolute()}, exists: {images_dir.exists()}")
                        if images_dir.exists():
                            all_files = list(images_dir.iterdir())
                            print(f"[IMAGE_DEBUG]: All files in directory: {[f.name for f in all_files]}")
                            image_files = [f for f in all_files if f.is_file() and f.suffix.lower() in ['.png', '.jpg', '.jpeg']]
                            print(f"[IMAGE_DEBUG]: Image files found: {[f.name for f in image_files]}")
                            if image_files:
                                # Get the most recently modified image
                                latest_image = max(image_files, key=lambda f: f.stat().st_mtime)
                                print(f"[AGENT TO CLIENT]: Found latest generated image: {latest_image}")
                                
                                # Send the image to the client
                                with open(latest_image, "rb") as f_img:
                                    image_data = f_img.read()
                                
                                image_message = {
                                    "mime_type": "image/generated",
                                    "data": base64.b64encode(image_data).decode("utf-8"),
                                    "filename": latest_image.name
                                }
                                await websocket.send_text(json.dumps(image_message))
                                print(f"[AGENT TO CLIENT]: Sent generated image {latest_image.name} ({len(image_data)} bytes).")
                            else:
                                print(f"[AGENT TO CLIENT]: No image files found in assets/images after image generation.")
                        else:
                            print(f"[AGENT TO CLIENT]: assets/images directory not found.")
                    except Exception as e_image:
                        print(f"[AGENT TO CLIENT ERROR]: Failed to read/send generated image: {e_image}")
                
                # Also check for any tool response that might be from image generation (fallback detection)
                elif is_tool_response_text and (not tool_name_if_any or tool_name_if_any == "unknown_tool_from_text_part"):
                    print(f"[AGENT TO CLIENT]: Tool response with unknown/missing name detected, checking for generated images as fallback")
                    # Check if the text contains image generation keywords
                    if any(part.text and ("image" in part.text.lower() or "generated" in part.text.lower() or "created" in part.text.lower()) for part in event.content.parts if part.text):
                        try:
                            images_dir = Path("assets/images")
                            print(f"[IMAGE_DEBUG_FALLBACK]: Checking images directory: {images_dir.absolute()}, exists: {images_dir.exists()}")
                            if images_dir.exists():
                                all_files = list(images_dir.iterdir())
                                print(f"[IMAGE_DEBUG_FALLBACK]: All files in directory: {[f.name for f in all_files]}")
                                image_files = [f for f in all_files if f.is_file() and f.suffix.lower() in ['.png', '.jpg', '.jpeg']]
                                print(f"[IMAGE_DEBUG_FALLBACK]: Image files found: {[f.name for f in image_files]}")
                                if image_files:
                                    # Get the most recently modified image (within last 10 seconds to avoid old images)
                                    import time
                                    current_time = time.time()
                                    recent_images = [f for f in image_files if current_time - f.stat().st_mtime < 10]
                                    if recent_images:
                                        latest_image = max(recent_images, key=lambda f: f.stat().st_mtime)
                                        print(f"[AGENT TO CLIENT]: Found recent generated image via fallback: {latest_image}")
                                        
                                        # Send the image to the client
                                        with open(latest_image, "rb") as f_img:
                                            image_data = f_img.read()
                                        
                                        image_message = {
                                            "mime_type": "image/generated",
                                            "data": base64.b64encode(image_data).decode("utf-8"),
                                            "filename": latest_image.name
                                        }
                                        await websocket.send_text(json.dumps(image_message))
                                        print(f"[AGENT TO CLIENT]: Sent generated image via fallback {latest_image.name} ({len(image_data)} bytes).")
                        except Exception as e_image:
                            print(f"[AGENT TO CLIENT ERROR]: Failed to read/send generated image via fallback: {e_image}")

            elif event.content: 
                 print(f"[AGENT TO CLIENT]: Event has content but no parts: {event.content}")


async def client_to_agent_messaging(websocket, live_request_queue):
    """Client to agent communication"""
    while True:
        # Decode JSON message
        message_json = await websocket.receive_text()
        message = json.loads(message_json)
        mime_type = message["mime_type"]
        data = message["data"]

        # Send the message to the agent
        if mime_type == "text/plain":
            # Send a text message
            content = Content(role="user", parts=[Part.from_text(text=data)]) # Use imported Part
            live_request_queue.send_content(content=content)
            print(f"[CLIENT TO AGENT]: text/plain: {data}")
        elif mime_type == "audio/pcm":
            # Send an audio data
            decoded_data = base64.b64decode(data)
            live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type)) # Use imported Blob
            print(f"[CLIENT TO AGENT]: audio/pcm: {len(decoded_data)} bytes.")
        else:
            print(f"[CLIENT TO AGENT ERROR]: Mime type not supported: {mime_type}")
            raise ValueError(f"Mime type not supported: {mime_type}")


#
# FastAPI web app
#

app = FastAPI()

# Serve React build files
REACT_BUILD_DIR = Path("frontend/build")
if REACT_BUILD_DIR.exists():
    # Serve static assets (JS, CSS, etc.)
    app.mount("/static", StaticFiles(directory=REACT_BUILD_DIR / "static"), name="static")
    
    @app.get("/")
    async def root():
        """Serves the React index.html"""
        return FileResponse(REACT_BUILD_DIR / "index.html")
    
    # Serve audio worklet files directly from build directory
    @app.get("/pcm-player-processor.js")
    async def pcm_player_processor():
        """Serves the PCM player processor worklet"""
        return FileResponse(REACT_BUILD_DIR / "pcm-player-processor.js", media_type="application/javascript")
    
    @app.get("/pcm-recorder-processor.js")
    async def pcm_recorder_processor():
        """Serves the PCM recorder processor worklet"""
        return FileResponse(REACT_BUILD_DIR / "pcm-recorder-processor.js", media_type="application/javascript")
    
    # Serve images from assets/images directory
    @app.get("/api/images/{image_name}")
    async def serve_image(image_name: str):
        """Serves images from assets/images directory"""
        image_path = Path("assets/images") / image_name
        if image_path.exists() and image_path.is_file():
            return FileResponse(image_path)
        else:
            return {"error": "Image not found"}
    
    # Catch-all route for React Router (SPA routing)
    @app.get("/{path:path}")
    async def catch_all(path: str):
        """Catch-all route for React Router"""
        # Check if it's an API route or WebSocket
        if path.startswith("ws/") or path.startswith("api/"):
            return {"error": "Not found"}
        # Don't serve index.html for .js files
        if path.endswith(".js"):
            return {"error": "Not found"}
        return FileResponse(REACT_BUILD_DIR / "index.html")
else:
    # Fallback to old static directory if React build doesn't exist
    STATIC_DIR = Path("static")
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    """Serves the static index.html"""
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, is_audio: str):
    """Client websocket endpoint"""
    await websocket.accept()
    print(f"Client #{session_id} connected, audio mode: {is_audio}")

    try:
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=session_id, 
            session_id=session_id, 
        )
        print(f"ADK Session created for {session_id}: {session}")

        runner = Runner(
            app_name=APP_NAME,
            agent=root_agent,
            session_service=session_service,
        )

        modality = "AUDIO" if is_audio == "true" else "TEXT"
        run_config = RunConfig(
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Kore" 
                    )
                ),
            ),
            response_modalities=[modality]
        )

        live_request_queue = LiveRequestQueue()
        live_events = runner.run_live(
            session=session,
            live_request_queue=live_request_queue,
            run_config=run_config,
        )

        agent_to_client_task = asyncio.create_task(
            agent_to_client_messaging(websocket, live_events)
        )
        client_to_agent_task = asyncio.create_task(
            client_to_agent_messaging(websocket, live_request_queue)
        )
        
        done, pending = await asyncio.wait(
            [agent_to_client_task, client_to_agent_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()
        for task in done: 
            if task.exception():
                raise task.exception()

    except Exception as e:
        print(f"[WEBSOCKET ERROR] for client #{session_id}: {e}")
        try:
            await websocket.close(code=1011, reason=f"Server error: {e}")
        except RuntimeError: 
            pass
    finally:
        print(f"Client #{session_id} disconnected")
        # Cleanup screenshot file on disconnect if it exists
        if os.path.exists(SCREENSHOT_ACTION_FILENAME):
            try:
                os.remove(SCREENSHOT_ACTION_FILENAME)
                print(f"[CLEANUP] Removed {SCREENSHOT_ACTION_FILENAME} on disconnect.")
            except Exception as e_remove:
                print(f"[CLEANUP ERROR] Failed to remove {SCREENSHOT_ACTION_FILENAME}: {e_remove}")
        # from tools.browser_tool import close_browser_session 
        # close_browser_session() # Consider session-specific browser cleanup if needed