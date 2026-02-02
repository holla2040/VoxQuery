import React from 'react';
import { CANNED_QUERIES } from '../config';

/**
 * Canned queries component
 *
 * Displays preset query tiles for quick access to common queries.
 */
export default function CannedQueries({ onSelect, disabled = false }) {
  return (
    <div className="canned-queries">
      <h4 className="canned-queries-title">Quick queries</h4>
      <div className="canned-queries-grid">
        {CANNED_QUERIES.map((query, index) => (
          <button
            key={index}
            className="canned-query-tile"
            onClick={() => onSelect(query.question)}
            disabled={disabled}
            title={query.question}
          >
            <span className="tile-icon">{query.icon}</span>
            <span className="tile-label">{query.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
