import React, { useState, useMemo } from 'react';

/**
 * Sortable table component for displaying query results
 */
export default function TableResult({ columns, rows }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Sort rows based on current sort configuration
  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows;

    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Try numeric comparison
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, sortConfig]);

  const handleSort = (column) => {
    setSortConfig((prev) => ({
      key: column,
      direction: prev.key === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIndicator = (column) => {
    if (sortConfig.key !== column) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  if (!columns || columns.length === 0) {
    return <div className="no-results">No data to display</div>;
  }

  return (
    <div className="table-container">
      <table className="results-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                onClick={() => handleSort(column)}
                className="sortable-header"
              >
                {column}
                <span className="sort-indicator">{getSortIndicator(column)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column}>{formatValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-footer">
        Showing {rows.length} row{rows.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/**
 * Format cell values for display
 */
function formatValue(value) {
  if (value == null) return '-';

  // Format numbers with commas
  const num = parseFloat(value);
  if (!isNaN(num) && value.toString() === num.toString()) {
    // Check if it looks like a salary (large integer)
    if (Number.isInteger(num) && num > 1000) {
      return num.toLocaleString();
    }
    // Format decimals
    if (!Number.isInteger(num)) {
      return num.toFixed(2);
    }
  }

  return String(value);
}
