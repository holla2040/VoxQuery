import React from 'react';
import TableResult from './TableResult';
import LoadingSpinner from './LoadingSpinner';

/**
 * Results panel component displaying query results
 */
export default function ResultsPanel({
  result,
  loading,
  error,
  summary,
  followUps,
  onFollowUpClick,
  sqlDisplay,
  chartComponent,
  mapComponent,
  surfaceComponent
}) {
  if (loading) {
    return (
      <div className="results-panel">
        <div className="results-loading">
          <LoadingSpinner message="Executing query..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-panel">
        <div className="results-error">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-panel">
        <div className="results-empty">
          <h3>No Results Yet</h3>
          <p>Ask a question to see results here.</p>
        </div>
      </div>
    );
  }

  const { visualization_type, columns, rows } = result;

  return (
    <div className="results-panel">
      {/* Summary Section */}
      {summary && (
        <div className="results-summary">
          <p>{summary}</p>
        </div>
      )}

      {/* SQL Display */}
      {sqlDisplay}

      {/* Visualization */}
      <div className="results-visualization">
        {visualization_type === 'MAP' && mapComponent ? (
          mapComponent
        ) : visualization_type === 'CHART' && chartComponent ? (
          chartComponent
        ) : visualization_type === 'SURFACE' && surfaceComponent ? (
          surfaceComponent
        ) : (
          <TableResult columns={columns} rows={rows} />
        )}
      </div>

      {/* Follow-up Suggestions */}
      {followUps && followUps.length > 0 && (
        <div className="follow-ups">
          <h4>Follow-up questions:</h4>
          <div className="follow-up-chips">
            {followUps.map((question, index) => (
              <button
                key={index}
                className="follow-up-chip"
                onClick={() => onFollowUpClick(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Execution Stats */}
      {result.execution_time_ms > 0 && (
        <div className="results-stats">
          {result.row_count} rows in {result.execution_time_ms}ms
          {result.attempts > 1 && ` (${result.attempts} attempts)`}
        </div>
      )}
    </div>
  );
}
