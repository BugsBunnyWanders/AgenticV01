import { useState, useRef, useCallback } from 'react';

export const useAudio = (sendWebSocketMessage, connectWithAudio, setAudioPlayer) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const audioPlayerRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioRecorderContextRef = useRef(null);
  const micStreamRef = useRef(null);

  // Audio Player Worklet
  const startAudioPlayerWorklet = async () => {
    try {
      const audioContext = new AudioContext({
        sampleRate: 24000
      });
      
      const workletURL = new URL('/pcm-player-processor.js', window.location.origin);
      await audioContext.audioWorklet.addModule(workletURL);
      
      const audioPlayerNode = new AudioWorkletNode(audioContext, 'pcm-player-processor');
      audioPlayerNode.connect(audioContext.destination);

      // Ensure audio context is running
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('Audio context resumed');
      }

      // Clear any existing audio buffer
      audioPlayerNode.port.postMessage({ command: 'endOfAudio' });

      return [audioPlayerNode, audioContext];
    } catch (error) {
      console.error('Error starting audio player worklet:', error);
      throw error;
    }
  };

  // Audio Recorder Worklet
  const startAudioRecorderWorklet = async (audioRecorderHandler) => {
    try {
      const audioRecorderContext = new AudioContext({ sampleRate: 16000 });
      console.log("AudioContext sample rate:", audioRecorderContext.sampleRate);

      const workletURL = new URL('/pcm-recorder-processor.js', window.location.origin);
      await audioRecorderContext.audioWorklet.addModule(workletURL);

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      const source = audioRecorderContext.createMediaStreamSource(micStream);

      const audioRecorderNode = new AudioWorkletNode(
        audioRecorderContext,
        "pcm-recorder-processor"
      );

      source.connect(audioRecorderNode);
      audioRecorderNode.port.onmessage = (event) => {
        const pcmData = convertFloat32ToPCM(event.data);
        audioRecorderHandler(pcmData);
      };

      return [audioRecorderNode, audioRecorderContext, micStream];
    } catch (error) {
      console.error('Error starting audio recorder worklet:', error);
      throw error;
    }
  };

  // Convert Float32 samples to 16-bit PCM
  const convertFloat32ToPCM = (inputData) => {
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      pcm16[i] = inputData[i] * 0x7fff;
    }
    return pcm16.buffer;
  };

  // Base64 conversion utilities
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // const base64ToArray = (base64) => {
  //   const binaryString = window.atob(base64);
  //   const len = binaryString.length;
  //   const bytes = new Uint8Array(len);
  //   for (let i = 0; i < len; i++) {
  //     bytes[i] = binaryString.charCodeAt(i);
  //   }
  //   return bytes.buffer;
  // };

  // Audio recorder handler
  const audioRecorderHandler = useCallback((pcmData) => {
    if (sendWebSocketMessage) {
      const base64Data = arrayBufferToBase64(pcmData);
      sendWebSocketMessage({
        mime_type: "audio/pcm",
        data: base64Data
      });
    }
  }, [sendWebSocketMessage]);

  // Stop microphone
  const stopMicrophone = (micStream) => {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      console.log("Microphone stopped.");
    }
  };

  // Reinitialize audio player (for after interruptions)
  const reinitializeAudioPlayer = useCallback(async () => {
    try {
      console.log("Reinitializing audio player after interruption...");
      
      // Close the old audio context if it exists
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        console.log("Closed old audio context");
      }
      
      const [audioPlayerNode, audioContext] = await startAudioPlayerWorklet();
      audioPlayerRef.current = audioPlayerNode;
      audioContextRef.current = audioContext;
      
      // Set audio player reference for WebSocket
      if (setAudioPlayer) {
        setAudioPlayer(audioPlayerNode);
      }
      
      console.log("Audio player reinitialized successfully");
      return audioPlayerNode;
    } catch (error) {
      console.error("Failed to reinitialize audio player:", error);
      return null;
    }
  }, [setAudioPlayer]);

  // Start audio session
  const startAudio = useCallback(async () => {
    if (isActivating) return;
    
    try {
      console.log("Starting audio session...");
      setIsActivating(true);
      
      // Start audio player
      const [audioPlayerNode, audioContext] = await startAudioPlayerWorklet();
      audioPlayerRef.current = audioPlayerNode;
      audioContextRef.current = audioContext;
      
      // Set audio player reference for WebSocket
      if (setAudioPlayer) {
        setAudioPlayer(audioPlayerNode);
      }

      // Start audio recorder
      const [audioRecorderNode, audioRecorderContext, micStream] = 
        await startAudioRecorderWorklet(audioRecorderHandler);
      
      audioRecorderRef.current = audioRecorderNode;
      audioRecorderContextRef.current = audioRecorderContext;
      micStreamRef.current = micStream;

      console.log("Audio components started successfully");
      
      // Reconnect WebSocket with audio mode
      if (connectWithAudio) {
        console.log("Reconnecting WebSocket with audio mode...");
        connectWithAudio(true);
      }

      setIsAudioEnabled(true);
      console.log("Audio session activated successfully");
    } catch (error) {
      console.error("Failed to start audio:", error);
      alert("Failed to start audio. Please check microphone permissions.");
      setIsAudioEnabled(false);
    } finally {
      setIsActivating(false);
    }
  }, [audioRecorderHandler, connectWithAudio, isActivating]);

  // Stop audio session
  const stopAudio = useCallback(() => {
    console.log("Stopping audio session...");

    // Stop microphone
    if (micStreamRef.current) {
      stopMicrophone(micStreamRef.current);
      micStreamRef.current = null;
    }

    // Close audio contexts
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioRecorderContextRef.current) {
      audioRecorderContextRef.current.close();
      audioRecorderContextRef.current = null;
    }

    // Clear references
    audioPlayerRef.current = null;
    audioRecorderRef.current = null;
    
    // Clear audio player reference for WebSocket
    if (setAudioPlayer) {
      setAudioPlayer(null);
    }

    setIsAudioEnabled(false);
    setIsActivating(false);
    
    // Reconnect WebSocket in text mode
    if (connectWithAudio) {
      console.log("Reconnecting WebSocket in text mode...");
      connectWithAudio(false);
    }
    
    console.log("Audio session stopped");
  }, [connectWithAudio]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (isAudioEnabled) {
      stopAudio();
    } else {
      startAudio();
    }
  }, [isAudioEnabled, startAudio, stopAudio]);

  return {
    isAudioEnabled,
    isActivating,
    startAudio,
    stopAudio,
    toggleAudio,
    reinitializeAudioPlayer
  };
}; 