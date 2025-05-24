# Project Changelog

## [Unreleased] - YYYY-MM-DD

### Added
- Initial project setup with FastAPI backend and JavaScript frontend.
- WebSocket communication for real-time interaction.
- "Jarvis-like" animated sphere UI.
- Audio streaming from client to server (ADK agent).
- Audio playback of agent responses.
- Session management (start/stop via UI button).
- Basic text input functionality.
- Server-side interruption handling (`{"interrupted": true}`).
- Client-side handling of interruption message to stop audio player.
- Dark theme for UI.
- 3D particle sphere animation reacting to agent speech.
- Server-initiated session termination via WebSocket close.
- "Stop Session" button functionality.
- Improved wake word reliability (later removed).
- Direct session start on "Start Session" button click (wake word removed).
- Asynchronous operations and delays in `app.js` to resolve `WebSocketDisconnect`.
- DOM access moved to `window.addEventListener('load', ...)` to fix UI initialization issues.
- `await` added to `session_service.create_session()` in `main.py`.
- Text input enabled on WebSocket open.
- Enhanced logging in `main.py` for ADK event tracing.
- Browser interaction tools (browse, find elements, click, type, scroll, close) using Selenium.
- Screenshot mechanism: tools save `action_screenshot.jpeg`, `main.py` sends it as a separate message.
- `requirements.txt` created and populated.
- `BuiltInCodeExecutor` added to the agent.
- Client-side audio input buffering in `pcm-recorder-processor.js` to improve audio smoothness.
- `.gitignore` file added.
- Project documentation files created: `feature-design.md`, `current-state.md`, `changelog.md`, `memory.md`.

### Changed
- Modified `static/js/app.js` to handle `{"interrupted": true}` from the server.
- Refactored `static/js/app.js` to remove wake word logic and simplify state management.
- Browser tools in `tools/browser_tool.py` changed to return simple strings, with screenshots handled by `main.py`.
- Updated agent instructions in `google_search_agent/agent.py` for new screenshot mechanism.
- Corrected `BuiltInCodeExecutor` instantiation in `google_search_agent/agent.py`.
- Fixed `TypeError` for `code_execution_result` logging in `main.py` by accessing `part.code_execution_result.output`.
- Buffered audio in `pcm-recorder-processor.js` to send larger, less frequent packets.
- `terminateSession` in `app.js` now sends a 'stop' command to the audio recorder worklet to flush buffers.

### Fixed
- Audio interruption not stopping agent speech reliably.
- UI stuck on "Initializing..." due to DOM access timing and old event listeners.
- Server-side `WebSocketDisconnect (1001, '')` error.
- Server-side ADK `ValidationError` for `session_service.create_session()`.
- Text input not being enabled.
- `pydantic_core.ValidationError` for `BuiltInCodeExecutor`.
- `TypeError: 'CodeExecutionResult' object is not subscriptable` in `main.py`.
- Non-smooth audio streaming by implementing client-side buffering.

### Removed
- Wake word detection ("Hey Friday") due to reliability issues.
- Old `startAudioButton` event listener. 