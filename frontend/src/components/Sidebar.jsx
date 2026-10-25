import React, { useState } from 'react';
import { 
  Database, 
  ChevronRight, 
  ChevronDown, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  Code, 
  ShieldCheck, 
  Users, 
  Compass, 
  Plus,
  BarChart2,
  Cpu,
  FileSpreadsheet
} from 'lucide-react';

export default function Sidebar({ 
  tables = [],
  selectedTable,
  onSelectDataset,
  onSelectPrompt, 
  onOpenSqlPlayground, 
  onOpenQuality, 
  onLoadSample,
  onOpenUpload,
  onOpenPreview,
  loading 
}) {
  const [expandedTables, setExpandedTables] = useState({});

  const toggleTable = (tableName) => {
    setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  // Clean menu items: Icon and relatable text only
  const inquiryMenu = [
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
      label: "Top 5 Customers",
      query: "What are the top five customers?",
      icon: Users,
    },
    {
      label: "Anomaly Detection",
      query: "Detect anomalies in the dataset.",
      icon: Sparkles,
    },
    {
      label: "6-Month Forecast",
      query: "Forecast sales for the next 6 months.",
      icon: BarChart2,
    },
    {
      label: "SQL Query Generator",
      query: "Generate SQL for this analysis.",
      icon: Code,
    },
  ];

  return (
    <aside className="app-sidebar">
      {/* 1. DATASETS SECTION */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Datasets</span>
          <div className="sidebar-header-actions">
            <span className="sidebar-counter">{tables.length}</span>
            <button
              type="button"
              className="sidebar-add-btn"
              onClick={onOpenUpload}
              title="Add dataset"
              aria-label="Add dataset"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="sidebar-menu-list">
          {tables.length === 0 ? (
            <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              No tables loaded yet
            </div>
          ) : (
            tables.map(t => (
              <div key={t.table_name} className="sidebar-table-item">
                <button 
                  className={`sidebar-table-row ${selectedTable === t.table_name ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectDataset?.(t.table_name);
                    onOpenPreview?.(t);
                  }}
                  title="Click to preview CSV data"
                >
                  <Database size={13} className="menu-icon" />
                  <span className="table-name-text">{t.table_name}</span>
                  <span className="table-row-badge">{(t.row_count || 0).toLocaleString()}</span>
                  <span
                    className="dataset-expand-control"
                    onClick={event => {
                      event.stopPropagation();
                      toggleTable(t.table_name);
                    }}
                    title={expandedTables[t.table_name] ? 'Hide columns' : 'Show columns'}
                  >
                    {expandedTables[t.table_name] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </span>
                </button>

                {expandedTables[t.table_name] && (
                  <div className="sidebar-column-list">
                    {(t.columns || []).map(c => (
                      <div key={c.name} className="sidebar-col-item" title={`${c.name} (${c.type})`}>
                        <span className="col-bullet">•</span>
                        <span className="col-name">{c.name}</span>
                        <span className="col-type">{c.type.toLowerCase()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. ANALYTICAL INQUIRIES SECTION - Icon and Relatable Text Only */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Inquiries</span>
        </div>
        <div className="sidebar-menu-list">
          {inquiryMenu.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                className="sidebar-menu-btn"
                onClick={() => onSelectPrompt(item.query)}
                disabled={loading}
                title={item.query}
              >
                <Icon size={14} className="menu-icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TOOLS & WORKBENCH SECTION - Icon and Relatable Text Only */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Tools</span>
        </div>
        <div className="sidebar-menu-list">
          <button 
            className="sidebar-menu-btn" 
            onClick={onOpenSqlPlayground}
            title="DuckDB interactive SQL scratchpad"
          >
            <Cpu size={14} className="menu-icon" />
            <span>SQL Workbench</span>
          </button>
          
          <button 
            className="sidebar-menu-btn" 
            onClick={onOpenQuality}
            title="Inspect nulls, cardinality, and data health"
          >
            <ShieldCheck size={14} className="menu-icon menu-icon-emerald" />
            <span>Data Health Profiler</span>
          </button>
        </div>
      </div>

      {/* 4. DIGITAL BACK OFFICE FOOTER */}
      <div className="sidebar-footer">
        <div className="footer-status-indicator">
          <span className="pulse-dot" />
          <span className="footer-company-name">Digital Back Office Ltd</span>
        </div>
        <span className="footer-engine-label">DuckDB High-Performance Analytics</span>
      </div>
    </aside>
  );
}
