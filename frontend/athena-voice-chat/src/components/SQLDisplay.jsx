import React, { useState } from 'react';

/**
 * SQL display component
 *
 * Collapsible display of generated SQL query.
 */
export default function SQLDisplay({ sql }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sql) return null;

  // Clean SQL for display (remove visualization comment)
  const displaySql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('-- TABLE') &&
                    !line.trim().startsWith('-- MAP') &&
                    !line.trim().startsWith('-- CHART'))
    .join('\n')
    .trim();

  return (
    <div className="sql-display">
      <button
        className="sql-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="sql-toggle-icon">{isExpanded ? '▼' : '▶'}</span>
        <span>View SQL</span>
      </button>

      {isExpanded && (
        <div className="sql-content">
          <pre><code>{displaySql}</code></pre>
          <button
            className="sql-copy-btn"
            onClick={() => navigator.clipboard.writeText(displaySql)}
            title="Copy to clipboard"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
