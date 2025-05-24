/**
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

/**
 * app.js: JS code for the adk-streaming sample app.
 */

/**
 * WebSocket handling
 */

// Connect the server with a WebSocket connection
const sessionId = Math.random().toString().substring(10);
const ws_url =
  "ws://" + window.location.host + "/ws/" + sessionId;
let websocket = null;
let is_audio = false;

// Get DOM elements
// const messageForm = document.getElementById("messageForm"); // This might be null if not used with the new UI
let messageInput = document.getElementById("message");
let messagesDiv = document.getElementById("messages");
let sphereCanvas = document.getElementById('sphereCanvas');
let voiceControlButton = document.getElementById('voiceControlButton');
let statusDisplay = document.getElementById('status-display');
let currentMessageId = null;

// Sphere animation variables
let sphereCtx = null;

// --- New Particle Sphere Variables ---
let particles = [];
const numParticles = 1500; // Number of particles for the sphere
const particleSphereRadius = 100; // Base radius of the particle sphere in 3D space
let sphereRotationX = 0;
let sphereRotationY = 0;
const rotationSpeed = 0.002;

let baseParticleColor = 'rgba(97, 218, 251, 0.7)'; // Techy blue, slightly transparent
let speakingParticleColor = 'rgba(255, 140, 0, 0.9)'; // Bright orange, more opaque
let isAgentSpeaking = false;
let lastFrameTime = 0;
let sphereAnimationId = null;

// Wave animation properties
let waveAmplitude = 20; // Max displacement for wave
let waveFrequency = 2; // How many waves around the sphere
let waveSpeed = 0.05; // How fast the wave travels
let wavePhase = 0;
// --- End New Particle Sphere Variables ---

// Comment out or remove the immediate initialization block for sphereCanvas
/*
if (sphereCanvas) {
    sphereCtx = sphereCanvas.getContext('2d');
    sphereCanvas.width = sphereCanvas.offsetWidth;
    sphereCanvas.height = sphereCanvas.offsetHeight;
    initializeParticles();
} else {
    console.error("Sphere canvas not found at initial script parse!"); 
}
*/

function initializeParticles() {
    particles = [];
    if (!sphereCanvas || !sphereCtx) { // Add check for sphereCtx too
        console.error("Cannot initialize particles, canvas or context not ready.");
        return;
    }
    for (let i = 0; i < numParticles; i++) {
        // Distribute points on a sphere using Fibonacci lattice (approximates even distribution)
        const phi = Math.acos(-1 + (2 * i) / numParticles);
        const theta = Math.sqrt(numParticles * Math.PI) * phi;

        const x = particleSphereRadius * Math.cos(theta) * Math.sin(phi);
        const y = particleSphereRadius * Math.sin(theta) * Math.sin(phi);
        const z = particleSphereRadius * Math.cos(phi);

        particles.push({
            x: x, y: y, z: z, // Original 3D coordinates
            ox: x, oy: y, oz: z, // Store original to apply wave to base position
            color: baseParticleColor
        });
    }
}

