import React, { useState, useRef } from 'react';

/**
 * Chat input component with text input and optional voice button
 * Supports up/down arrow keys to navigate query history
 */
export default function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = "Ask a question about employees...",
  voiceButton = null,
  queryHistory = [],
  onAddToHistory
}) {
  const [inputValue, setInputValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && !disabled) {
      // Add to history via callback
      if (onAddToHistory) {
        onAddToHistory(trimmed);
      }
      onSubmit(trimmed);
      setInputValue('');
      setHistoryIndex(-1);
      setSavedInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (queryHistory.length === 0) return;

      if (historyIndex === -1) {
        // Starting to navigate history, save current input
        setSavedInput(inputValue);
        setHistoryIndex(0);
        setInputValue(queryHistory[0]);
      } else if (historyIndex < queryHistory.length - 1) {
        // Navigate further back in history
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(queryHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;

      if (historyIndex === 0) {
        // Back to current input
        setHistoryIndex(-1);
        setInputValue(savedInput);
      } else {
        // Navigate forward in history
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(queryHistory[newIndex]);
      }
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
