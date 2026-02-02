import React from 'react';

/**
 * Chat panel component displaying conversation history
 */
export default function ChatPanel({
  messages,
  onClearHistory,
  children
}) {
  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>VoxQuery</h2>
        {messages.length > 0 && (
          <button
            className="clear-history-btn"
            onClick={onClearHistory}
            title="Start new conversation"
          >
            New Chat
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <h3>Welcome to VoxQuery</h3>
            <p>Ask questions about employee data in natural language.</p>
            <p className="hint">Try: "Show me all employees in Engineering"</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))
        )}
      </div>

      <div className="chat-input-wrapper">
        {children}
      </div>
    </div>
  );
}

/**
 * Individual chat message component
 */
function ChatMessage({ message }) {
  const { type, content, timestamp } = message;

  return (
    <div className={`chat-message chat-message-${type}`}>
      <div className="message-content">
        {content}
      </div>
      {timestamp && (
        <div className="message-timestamp">
          {new Date(timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
