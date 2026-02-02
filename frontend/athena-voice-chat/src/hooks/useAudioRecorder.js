import { useState, useRef, useCallback } from 'react';
import { AUDIO_CONFIG } from '../config';

/**
 * Recording states
 */
export const RecordingState = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  ERROR: 'error'
};

/**
 * Custom hook for audio recording
 *
 * Provides push-to-talk functionality using MediaRecorder.
 * Records in WebM/Opus format for compatibility with AWS Transcribe.
 */
export default function useAudioRecorder() {
  const [state, setState] = useState(RecordingState.IDLE);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });
      streamRef.current = stream;

      // Create MediaRecorder
      const options = {
        mimeType: AUDIO_CONFIG.mimeType,
        audioBitsPerSecond: AUDIO_CONFIG.audioBitsPerSecond
      };

      // Check if mimeType is supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // Fall back to default
        delete options.mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState(RecordingState.RECORDING);

    } catch (err) {
      setError(err.message || 'Failed to start recording');
      setState(RecordingState.ERROR);
      throw err;
    }
  }, []);

  /**
   * Stop recording and return audio data
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setState(RecordingState.IDLE);
        reject(new Error('No active recording'));
        return;
      }

      setState(RecordingState.PROCESSING);

      mediaRecorder.onstop = async () => {
        try {
          // Combine chunks into a single blob
          const blob = new Blob(chunksRef.current, {
            type: AUDIO_CONFIG.mimeType
          });

          // Convert to base64
          const base64 = await blobToBase64(blob);

          // Clean up
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          setState(RecordingState.IDLE);
          resolve({
            blob,
            base64,
            mimeType: AUDIO_CONFIG.mimeType,
            duration: chunksRef.current.length * 100 // Approximate
          });

        } catch (err) {
          setError(err.message);
          setState(RecordingState.ERROR);
          reject(err);
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  /**
   * Cancel recording without saving
   */
  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setState(RecordingState.IDLE);
    setError(null);
  }, []);

  /**
   * Check if browser supports audio recording
   * Note: mediaDevices is only available in secure contexts (HTTPS or localhost)
   */
  const checkSupported = () => {
    // Check for secure context
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      console.warn('Audio recording requires a secure context (HTTPS or localhost)');
      return false;
    }
    // Check for mediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('MediaDevices API not available');
      return false;
    }
    return true;
  };

  const isSupported = checkSupported();

  return {
    state,
    error,
    isRecording: state === RecordingState.RECORDING,
    isProcessing: state === RecordingState.PROCESSING,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording
  };
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
