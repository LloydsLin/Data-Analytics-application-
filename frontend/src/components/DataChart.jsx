import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { BarChart3 } from 'lucide-react';

export default function DataChart({ chartSpec }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !chartSpec) return;

    const { type, title, traces, x, y, labels, values } = chartSpec;
    let data = [];

    if (traces && traces.length > 0) {
      data = traces.map(t => ({
        ...t,
        type: t.type || type || 'bar',
      }));
    } else if (type === 'pie') {
      data = [{
        type: 'pie',
        labels: labels || x || [],
        values: values || y || [],
        hole: 0.35,
        marker: {
          colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6']
        },
        textinfo: 'label+percent',
        hoverinfo: 'label+value+percent',
      }];
    } else if (type === 'line') {
      data = [{
        type: 'scatter',
        mode: 'lines+markers',
        x: x || [],
        y: y || [],
        line: { color: '#6366f1', width: 3 },
        marker: { size: 7, color: '#818cf8' },
        fill: 'tozeroy',
        fillcolor: 'rgba(99, 102, 241, 0.08)'
      }];
    } else {
      data = [{
        type: 'bar',
        x: x || [],
        y: y || [],
        marker: {
          color: '#6366f1',
          opacity: 0.9,
          line: { color: '#818cf8', width: 1 }
        }
      }];
    }

    const layout = {
      title: {
        text: title || 'Visualization',
        font: { family: 'Outfit, sans-serif', size: 15, color: '#f8fafc' },
        x: 0.03,
        y: 0.94
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { t: 50, r: 25, l: 55, b: 50 },
      autosize: true,
      font: { family: 'Inter, sans-serif', color: '#94a3b8', size: 11 },
      xaxis: {
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { size: 10.5, color: '#94a3b8' }
      },
      yaxis: {
        gridcolor: 'rgba(255, 255, 255, 0.06)',
        zerolinecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { size: 10.5, color: '#94a3b8' }
      },
      legend: {
        font: { color: '#cbd5e1', size: 11 },
        bgcolor: 'transparent',
        orientation: 'h',
        y: -0.22
      },
      hoverlabel: {
        bgcolor: '#1e293b',
        bordercolor: '#6366f1',
        font: { family: 'Inter, sans-serif', color: '#ffffff', size: 12 }
      }
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'DBO_Analytics_Chart',
        height: 500,
        width: 800,
        scale: 2
      }
    };

    Plotly.newPlot(chartRef.current, data, layout, config);

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current) {
        Plotly.Plots.resize(chartRef.current);
      }
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        Plotly.purge(chartRef.current);
      }
    };
  }, [chartSpec]);

  return (
    <div style={{
      background: 'rgba(12, 16, 23, 0.85)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '12px 14px 8px',
      marginTop: '16px',
      marginBottom: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <BarChart3 size={15} color="var(--accent-indigo)" />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          INTERACTIVE VISUALIZATION
        </span>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '330px' }} />
    </div>
  );
}
