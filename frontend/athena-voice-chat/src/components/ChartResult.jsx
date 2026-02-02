import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

/**
 * Chart result component using Plotly
 *
 * Renders bar or line charts based on data.
 * Responsive with dark theme styling.
 */
export default function ChartResult({ rows, chartConfig, columns }) {
  const { type = 'bar', x_column, y_column } = chartConfig || {};

  // Extract data for chart
  const chartData = useMemo(() => {
    if (!rows || rows.length === 0) return null;

    // Determine columns to use
    const xCol = x_column || columns?.[0];
    const yCol = y_column || columns?.[1];

    if (!xCol || !yCol) return null;

    const xValues = rows.map(row => row[xCol]);
    const yValues = rows.map(row => {
      const val = row[yCol];
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    });

    return {
      x: xValues,
      y: yValues,
      xLabel: xCol,
      yLabel: yCol
    };
  }, [rows, columns, x_column, y_column]);

  if (!chartData) {
    return (
      <div className="chart-no-data">
        No data available for chart visualization.
      </div>
    );
  }

  // Plotly trace
  const trace = {
    x: chartData.x,
    y: chartData.y,
    type: type === 'line' ? 'scatter' : 'bar',
    mode: type === 'line' ? 'lines+markers' : undefined,
    marker: {
      color: '#e94560',
      line: {
        color: '#ff6b6b',
        width: 1
      }
    },
    line: type === 'line' ? {
      color: '#e94560',
      width: 2
    } : undefined
  };

  // Plotly layout with dark theme
  const layout = {
    title: {
      text: `${chartData.yLabel} by ${chartData.xLabel}`,
      font: { color: '#eaeaea', size: 16 }
    },
    xaxis: {
      title: {
        text: chartData.xLabel,
        font: { color: '#a0a0a0' }
      },
      tickfont: { color: '#a0a0a0' },
      gridcolor: '#2a2a4a',
      linecolor: '#2a2a4a'
    },
    yaxis: {
      title: {
        text: chartData.yLabel,
        font: { color: '#a0a0a0' }
      },
      tickfont: { color: '#a0a0a0' },
      gridcolor: '#2a2a4a',
      linecolor: '#2a2a4a'
    },
    paper_bgcolor: '#1a1a2e',
    plot_bgcolor: '#1a1a2e',
    margin: { t: 60, r: 40, b: 60, l: 80 },
    autosize: true
  };

  // Plotly config
  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  };

  return (
    <div className="chart-container">
      <Plot
        data={[trace]}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
