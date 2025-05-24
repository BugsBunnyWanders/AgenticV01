# Project Memory: Learnings and Resolutions

This document records key learnings and resolutions from issues encountered during the development of the FRIDAY - Interface project.

## Learnings & Fixes

1.  **Audio Interruption (`static/js/app.js`, `main.py`):**
    *   **Issue:** Agent audio did not stop when user interrupted.
    *   **Fix:** Implemented server-side sending of `{"interrupted": true}` message from `main.py` when ADK signals an interruption. Client-side `app.js` handles this message by stopping and re-initializing the `AudioPlayerWorklet`.
    *   **Learning:** Clear signaling between server and client is crucial for responsive interruption handling.

2.  **Wake Word Reliability & Removal (`static/js/app.js`):
    *   **Issue:** Web Speech API for "Hey Friday" was unreliable.
    *   **Fix:** Set `speechRecognition.interimResults = true;` and refined `onresult`/`onend` handlers. Later, the feature was removed entirely in favor of a button click to start the session due to persistent unreliability.
    *   **Learning:** Client-side wake word detection can be challenging; direct user-initiated actions (button clicks) are more robust for session control in this context.

3.  **Server-Side `WebSocketDisconnect (1001, '')` (`static/js/app.js`):
    *   **Issue:** Server unexpectedly closing WebSocket connection shortly after client connection.
    *   **Fix:** Made `activateSession` and `startAudio` async in `app.js`. Added slight delays to ensure microphone resources were released/acquired properly. Ensured WebSocket connection only happens after successful audio setup.
    *   **Learning:** Asynchronous operations involving hardware (microphone) and network connections require careful sequencing and handling of potential race conditions.

4.  **UI Stuck on "Initializing..." (`static/js/app.js`):
    *   **Issue:** JavaScript trying to access DOM elements before they were loaded, or an old event listener for a renamed button.
    *   **Fix:** Moved DOM element access and event listener assignments into `window.addEventListener('load', ...)` block. Removed obsolete event listener.
    *   **Learning:** Always ensure DOM is fully loaded before manipulating its elements. Regularly review and remove dead code/listeners.

5.  **ADK `ValidationError` in `main.py` (`session_service.create_session`):
    *   **Issue:** `session_service.create_session()` was not `await`ed.
    *   **Fix:** Added `await` before the call.
    *   **Learning:** Pay close attention to `async/await` usage with asynchronous libraries like ADK.

6.  **Browser Tool Output & Screenshots (`tools/browser_tool.py`, `main.py`):
    *   **Issue:** Returning complex `Content` objects with inline screenshot data from tools caused `ModuleNotFoundError` and ADK `ValueError`.
    *   **Fix:** Refactored browser tools to return simple string status messages. Screenshots are saved to a fixed filename (`action_screenshot.jpeg`). `main.py` checks for this file after a tool call that should produce one, reads it, and sends it as a separate `image/jpeg` WebSocket message.
    *   **Learning:** Simplify data types returned by tools for better compatibility with ADK and easier handling. Decouple primary tool output from secondary artifacts like screenshots.

7.  **`WebDriverWait` timeout / `aiohttp` `extra_headers` error (`tools/browser_tool.py`, `requirements.txt`):
    *   **Issue:** `BaseEventLoop.create_connection() got an unexpected keyword argument 'extra_headers'` when browser tools tried navigation.
    *   **Fix:** Suspected `aiohttp` version conflict or interaction issue. Ensured `ChromeDriverManager().install()` was used. Added `aiohttp` to `requirements.txt` and reinstalled packages.
    *   **Learning:** Dependency conflicts can manifest in unexpected ways. Explicitly managing dependencies and ensuring compatible versions is important.

8.  **`BuiltInCodeExecutor` Issues (`google_search_agent/agent.py`, `main.py`):
    *   **Issue 1:** `pydantic_core.ValidationError` because the class was passed in a list instead of an instance.
    *   **Fix 1:** Changed `code_executor=[BuiltInCodeExecutor]` to `code_executor=BuiltInCodeExecutor()`.
    *   **Issue 2:** `TypeError: 'CodeExecutionResult' object is not subscriptable` when logging.
    *   **Fix 2:** Accessed `part.code_execution_result.output` for logging.
    *   **Learning:** Carefully check API documentation for how to instantiate and use components. Understand the structure of result objects.

9.  **Audio Streaming Smoothness (`static/js/pcm-recorder-processor.js`, `static/js/app.js`):
    *   **Issue:** Voice communication (user-to-agent) was not smooth; very frequent, small audio packets were being sent.
    *   **Fix:** Implemented audio buffering in the `PCMProcessor` (AudioWorklet). The worklet now accumulates ~80ms of audio data before `postMessage`-ing it to the main thread, which then sends it via WebSocket. Added a `'stop'` command to the worklet to flush remaining audio when the session terminates.
    *   **Learning:** For real-time audio streaming, sending slightly larger, less frequent packets is generally more efficient and can lead to smoother perceived audio than very small, high-frequency packets due to reduced overhead and jitter sensitivity.

10. **Git Push Branch Mismatch (`Terminal`):
    *   **Issue:** Attempted to push to `main` branch on GitHub, but local repository initialized with `master` as default.
    *   **Fix:** Changed push command to target `master` branch (`git push -u origin master`).
    *   **Learning:** Be aware of default branch names (often `main` now, but can be `master`) and ensure consistency between local and remote repositories or adjust commands accordingly. 