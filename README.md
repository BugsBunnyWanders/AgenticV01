# FRIDAY - Interface

FRIDAY (Friendly Reactive Intelligent Digital Assistant, Your-way) is a voice-controlled web application with a "Jarvis-like" UI. It streams audio in real-time to a backend ADK (Agent Development Kit) agent powered by Google's Gemini model.

## Features

-   **Voice Control:** Interact with the agent using voice commands.
-   **Real-time Audio Streaming:** Low-latency audio streaming from client to server and server to client.
-   **"Jarvis-like" UI:** An animated sphere that reacts to the agent's speech, providing visual feedback. Includes a dark theme.
-   **Text Input:** Option to type messages to the agent.
-   **Session Management:** Start and stop sessions via UI controls.
-   **Agent Capabilities:**
    -   Google Search
    -   Web Page Content Loading (static)
    -   Interactive Web Browsing (navigate, find elements, click, type, scroll)
    -   Code Execution
    -   Visual feedback via screenshots for browser actions.
-   **Interruption Handling:** User can interrupt the agent while it's speaking.

## Project Structure

```
/d%3A/Projects/AgenticV01
├── .gitignore
├── docs/
│   └── temp/
│       ├── changelog.md
│       ├── current-state.md
│       ├── feature-design.md
│       └── memory.md
├── google_search_agent/
│   ├── __init__.py
│   └── agent.py             # ADK Agent definition, tools, instructions
├── main.py                  # FastAPI server, WebSocket handling, ADK runner
├── README.md                # This file
├── requirements.txt         # Python dependencies
├── static/
│   ├── index.html           # Main HTML page
│   ├── js/
│   │   ├── app.js                   # Core frontend logic, WebSocket, UI, audio handling
│   │   ├── audio-player.js          # AudioWorklet for playing audio
│   │   ├── audio-recorder.js        # AudioWorklet for recording audio
│   │   ├── pcm-player-processor.js  # AudioWorkletProcessor for playback
│   │   └── pcm-recorder-processor.js# AudioWorkletProcessor for recording (with buffering)
│   └── css/
│       └── style.css            # (Currently, styles are in index.html or minimal)
└── tools/
    ├── __init__.py
    ├── browser_tool.py        # Selenium-based browser interaction tools
    └── crawl_url.py           # Tool to fetch static page content
```

## Setup and Running

1.  **Clone the repository (if you haven't already):
    ```bash
    git clone https://github.com/BugsBunnyWanders/AgenticV01.git
    cd AgenticV01
    ```

2.  **Set up a Python virtual environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up your Google Gemini API Key:**
    Create a `.env` file in the project root and add your API key:
    ```
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```

5.  **Install WebDriver for Selenium (if not already handled by `webdriver-manager`):
    The `webdriver-manager` in `requirements.txt` should handle this. If you encounter issues, you might need to install ChromeDriver manually and ensure it's in your PATH.

6.  **Run the FastAPI server:**
    ```bash
    uvicorn main:app --reload
    ```

7.  **Open the application in your browser:**
    Navigate to `http://127.0.0.1:8000`

## Development Notes

-   **Audio Worklets:** The application uses `AudioWorklet`s for efficient audio processing off the main thread.
    -   `pcm-recorder-processor.js` buffers audio input to send ~80ms chunks for smoother streaming.
-   **WebSockets:** Real-time communication between the client and server is handled via WebSockets.
-   **ADK:** The Google Agent Development Kit is used for managing the agent lifecycle and tool integration.
-   **Selenium:** Used for interactive browser tools. Screenshots for browser actions are saved as `action_screenshot.jpeg` and sent to the client.

## Key Files

-   `main.py`: Backend server logic.
-   `google_search_agent/agent.py`: Agent definition and tool configuration.
-   `static/js/app.js`: Core frontend JavaScript logic.
-   `static/js/pcm-recorder-processor.js`: Client-side audio input buffering.
-   `tools/browser_tool.py`: Browser automation tools.

See `docs/temp/` for more detailed design notes, changelog, current state, and learnings. 