import React, { useState, useEffect, useRef } from 'react';

// Example queries grouped by visualization type
const EXAMPLE_QUERIES = [
  { type: 'TABLE', label: 'Table', queries: ['Show all employees', 'List employees in Engineering', 'What fields are in the database?'] },
  { type: 'MAP', label: 'Map', queries: ['Show employee locations on a map', 'Show the employees in Boston on a map, show first, last and email'] },
  { type: 'CHART', label: 'Chart', queries: ['Count employees by department', 'Average salary by department'] },
  { type: 'SURFACE', label: 'Surface', queries: ['Average salary by department and city', 'Employee count by state and department', 'Average salary by department and state'] },
];

/**
 * Chat panel component displaying conversation history
 */
export default function ChatPanel({
  messages,
  onClearHistory,
  onSubmit,
  onAddToHistory,
  children
}) {
  const [showExamples, setShowExamples] = useState(false);
  const dropdownRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowExamples(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExampleClick = (query) => {
    setShowExamples(false);
    if (onAddToHistory) {
      onAddToHistory(query);
    }
    if (onSubmit) {
      onSubmit(query);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>VoxQuery</h2>

        {/* Examples dropdown */}
        <div className="examples-dropdown" ref={dropdownRef}>
          <button
            className="examples-btn"
            onClick={() => setShowExamples(!showExamples)}
            title="View example queries"
          >
            Examples
          </button>
          {showExamples && (
            <div className="examples-popup">
              {EXAMPLE_QUERIES.map((category) => (
                <div key={category.type} className="example-category">
                  <span className={`category-label category-${category.type.toLowerCase()}`}>
                    {category.label}
                  </span>
                  <div className="example-queries">
                    {category.queries.map((query) => (
                      <button
                        key={query}
                        className="example-query-btn"
                        onClick={() => handleExampleClick(query)}
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
        <div ref={messagesEndRef} />
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
