import React from 'react';

/**
 * Follow-up suggestion chips component
 */
export default function FollowUpChips({ suggestions, onSelect, disabled = false }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="follow-up-container">
      <h4 className="follow-up-title">Follow-up questions:</h4>
      <div className="follow-up-chips">
        {suggestions.map((question, index) => (
          <button
            key={index}
            className="follow-up-chip"
            onClick={() => onSelect(question)}
            disabled={disabled}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
