import React, { useState, useEffect } from 'react';

/**
 * Transcript banner component
 *
 * Shows the transcribed text from voice input.
 * Allows editing before submitting.
 */
export default function TranscriptBanner({
  transcript,
  onEdit,
  onSubmit,
  onCancel,
  isEditable = true
}) {
  const [editedText, setEditedText] = useState(transcript);

  // Update local state when transcript changes
  useEffect(() => {
    setEditedText(transcript);
  }, [transcript]);

  if (!transcript) return null;

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(editedText || transcript);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      if (onCancel) onCancel();
    }
  };

  return (
    <div className="transcript-banner">
      <div className="transcript-label">Transcribed:</div>
      {isEditable ? (
        <input
          type="text"
          className="transcript-input"
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <span className="transcript-text">{transcript}</span>
      )}
      <div className="transcript-actions">
        <button
          className="transcript-btn transcript-btn-submit"
          onClick={handleSubmit}
        >
          Send
        </button>
        {onCancel && (
          <button
            className="transcript-btn transcript-btn-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
