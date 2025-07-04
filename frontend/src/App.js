import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import ParticleSphere from './components/ParticleSphere';
import MessageInput from './components/MessageInput';
import MessageDisplay from './components/MessageDisplay';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudio } from './hooks/useAudio';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Initializing...');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  // const [isAudioMode, setIsAudioMode] = useState(false);

  const {
    websocket,
    sendMessage: sendWebSocketMessage,
    isConnected: wsConnected,
    connectWithAudio,
    disconnect,
    setAudioPlayer,
    setReinitializeAudioPlayer
  } = useWebSocket(setMessages, setStatus, setIsAgentSpeaking);

  const {
    isAudioEnabled,
    isActivating,
    startAudio,
    stopAudio,
    reinitializeAudioPlayer
  } = useAudio(sendWebSocketMessage, connectWithAudio, setAudioPlayer);

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  useEffect(() => {
    // Set the reinitialize function in the WebSocket hook
    setReinitializeAudioPlayer(reinitializeAudioPlayer);
  }, [setReinitializeAudioPlayer, reinitializeAudioPlayer]);

  const handleSendMessage = useCallback((message) => {
    if (websocket && isConnected) {
      sendWebSocketMessage({
        mime_type: "text/plain",
        data: message
      });
      
      // Add user message to display
      setMessages(prev => [...prev, {
        type: 'user',
        content: message,
        timestamp: Date.now()
      }]);
    }
  }, [websocket, isConnected, sendWebSocketMessage]);

  const handleToggleAudio = useCallback(() => {
    if (isActivating) return; // Prevent multiple clicks during activation
    
    if (isAudioEnabled) {
      stopAudio();
    } else {
      startAudio();
    }
  }, [isAudioEnabled, isActivating, startAudio, stopAudio]);

  return (
    <div className="App">
      <header className="app-header">
        FRIDAY - Interface
      </header>

      <div className="main-content">
        <div className="status-display">
          {status}
        </div>

        <div className="sphere-container">
          <ParticleSphere isAgentSpeaking={isAgentSpeaking} />
        </div>

        <div className="controls">
          <MessageInput 
            onSendMessage={handleSendMessage}
            disabled={!isConnected}
          />
          <button 
            type="button" 
            className="voice-control-button"
            onClick={handleToggleAudio}
            disabled={!isConnected || isActivating}
          >
            {isActivating ? 'Activating...' : (isAudioEnabled ? 'Stop Session' : 'Start Session')}
          </button>
        </div>

        <MessageDisplay messages={messages} />
      </div>
    </div>
  );
}

export default App;
