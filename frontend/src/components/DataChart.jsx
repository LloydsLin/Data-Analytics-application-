import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { BarChart2, TrendingUp, PieChart, ScatterChart } from 'lucide-react';

export default function DataChart({ chartSpec, anomalies = null }) {
  const chartRef = useRef(null);
  const supportedTypes = ['bar', 'line', 'scatter', 'pie'];
  const initialType = supportedTypes.includes(chartSpec?.type) ? chartSpec.type : 'bar';
  const [currentType, setCurrentType] = useState(initialType);

  useEffect(() => {
    if (!chartRef.current || !chartSpec) return;

    const { title, traces, x, y, labels, values } = chartSpec;
    let data = [];

    // Color palette matching Digital Back Office brand
    const brandTeal = '#30baba';
    const brandEmerald = '#10b981';
    const brandPalette = ['#30baba', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6', '#f43f5e'];

    // Check if we should render as Pie / Donut
    if (currentType === 'pie') {
      const pieLabels = labels || x || (traces && traces[0] ? traces[0].x : []);
      const pieValues = values || y || (traces && traces[0] ? traces[0].y : []);
      data = [{
        type: 'pie',
        labels: pieLabels,
        values: pieValues,
        hole: 0.4,
        marker: { colors: brandPalette },
        textinfo: 'label+percent',
        hoverinfo: 'label+value+percent',
      }];
    } 
    // Render as line, area, or scatter chart
    else if (['line', 'scatter'].includes(currentType)) {
      if (traces && traces.length > 0) {
        data = traces.map((t, idx) => ({
          ...t,
          type: 'scatter',
          mode: currentType === 'scatter' ? 'markers' : 'lines+markers',
          line: { color: idx === 0 ? brandTeal : (t.line?.color || brandEmerald), width: 2.5 },
          marker: { size: 6 },
          fill: undefined,
        }));
      } else {
        data = [{
          type: 'scatter',
          mode: currentType === 'scatter' ? 'markers' : 'lines+markers',
          x: x || [],
          y: y || [],
          line: { color: brandTeal, width: 2.5 },
          marker: { size: 6, color: '#269d9d' },
          fill: undefined,
        }];
      }
    } 
    // Render as Bar Chart (Default)
    else {
      if (traces && traces.length > 0) {
        data = traces.map((t, idx) => ({
          ...t,
          type: 'bar',
          marker: {
            color: idx === 0 ? brandTeal : (t.marker?.color || brandEmerald),
            opacity: 0.9
          }
        }));
      } else {
        data = [{
          type: 'bar',
          x: x || [],
          y: y || [],
          marker: {
            color: brandTeal,
            opacity: 0.9,
            line: { color: '#269d9d', width: 1 }
          }
        }];
      }
    }

    const layout = {
      title: {
        text: title || 'Visualization',
        font: { family: 'Manrope, sans-serif', size: 13.5, color: '#121519' },
        x: 0.02,
        y: 0.96
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { t: 40, r: 15, l: 50, b: 40 },
      autosize: true,
      font: { family: 'Manrope, Inter, sans-serif', color: '#576071', size: 11 },
      xaxis: {
        gridcolor: 'rgba(48, 186, 186, 0.08)',
        zerolinecolor: 'rgba(48, 186, 186, 0.15)',
        tickfont: { size: 10, color: '#576071' }
      },
      yaxis: {
        gridcolor: 'rgba(48, 186, 186, 0.08)',
        zerolinecolor: 'rgba(48, 186, 186, 0.15)',
        tickfont: { size: 10, color: '#576071' }
      },
      legend: {
        font: { color: '#576071', size: 10.5 },
        bgcolor: 'transparent',
        orientation: 'h',
        y: -0.22
      },
      hoverlabel: {
        bgcolor: '#ffffff',
        bordercolor: '#30baba',
        font: { family: 'Manrope, sans-serif', color: '#121519', size: 11.5 }
      }
    };

    const config = {
      responsive: true,
      displayModeBar: false, // We provide our own clean switcher
    };

    Plotly.newPlot(chartRef.current, data, layout, config);

    const handleResize = () => {
      if (chartRef.current) Plotly.Plots.resize(chartRef.current);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [chartSpec, currentType]);

  if (!chartSpec) return null;

  // Extract tabular data for Table View
  const xValues = chartSpec.x || (chartSpec.traces && chartSpec.traces[0] ? chartSpec.traces[0].x : []);
  const yValues = chartSpec.y || (chartSpec.traces && chartSpec.traces[0] ? chartSpec.traces[0].y : []);

  return (
    <div className="chart-card-container">
      {/* Interactive Switcher Toolbar */}
      <div className="chart-toolbar">
        <span className="chart-title-text">{chartSpec.title || 'Interactive Visualization'}</span>

        <div className="chart-type-toggle-group">
          <button 
            className={`chart-type-btn ${currentType === 'bar' ? 'active' : ''}`}
            onClick={() => setCurrentType('bar')}
            title="Switch to Bar Chart"
          >
            <BarChart2 size={13} />
            <span>Bar</span>
          </button>
          <button 
            className={`chart-type-btn ${currentType === 'scatter' ? 'active' : ''}`}
            onClick={() => setCurrentType('scatter')}
            title="Switch to Scatter Plot"
          >
            <ScatterChart size={13} />
            <span>Scatter</span>
          </button>
          <button 
            className={`chart-type-btn ${currentType === 'line' ? 'active' : ''}`}
            onClick={() => setCurrentType('line')}
            title="Switch to Line Chart"
          >
            <TrendingUp size={13} />
            <span>Line</span>
          </button>
          <button 
            className={`chart-type-btn ${currentType === 'pie' ? 'active' : ''}`}
            onClick={() => setCurrentType('pie')}
            title="Switch to Donut / Pie"
          >
            <PieChart size={13} />
            <span>Pie</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas or Table View */}
      <div ref={chartRef} style={{ width: '100%', height: '320px' }} />
    </div>
  );
}
