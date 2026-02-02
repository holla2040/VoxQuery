import React, { useCallback } from 'react';
import useAudioRecorder, { RecordingState } from '../hooks/useAudioRecorder';

/**
 * Push-to-talk button component
 *
 * Hold to record, release to send.
 * Visual states: idle, recording, processing
 */
export default function PTTButton({ onRecordingComplete, disabled = false }) {
  const {
    state,
    error,
    isRecording,
    isProcessing,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder();

  const handleMouseDown = useCallback(async () => {
    if (disabled || isProcessing) return;
    try {
      await startRecording();
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [disabled, isProcessing, startRecording]);

  const handleMouseUp = useCallback(async () => {
    if (!isRecording) return;
    try {
      const audioData = await stopRecording();
      if (onRecordingComplete) {
        onRecordingComplete(audioData);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    }
  }, [isRecording, stopRecording, onRecordingComplete]);

  const handleMouseLeave = useCallback(() => {
    if (isRecording) {
      // Cancel if mouse leaves button while recording
      cancelRecording();
    }
  }, [isRecording, cancelRecording]);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    handleMouseDown();
  }, [handleMouseDown]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    handleMouseUp();
  }, [handleMouseUp]);

  if (!isSupported) {
    return (
      <button className="ptt-button ptt-unsupported" disabled title="Voice input not supported">
        <MicOffIcon />
      </button>
    );
  }

  const getButtonClass = () => {
    let cls = 'ptt-button';
    if (isRecording) cls += ' ptt-recording';
    if (isProcessing) cls += ' ptt-processing';
    if (disabled) cls += ' ptt-disabled';
    if (error) cls += ' ptt-error';
    return cls;
  };

  const getTitle = () => {
    if (error) return `Error: ${error}`;
    if (isProcessing) return 'Processing...';
    if (isRecording) return 'Recording... Release to send';
    return 'Hold to record';
  };

  return (
    <button
      className={getButtonClass()}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      disabled={disabled || isProcessing}
      title={getTitle()}
      aria-label={getTitle()}
    >
      {isProcessing ? (
        <ProcessingIcon />
      ) : isRecording ? (
        <RecordingIcon />
      ) : (
        <MicIcon />
      )}
    </button>
  );
}

// Icon components
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M19 11c0 1.19-.34 2.3-.9 3.28l-1.23-1.23c.27-.62.43-1.3.43-2.05H19zm-4.02.22c0-.06.02-.11.02-.22V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.17l5.98 5.98zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.2 4.2 1.27-1.27L4.27 3z"/>
    </svg>
  );
}

function RecordingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="ptt-icon-pulse">
      <circle cx="12" cy="12" r="8" fill="#e94560"/>
    </svg>
  );
}

function ProcessingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className="ptt-icon-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.4" strokeDashoffset="10"/>
    </svg>
  );
}
