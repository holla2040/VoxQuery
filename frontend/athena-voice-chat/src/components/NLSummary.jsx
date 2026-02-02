import React from 'react';

/**
 * Natural language summary component with fade-in animation
 */
export default function NLSummary({ summary, executionTime, rowCount, attempts }) {
  if (!summary) return null;

  return (
    <div className="nl-summary">
      <div className="summary-content">
        <p>{summary}</p>
      </div>
      <div className="summary-meta">
        {rowCount !== undefined && (
          <span className="meta-item">{rowCount} rows</span>
        )}
        {executionTime > 0 && (
          <span className="meta-item">{executionTime}ms</span>
        )}
        {attempts > 1 && (
          <span className="meta-item meta-warning">
            {attempts} attempts
          </span>
        )}
      </div>
    </div>
  );
}
