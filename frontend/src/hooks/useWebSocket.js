import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (setMessages, setStatus, setIsAgentSpeaking, setGeneratedImages, setShowImageDisplay) => {
  const [websocket, setWebsocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const websocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const audioPlayerRef = useRef(null);
  const reinitializeAudioPlayerRef = useRef(null);

  const generateSessionId = () => {
    return Math.random().toString().substring(10);
  };

  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const connectWebSocket = useCallback((audioMode = false) => {
    try {
      const sessionId = generateSessionId();
      const wsUrl = `ws://${window.location.host}/ws/${sessionId}?is_audio=${audioMode}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      setStatus('Connecting...');

      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setStatus('Connected - Ready to chat');
        setWebsocket(ws);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);

          // Handle interruption
          if (message.interrupted === true) {
            console.log('Handling interruption from server');
            setIsAgentSpeaking(false);
            // Stop audio player if it exists
            if (audioPlayerRef.current) {
              try {
                audioPlayerRef.current.disconnect();
                audioPlayerRef.current = null; // Clear the reference
                console.log('Audio player disconnected due to interruption');
              } catch (error) {
                console.error('Error disconnecting audio player:', error);
              }
            }
            return;
          }

          // Handle turn complete
          if (message.turn_complete === true) {
            setIsAgentSpeaking(false);
            setStatus('Connected - Ready to chat');
            return;
          }

          // Handle different message types
          if (message.mime_type === 'text/plain') {
            setIsAgentSpeaking(true);
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              
              // If last message is from agent and partial, update it
              if (lastMessage && lastMessage.type === 'agent' && lastMessage.partial) {
                lastMessage.content = message.data;
                lastMessage.partial = message.partial;
                if (!message.partial) {
                  lastMessage.timestamp = Date.now();
                }
              } else {
                // Add new message
                newMessages.push({
                  type: 'agent',
                  content: message.data,
                  partial: message.partial,
                  timestamp: message.partial ? null : Date.now()
                });
              }
              
              return newMessages;
            });
          } else if (message.mime_type === 'image/jpeg') {
            setMessages(prev => [...prev, {
              type: 'image',
              content: message.data,
              timestamp: Date.now()
            }]);
          } else if (message.mime_type === 'image/generated') {
            // Handle generated images
            console.log('Generated image received:', message.filename);
            const newImage = {
              data: message.data,
              filename: message.filename,
              timestamp: Date.now()
            };
            
            setGeneratedImages(prev => [...prev, newImage]);
            setShowImageDisplay(true);
            
            // Also add to messages for history
            setMessages(prev => [...prev, {
              type: 'image',
              content: message.data,
              filename: message.filename,
              timestamp: Date.now()
            }]);
          } else if (message.mime_type === 'audio/pcm') {
            // Handle audio playback
            console.log('Audio PCM data received');
            setIsAgentSpeaking(true);
            
            if (audioPlayerRef.current) {
              try {
                const audioData = base64ToArrayBuffer(message.data);
                audioPlayerRef.current.port.postMessage(audioData);
              } catch (error) {
                console.error('Error playing audio:', error);
              }
            } else if (reinitializeAudioPlayerRef.current) {
              // Audio player was disconnected (likely due to interruption), reinitialize it
              console.log('Audio player not available, attempting to reinitialize...');
              reinitializeAudioPlayerRef.current().then((newAudioPlayer) => {
                if (newAudioPlayer) {
                  console.log('Audio player reinitialized successfully, playing audio data');
                  try {
                    const audioData = base64ToArrayBuffer(message.data);
                    newAudioPlayer.port.postMessage(audioData);
                    console.log('Audio data sent to reinitialized player');
                  } catch (error) {
                    console.error('Error playing audio after reinitialize:', error);
                  }
                } else {
                  console.error('Failed to reinitialize audio player - returned null');
                }
              }).catch((error) => {
                console.error('Failed to reinitialize audio player:', error);
              });
            } else {
              console.log('Audio player not available and no reinitialize function, audio data discarded');
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setWebsocket(null);
        websocketRef.current = null;
        setIsAgentSpeaking(false);

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          setStatus(`Connection lost. Reconnecting in ${delay/1000}s...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else {
          setStatus('Connection failed. Please refresh the page.');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('Connection error');
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setStatus('Failed to connect');
    }
  }, [setMessages, setStatus, setIsAgentSpeaking, setGeneratedImages, setShowImageDisplay]);

  const sendMessage = useCallback((message) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      websocketRef.current.send(messageStr);
      console.log('Sent message:', message);
    } else {
      console.error('WebSocket not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (websocketRef.current) {
      websocketRef.current.close();
    }
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connectWebSocket, disconnect]);

  return {
    websocket,
    isConnected,
    sendMessage,
    reconnect: connectWebSocket,
    disconnect,
    connectWithAudio: (audioMode) => connectWebSocket(audioMode),
    setAudioPlayer: (audioPlayer) => { audioPlayerRef.current = audioPlayer; },
    setReinitializeAudioPlayer: (reinitializeFunc) => { reinitializeAudioPlayerRef.current = reinitializeFunc; }
  };
}; 