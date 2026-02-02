import React, { useRef, useEffect } from 'react';
import TableResult from './TableResult';
import LoadingSpinner from './LoadingSpinner';

/**
 * Results panel component displaying scrolling query result history
 */
export default function ResultsPanel({
  resultHistory,
  loading,
  error,
  MapResult,
  ChartResult,
  SurfaceResult
}) {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new results are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [resultHistory]);

  // Render a single result item
  const renderResultItem = (result, index) => {
    const { visualization_type, columns, rows, query, timestamp, execution_time_ms, row_count, attempts } = result;

    return (
      <div key={`${timestamp}-${index}`} className="result-history-item">
        {/* Query header */}
        <div className="result-query-header">
          <span className="result-query-text">{query}</span>
          <span className="result-timestamp">
            {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Visualization */}
        <div className="result-visualization-content">
          {visualization_type === 'MAP' && MapResult ? (
            <MapResult
              rows={rows}
              mapConfig={result.map_config}
            />
          ) : visualization_type === 'CHART' && ChartResult ? (
            <ChartResult
              rows={rows}
              columns={columns}
              chartConfig={result.chart_config}
            />
          ) : visualization_type === 'SURFACE' && SurfaceResult ? (
            <SurfaceResult
              surfaceConfig={result.surface_config}
            />
          ) : (
            <TableResult columns={columns} rows={rows} />
          )}
        </div>

        {/* Execution Stats */}
        {execution_time_ms > 0 && (
          <div className="result-stats">
            {row_count} rows in {execution_time_ms}ms
            {attempts > 1 && ` (${attempts} attempts)`}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="results-panel">
      <div className="results-history-container" ref={scrollRef}>
        {/* Empty state */}
        {resultHistory.length === 0 && !loading && !error && (
          <div className="results-empty">
            <h3>No Results Yet</h3>
            <p>Ask a question to see results here.</p>
          </div>
        )}

        {/* Result history */}
        {resultHistory.map((result, index) => renderResultItem(result, index))}

        {/* Loading indicator */}
        {loading && (
          <div className="result-history-item result-loading-item">
            <LoadingSpinner message="Executing query..." />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="result-history-item result-error-item">
            <div className="results-error">
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
