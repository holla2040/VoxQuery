import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

/**
 * Surface plot result component using Plotly
 *
 * Renders 3D surface plots for data with two dimensions and one aggregate value.
 * Supports rotation and zoom for 3D interaction.
 */
export default function SurfaceResult({ surfaceConfig }) {
  const { x_values, y_values, z_matrix, x_column, y_column, z_column } = surfaceConfig || {};

  // Validate data
  const isValid = useMemo(() => {
    return (
      x_values && x_values.length >= 2 &&
      y_values && y_values.length >= 2 &&
      z_matrix && z_matrix.length >= 2 &&
      z_matrix[0] && z_matrix[0].length >= 2
    );
  }, [x_values, y_values, z_matrix]);

  if (!isValid) {
    return (
      <div className="chart-no-data">
        Insufficient data for surface plot visualization.
      </div>
    );
  }

  // Create numeric indices for x and y (Plotly surface requires numeric axes)
  const xIndices = x_values.map((_, i) => i);
  const yIndices = y_values.map((_, i) => i);

  // Plotly surface trace
  const trace = {
    type: 'surface',
    x: xIndices,
    y: yIndices,
    z: z_matrix,
    colorscale: 'Viridis',
    contours: {
      z: {
        show: true,
        usecolormap: true,
        highlightcolor: '#42f5ef',
        project: { z: true }
      }
    },
    // Custom hover text since we're using indices
    text: z_matrix.map((row, yi) =>
      row.map((_, xi) => `${x_column}: ${x_values[xi]}<br>${y_column}: ${y_values[yi]}`)
    ),
    hovertemplate: '%{text}<br>' + `${z_column}: %{z}<extra></extra>`
  };

  // Plotly layout with dark theme
  const layout = {
    title: {
      text: `${z_column} by ${x_column} and ${y_column}`,
      font: { color: '#eaeaea', size: 16 }
    },
    scene: {
      xaxis: {
        title: {
          text: x_column,
          font: { color: '#a0a0a0' }
        },
        tickfont: { color: '#a0a0a0', size: 10 },
        tickvals: xIndices,
        ticktext: x_values,
        gridcolor: '#2a2a4a',
        backgroundcolor: '#1a1a2e'
      },
      yaxis: {
        title: {
          text: y_column,
          font: { color: '#a0a0a0' }
        },
        tickfont: { color: '#a0a0a0', size: 10 },
        tickvals: yIndices,
        ticktext: y_values,
        gridcolor: '#2a2a4a',
        backgroundcolor: '#1a1a2e'
      },
      zaxis: {
        title: {
          text: z_column,
          font: { color: '#a0a0a0' }
        },
        tickfont: { color: '#a0a0a0' },
        gridcolor: '#2a2a4a',
        backgroundcolor: '#1a1a2e'
      },
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.2 }
      }
    },
    paper_bgcolor: '#1a1a2e',
    margin: { t: 60, r: 40, b: 40, l: 40 },
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
    <div className="chart-container surface-container">
      <Plot
        data={[trace]}
        layout={layout}
        config={config}
        useResizeHandler
        style={{ width: '100%', height: '100%', minHeight: '800px' }}
      />
    </div>
  );
}
