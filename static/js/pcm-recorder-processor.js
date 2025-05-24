class PCMProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super(options);
      // Buffer to accumulate audio data. Let's aim for around 80-100ms of audio.
      // At 16000Hz, 128 samples is 8ms. So 10 * 128 = 1280 samples is 80ms.
      // Or 15 * 128 = 1920 samples is 120ms.
      // Let's try 1280 samples for the buffer size.
      this.bufferSize = 1280; 
      this._buffer = new Float32Array(this.bufferSize);
      this._bufferIndex = 0;

      this.port.onmessage = (event) => {
        if (event.data.command === 'stop') {
          console.log('[PCMProcessor] Received stop command. Flushing remaining audio.');
          this.flush(); // Flush any remaining audio
          // How to signal worklet to terminate or stop processing?
          // The node disconnect on main thread should handle this.
        }
      };
    }
  
    process(inputs, outputs, parameters) {
      if (inputs.length > 0 && inputs[0].length > 0) {
        const inputChannel = inputs[0][0]; // This is typically 128 samples

        // If the input data will overflow the buffer, flush first
        if (this._bufferIndex + inputChannel.length >= this.bufferSize) {
          this.flush();
        }

        // Append new data to the buffer
        for (let i = 0; i < inputChannel.length; i++) {
          this._buffer[this._bufferIndex++] = inputChannel[i];
        }

        // If buffer is full, send it
        if (this._bufferIndex >= this.bufferSize) {
          this.flush();
        }
      }
      return true; // Keep processor alive
    }

    flush() {
      if (this._bufferIndex > 0) {
        // Send only the portion of the buffer that has data
        const audioDataToSend = this._buffer.slice(0, this._bufferIndex);
        this.port.postMessage(audioDataToSend);
        this._bufferIndex = 0; // Reset buffer index
        // No need to clear the whole buffer, just overwrite from index 0
      }
    }
  }
  
  registerProcessor("pcm-recorder-processor", PCMProcessor);