function drawParticleSphere(timestamp) {
    if (!sphereCtx) return;

    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    sphereCtx.clearRect(0, 0, sphereCanvas.width, sphereCanvas.height);

    // Simple auto-rotation
    sphereRotationY += rotationSpeed;
    // sphereRotationX += rotationSpeed / 2; // Optional X rotation

    if (isAgentSpeaking) {
        wavePhase += waveSpeed;
    }

    const halfWidth = sphereCanvas.width / 2;
    const halfHeight = sphereCanvas.height / 2;

    // Sort particles by Z for pseudo-3D effect (draw farthest first)
    particles.sort((a, b) => a.z - b.z);

    particles.forEach(p => {
        let x = p.ox;
        let y = p.oy;
        let z = p.oz;
        let currentParticleColor = baseParticleColor;

        if (isAgentSpeaking) {
            currentParticleColor = speakingParticleColor;
            // Apply wavy animation: modulate radial distance
            const originalAngle = Math.atan2(p.oy, p.ox); // Angle in XY plane
            const distanceFromZAxis = Math.sqrt(p.ox * p.ox + p.oy * p.oy);
            
            // Modulate based on particle's original angle and height (z)
            // This creates a wave that seems to travel around and along the sphere
            const waveEffect = Math.sin(originalAngle * waveFrequency + p.oz * 0.1 + wavePhase) * waveAmplitude;
            const waveFactor = (particleSphereRadius + waveEffect) / particleSphereRadius;
            
            x = p.ox * waveFactor;
            y = p.oy * waveFactor;
            // z = p.oz; // Z could also be modulated if desired
        }

        // 3D Rotation (around Y axis for now, then X)
        const rotY_x = x * Math.cos(sphereRotationY) - z * Math.sin(sphereRotationY);
        const rotY_z = x * Math.sin(sphereRotationY) + z * Math.cos(sphereRotationY);
        x = rotY_x;
        z = rotY_z;

        // (Optional) Rotation around X axis
        // const rotX_y = y * Math.cos(sphereRotationX) - z * Math.sin(sphereRotationX);
        // const rotX_z = y * Math.sin(sphereRotationX) + z * Math.cos(sphereRotationX);
        // y = rotX_y;
        // z = rotX_z;

        // Simple perspective projection
        const perspectiveFactor = 300 / (300 + z); // Adjust 300 for more/less perspective
        const projectedX = x * perspectiveFactor + halfWidth;
        const projectedY = y * perspectiveFactor + halfHeight;
        
        // Vary particle size and opacity with depth (Z)
        let particleSize = Math.max(0.5, 2.5 * perspectiveFactor);
        let alpha = Math.max(0.1, 0.8 * perspectiveFactor);
        if (z < -particleSphereRadius * 0.5) alpha *= 0.5; // Make back particles fainter

        sphereCtx.beginPath();
        sphereCtx.arc(projectedX, projectedY, particleSize, 0, 2 * Math.PI);
        
        // Adjust color alpha
        let finalColor = currentParticleColor.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${alpha.toFixed(2)})`);
        sphereCtx.fillStyle = finalColor;
        sphereCtx.fill();
    });

    sphereAnimationId = requestAnimationFrame(drawParticleSphere);
}

function startSphereAnimation() {
    // This function will now be called from the load event listener
    // after sphereCtx and initial particles are set up.
    if (sphereCtx && !sphereAnimationId) {
        // Canvas dimensions and initial particles should already be set by the load listener
        lastFrameTime = performance.now();
        sphereAnimationId = requestAnimationFrame(drawParticleSphere);
        console.log("Particle Sphere animation started.");
    } else if (!sphereCtx) {
        console.error("Cannot start sphere animation: sphereCtx is not initialized.");
    }
}

function stopSphereAnimation() {
    if (sphereAnimationId) {
        cancelAnimationFrame(sphereAnimationId);
        sphereAnimationId = null;
        console.log("Particle Sphere animation stopped.");
        if(sphereCtx) {
            sphereCtx.clearRect(0, 0, sphereCanvas.width, sphereCanvas.height);
            // Optionally draw a static representation or leave blank
        }
    }
}

// --- App State ---
let appState = 'awaitingActivation'; // Simplified states: 'awaitingActivation', 'sessionActive'
const STOP_PHRASE_LOWER = "bye friday"; // Still used for potential server-side session termination logic if agent says it
// --- End App State ---

// WebSocket handlers
function connectWebsocket() {
  // MODIFIED: Allow connection if appState is 'awaitingActivation' as activateSession will set it before calling this.
  if (appState !== 'sessionActive' && appState !== 'awaitingActivation') { 
    console.warn("WebSocket connection attempt outside of appropriate state. State:", appState);
    // If activateSession is in progress, it will set to sessionActive upon successful WS connection.
    // This check is more of a safeguard against rogue calls.
    if (appState !== 'sessionActive') return false; // Strict check, allow only if becoming active
  }
  websocket = new WebSocket(ws_url + "?is_audio=" + is_audio);

  websocket.onopen = function () {
    console.log("WebSocket connection opened.");
    appState = 'sessionActive'; // Set state to active once WS is truly open
    updateStatusDisplay("Session Active. Listening...");
    if (voiceControlButton) voiceControlButton.textContent = "Stop Session";

    if (messagesDiv) {
        messagesDiv.innerHTML = ''; // Clear previous messages
        const p = document.createElement("p");
        p.textContent = "Session active. How can I help?";
        messagesDiv.appendChild(p);
    }
    // updateStatusDisplay("Session Active. Listening..."); // Moved up

    // Enable the Send button
    const sendButton = document.getElementById("sendButton");
    if (sendButton) sendButton.disabled = false;
    if (messageInput) messageInput.disabled = false;
    
    // The messageForm might not exist if we remove it from HTML, adjust submit handler attachment
    const messageFormElement = document.getElementById("messageForm");
    if (messageFormElement) {
        addSubmitHandler();
    } else if (messageInput && sendButton) {
        // Ensure handlers are not duplicated if onopen is somehow called multiple times for same ws
        sendButton.onclick = null; // Clear previous if any
        messageInput.onkeypress = null; // Clear previous if any

        sendButton.onclick = () => {
            const message = messageInput.value;
            if (message && appState === 'sessionActive') { // Extra check for appState here
                if (messagesDiv) {
                    const p = document.createElement("p");
                    p.textContent = "> " + message;
                    messagesDiv.appendChild(p);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
                messageInput.value = "";
                sendMessage({
                    mime_type: "text/plain",
                    data: message,
                });
                console.log("[CLIENT TO AGENT] " + message);
            }
        };
        messageInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !sendButton.disabled && appState === 'sessionActive') { // Extra check
                sendButton.click();
            }
        };
    }
    startSphereAnimation();
  };

  websocket.onmessage = function (event) {
    // Parse the incoming message
    const message_from_server = JSON.parse(event.data);
    console.log("[AGENT TO CLIENT] ", message_from_server);

    if (appState !== 'sessionActive') return; // Ignore messages if session is not active

    // Handle interruption
    if (message_from_server.interrupted === true) {
      handleInterrupt();
      isAgentSpeaking = false;
      return;
    }

    // Check if the turn is complete
    if (
      message_from_server.turn_complete &&
      message_from_server.turn_complete == true
    ) {
      currentMessageId = null;
      isAgentSpeaking = false;
      return;
    }

    // If it's audio, play it
    if (message_from_server.mime_type == "audio/pcm") {
      isAgentSpeaking = true;
      if (!audioPlayerNode) {
        // Initialize audio player if it was stopped due to interruption
        startAudioPlayerWorklet().then(([node, ctx]) => {
          audioPlayerNode = node;
          audioPlayerContext = ctx;
          // Now that it's initialized, play the audio
          if (audioPlayerNode) { // Check again in case initialization failed
            audioPlayerNode.port.postMessage(base64ToArray(message_from_server.data));
          }
        }).catch(err => console.error("Error re-initializing audio player:", err));
      } else {
        audioPlayerNode.port.postMessage(base64ToArray(message_from_server.data));
      }
    }

    // If it's a text, print it
    if (message_from_server.mime_type == "text/plain") {
      let messageText = message_from_server.data;
      // add a new message for a new turn
      if (currentMessageId == null) {
        currentMessageId = Math.random().toString(36).substring(7);
        if (messagesDiv) {
            const message = document.createElement("p");
            message.id = currentMessageId;
            messagesDiv.appendChild(message);
        }
      }

      if (messagesDiv) {
          const message = document.getElementById(currentMessageId);
          if (message) message.textContent += messageText;
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
    }
  };

  websocket.onclose = function (event) { 
    console.log("WebSocket connection closed. Code:", event.code, "Reason:", event.reason, "Clean:", event.wasClean);
    const previousState = appState;
    appState = 'awaitingActivation'; // Always revert to awaitingActivation on close

    if (previousState === 'sessionActive') {
        let reason = "Connection closed.";
        if (event.code === 1000 || (event.code === 1001 && event.reason === "Client is leaving page")) {
            reason = "Session ended.";
        }
        // terminateSession handles UI updates based on the new 'awaitingActivation' state
        // We just need to ensure UI reflects that session is over.
        updateStatusDisplay(reason + " Click 'Start Session' to begin.");
        if (voiceControlButton) voiceControlButton.textContent = "Start Session";
    }
    stopSphereAnimation();
    // Call terminateSession to ensure full cleanup if it wasn't the initiator
    // This might be redundant if terminateSession called websocket.close(), but good for robustness
    // However, avoid re-triggering terminateSession if it was already called and led to this onclose.
    // The state check `previousState === 'sessionActive'` helps.
    // Let terminateSession handle actual audio/UI cleanup based on the new state.
  };

  websocket.onerror = function (e) {
    console.log("WebSocket error: ", e);
    const previousState = appState;
    appState = 'awaitingActivation';
    if (previousState === 'sessionActive') {
        updateStatusDisplay("Connection error. Click 'Start Session' to begin.");
    }
    if (voiceControlButton) voiceControlButton.textContent = "Start Session";
    stopSphereAnimation();
  };
  return true; // Indicate successful attempt to establish connection
}

// Add submit handler to the form
function addSubmitHandler() {
  const messageFormElement = document.getElementById("messageForm");
  if (messageFormElement) {
      messageFormElement.onsubmit = function (e) {
        e.preventDefault();
        const message = messageInput.value;
        if (message && appState === 'sessionActive') { // Only send if session is active
          if (messagesDiv) {
              const p = document.createElement("p");
              p.textContent = "> " + message;
              messagesDiv.appendChild(p);
              messagesDiv.scrollTop = messagesDiv.scrollHeight;
          }
          messageInput.value = "";
          sendMessage({
            mime_type: "text/plain",
            data: message,
          });
          console.log("[CLIENT TO AGENT] " + message);
        }
        return false;
      };
  }
}

// Send a message to the server as a JSON string
function sendMessage(message) {
  if (websocket && websocket.readyState == WebSocket.OPEN) {
    const messageJson = JSON.stringify(message);
    websocket.send(messageJson);
  }
}

// Decode Base64 data to Array
function base64ToArray(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Audio handling
 */

let audioPlayerNode;
let audioPlayerContext;
let audioRecorderNode;
let audioRecorderContext;
let micStream;

// Import the audio worklets
import { startAudioPlayerWorklet } from "./audio-player.js";
import { startAudioRecorderWorklet } from "./audio-recorder.js";

// Start audio
async function startAudio() {
  console.log("startAudio called");
  try {
    // Initialize player and recorder concurrently
    await Promise.all([
      startAudioPlayerWorklet().then(([node, ctx]) => {
        audioPlayerNode = node;
        audioPlayerContext = ctx;
        console.log("Audio player worklet started.");
      }).catch(err => {
        console.error("Error starting audio player worklet:", err);
        throw new Error("Failed to start audio player: " + err.message); // Re-throw to be caught by activateSession
      }),
      startAudioRecorderWorklet(audioRecorderHandler).then(([node, ctx, stream]) => {
        audioRecorderNode = node;
        audioRecorderContext = ctx;
        micStream = stream;
        console.log("Audio recorder worklet started.");
      }).catch(err => {
        console.error("Error starting audio recorder worklet:", err);
        // Attempt to clean up mic stream if it was partially acquired and then failed
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }
        throw new Error("Failed to start audio recorder: " + err.message); // Re-throw
      })
    ]);
    console.log("Both audio player and recorder worklets initialized.");
  } catch (error) {
    console.error("Error in startAudio Promise.all:", error);
    // Ensure cleanup if one part succeeded and the other failed before this catch
    if (audioPlayerNode) stopAudioPlayer(); // stopAudioPlayer also nulls out player node/context
    if (audioRecorderNode || micStream) {
        if (micStream) micStream.getTracks().forEach(track => track.stop());
        if (audioRecorderNode) audioRecorderNode.disconnect();
        if (audioRecorderContext && audioRecorderContext.state !== 'closed') {
            audioRecorderContext.close().catch(e => console.error("Error closing recorder context in startAudio cleanup:", e));
        }
        audioRecorderNode = null;
        audioRecorderContext = null;
        micStream = null;
    }
    throw error; // Re-throw the error to be handled by activateSession
  }
}

// Start the audio only when the user clicked the button
// (due to the gesture requirement for the Web Audio API)
// const startAudioButton = document.getElementById("startAudioButton"); // OLD ID, REMOVE/COMMENT OUT
// if (startAudioButton) { // ADD A CHECK IN CASE OF SCRIPT ORDERING, though it should be removed
//  startAudioButton.addEventListener("click", () => {
//    startAudioButton.disabled = true;
//    startAudio();
//    is_audio = true;
//    connectWebsocket(); // reconnect with the audio mode
//  });
// }

// Audio recorder handler
function audioRecorderHandler(pcmData) {
  // Send the pcm data as base64
  sendMessage({
    mime_type: "audio/pcm",
    data: arrayBufferToBase64(pcmData),
  });
  console.log("[CLIENT TO AGENT] sent %s bytes", pcmData.byteLength);
}

// Encode an array buffer with Base64
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Handle interruption from server
function handleInterrupt() {
  console.log("Handling interruption from server.");
  stopAudioPlayer();
  currentMessageId = null; // Reset current message ID as the turn is interrupted
  isAgentSpeaking = false;
}

// Stop audio player
function stopAudioPlayer() {
  if (audioPlayerNode) {
    audioPlayerNode.disconnect();
    audioPlayerNode = null;
    console.log("Audio player node disconnected.");
  }
  if (audioPlayerContext) {
    audioPlayerContext.close().then(() => {
      console.log("Audio context closed.");
    }).catch(err => console.error("Error closing audio context:", err));
    audioPlayerContext = null;
  }
}

// --- Session Management & UI Updates ---
function updateStatusDisplay(text) {
    if (statusDisplay) {
        statusDisplay.textContent = text;
    }
}

async function activateSession() {
    console.log("activateSession called. Current state:", appState);
    is_audio = true; 
    updateStatusDisplay("Activating session...");
    if(voiceControlButton) voiceControlButton.disabled = true; // Disable button during activation

    try {
        console.log("Attempting to start ADK audio components...");
        await startAudio(); 
        console.log("ADK Audio components started successfully.");
    } catch (error) {
        console.error("Failed to start ADK audio components:", error);
        updateStatusDisplay(`Error starting audio: ${error.message}. Click 'Start Session'.`);
        appState = 'awaitingActivation'; // Revert state
        if(voiceControlButton) {
            voiceControlButton.textContent = "Start Session";
            voiceControlButton.disabled = false;
        }
        return; 
    }

    console.log("Attempting to connect WebSocket...");
    if (!connectWebsocket()) { 
        console.error("Failed to initiate WebSocket connection.");
        updateStatusDisplay("Error: Could not connect to server. Click 'Start Session'.");
        stopAudioPlayer(); // Ensure player is stopped
        // stopAudioRecorder(); // This is more complex, startAudio handles its cleanup on failure
        if (micStream) { // Explicitly stop mic stream if connectWebsocket fails after startAudio success
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }
        if (audioRecorderNode) {audioRecorderNode.disconnect(); audioRecorderNode = null;}
        if (audioRecorderContext && audioRecorderContext.state !== 'closed') { audioRecorderContext.close(); audioRecorderContext = null;}

        appState = 'awaitingActivation';
        if(voiceControlButton) {
            voiceControlButton.textContent = "Start Session";
            voiceControlButton.disabled = false;
        }
        return;
    }
    
    // appState will be set to 'sessionActive' by websocket.onopen
    // updateStatusDisplay("Session active. Say something!"); // Done in onopen
    // voiceControlButton.textContent = "Stop Session"; // Done in onopen
    if(voiceControlButton) voiceControlButton.disabled = false; // Re-enable button
    isAgentSpeaking = false; 
    // startSphereAnimation(); // Should be started in onopen or if already running
    console.log("activateSession: WebSocket connection initiated. Waiting for onopen.");
}

function terminateSession(reason = "Session terminated.") {
    console.log("terminateSession called. Reason:", reason, "Current appState:", appState);
    
    const previousState = appState;
    appState = 'awaitingActivation'; 

    stopAudioPlayer();
    if (audioRecorderNode && micStream) { 
        // Send stop command to worklet to flush its buffer BEFORE disconnecting
        if (audioRecorderNode.port) {
            try {
                audioRecorderNode.port.postMessage({ command: 'stop' });
                console.log("Sent 'stop' command to audio recorder worklet.");
            } catch (e) {
                console.error("Error sending 'stop' command to recorder worklet:", e);
            }
        }
        micStream.getTracks().forEach(track => track.stop());
        audioRecorderNode.disconnect();
        if (audioRecorderContext && audioRecorderContext.state !== 'closed') {
            audioRecorderContext.close().then(() => console.log("Audio recorder context closed for ADK."));
        }
        audioRecorderNode = null;
        audioRecorderContext = null;
        micStream = null;
        console.log("ADK audio recording stopped.");
    }
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close(1000, "Session terminated by client"); 
        console.log("WebSocket connection closed by client.");
    }
    websocket = null;

    isAgentSpeaking = false; 
    // stopSphereAnimation(); // Already called in onclose/onerror, or if sphere should stop here

    updateStatusDisplay(reason + " Click 'Start Session' to begin.");
    if (voiceControlButton) {
        voiceControlButton.textContent = "Start Session";
        voiceControlButton.disabled = false;
    }
    if (messageInput) messageInput.disabled = true;
    const sendButton = document.getElementById('sendButton');
    if (sendButton) sendButton.disabled = true;
    if (messagesDiv && previousState === 'sessionActive') {
         const p = document.createElement("p");
         p.textContent = reason;
         messagesDiv.appendChild(p);
         messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    currentMessageId = null;
}

// --- Initialization ---
window.addEventListener('load', () => {
    messageInput = document.getElementById("message");
    messagesDiv = document.getElementById("messages");
    sphereCanvas = document.getElementById('sphereCanvas');
    voiceControlButton = document.getElementById('voiceControlButton');
    statusDisplay = document.getElementById('status-display');

    if (sphereCanvas) {
        sphereCtx = sphereCanvas.getContext('2d');
        if (sphereCtx) {
            sphereCanvas.width = sphereCanvas.offsetWidth;   
            sphereCanvas.height = sphereCanvas.offsetHeight;
            console.log(`Canvas initialized to: ${sphereCanvas.width}x${sphereCanvas.height}`);
            if (sphereCanvas.width > 0 && sphereCanvas.height > 0) {
                 initializeParticles(); 
                 startSphereAnimation(); 
            } else {
                console.warn("Canvas dimensions are 0. Skipping particle initialization and animation start.");
            }
        } else {
            console.error("Failed to get 2D context for sphere canvas.");
        }
    } else {
        console.error("Sphere canvas element not found on load!");
    }

    updateStatusDisplay("Click 'Start Session' to begin."); // MODIFIED Initial message
    if (voiceControlButton) {
        voiceControlButton.textContent = "Start Session"; // MODIFIED Initial button text
        voiceControlButton.disabled = false;

        voiceControlButton.onclick = () => {
            if (appState === 'awaitingActivation') {
                console.log("Voice control button clicked - activating session directly.");
                // appState will be managed by activateSession and websocket.onopen
                activateSession(); 
            } else if (appState === 'sessionActive') {
                console.log("Voice control button clicked - stopping active session.");
                terminateSession("Session stopped by user.");
            } else {
                console.warn("Voice control button clicked in unexpected state:", appState);
            }
        };
    }
    const sendButton = document.getElementById('sendButton');
    if (sendButton) sendButton.disabled = true;
    if (messageInput) messageInput.disabled = true;
});