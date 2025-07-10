from google.adk.agents import Agent
from google.adk.tools import google_search, LongRunningFunctionTool
from google.adk.code_executors import BuiltInCodeExecutor
from tools.crawl_url import load_page
from tools.create_image import create_image
# Import Content and Part if they were to be used directly in agent logic, but tools return them.
# from google.genai.types import Content, Part 

long_running_tool = LongRunningFunctionTool(func=create_image)

image_agent = Agent(
    name="image_handling_agent",
    model="gemini-2.0-flash-live-001",
    description="You are an image handling agent that can create images based on text prompts using the Gemini image generation model. You can also edit images based on additional prompts. You will receive text prompts and image file names to create or edit images.",
    instruction="""
    You are an image handling agent that can create images based on text prompts using the Gemini image generation model.
    You can also edit images based on additional prompts. You will receive text prompts and image file names to create or edit images.

    You can use the following tools to help you:
    - long_running_tool: Generates an image based on a text prompt and saves it to the assets/images folder. It also edits existing images based on additional prompts.

    When calling the long_running_tool, give a nice and clear prompt for the image generation or editing task.
    When editing an image, provide the existing image file name and the additional prompt for editing.

    After all the image related tasks are complete, transfer back to the root agent.

    """,
    tools=[
        long_running_tool
        ]
)