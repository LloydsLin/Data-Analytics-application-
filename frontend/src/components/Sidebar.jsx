import React, { useState } from 'react';
import { 
  Database, 
  Table, 
  ChevronRight, 
  ChevronDown, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  Code, 
  ShieldCheck, 
  PieChart,
  Users,
  Compass
} from 'lucide-react';

export default function Sidebar({ 
  tables, 
  onSelectPrompt, 
  onOpenSqlPlayground, 
  onOpenQuality, 
  onLoadSample,
  loading 
}) {
  const [expandedTables, setExpandedTables] = useState({});

  const toggleTable = (tableName) => {
    setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  const assignmentQuestions = [
    {
      label: "Regional Revenue",
      query: "Which region generated the highest revenue?",
      icon: Compass,
    },
    {
      label: "Monthly Sales Trends",
      query: "Show monthly sales trends.",
      icon: TrendingUp,
    },
    {
      label: "Underperforming Products",
      query: "Which products are underperforming?",
      icon: AlertTriangle,
    },
    {
      label: "Top 5 Customers (JOIN)",
      query: "What are the top five customers?",
      icon: Users,
    },
    {
      label: "Detect Anomalies",
      query: "Detect anomalies in the dataset.",
      icon: AlertTriangle,
    },
    {
      label: "Generate SQL Query",
      query: "Generate SQL for this analysis.",
      icon: Code,
    },
  ];

  return (
    <aside className="app-sidebar">
      {/* Datasets Section */}
      <div className="sidebar-section">
        <div className="sidebar-title">
          <span>Active Datasets ({tables.length})</span>
          {tables.length > 0 && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={onOpenQuality}
              style={{ fontSize: '11px', padding: '2px 6px' }}
              title="View Data Health & Quality"
            >
              <ShieldCheck size={13} color="var(--accent-emerald)" />
              Quality
            </button>
          )}
        </div>

        {tables.length === 0 ? (
          <div style={{
            padding: '16px',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              No tables registered in memory.
            </p>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={onLoadSample}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <Sparkles size={13} />
              Load Sample Dataset
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tables.map(t => (
              <div key={t.table_name} className="dataset-card">
                <div 
                  className="dataset-header" 
                  onClick={() => toggleTable(t.table_name)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div className="dataset-name">
                    {expandedTables[t.table_name] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Table size={14} color="var(--accent-indigo)" />
                    {t.table_name}
                  </div>
                  <span className="dataset-badge">
                    {t.row_count.toLocaleString()} rows
                  </span>
                </div>

                {expandedTables[t.table_name] && (
                  <div className="column-tag-list">
                    {t.columns.map(c => (
                      <span key={c.name} className="column-tag" title={`Type: ${c.type}`}>
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Questions Section */}
      <div className="sidebar-section">
        <div className="sidebar-title">
          <span>Analytical Questions</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {assignmentQuestions.map((q, idx) => {
            const Icon = q.icon;
            return (
              <button
                key={idx}
                className="quick-prompt-btn"
                onClick={() => onSelectPrompt(q.query)}
                disabled={loading}
              >
                <Icon size={15} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--accent-indigo)' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{q.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{q.query}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Analyst Tools Section */}
      <div className="sidebar-section" style={{ marginTop: 'auto' }}>
        <div className="sidebar-title">
          <span>Analyst Tools</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={onOpenSqlPlayground}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <Code size={14} color="var(--accent-indigo)" />
            DuckDB SQL Playground
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={onOpenQuality}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <ShieldCheck size={14} color="var(--accent-emerald)" />
            Data Quality & Profiling
          </button>
        </div>
      </div>
    </aside>
  );
}
