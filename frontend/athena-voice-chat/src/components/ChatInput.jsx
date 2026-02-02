import React, { useState, useRef } from 'react';

/**
 * Chat input component with text input and optional voice button
 */
export default function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = "Ask a question about employees...",
  voiceButton = null
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="chat-input"
          autoComplete="off"
        />
        <div className="chat-input-actions">
          {voiceButton}
          <button
            type="submit"
            disabled={disabled || !inputValue.trim()}
            className="send-button"
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Controlled version for external state management
 */
export function ChatInputControlled({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask a question about employees...",
  voiceButton = null
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <div className="chat-input-container">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="chat-input"
          autoComplete="off"
        />
        <div className="chat-input-actions">
          {voiceButton}
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="send-button"
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
