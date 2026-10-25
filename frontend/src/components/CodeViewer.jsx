import React, { useState } from 'react';
import { Code, Table as TableIcon, Copy, Check, Clock, Play, FileCode, Terminal } from 'lucide-react';

export default function CodeViewer({ 
  sqlQuery = '', 
  pandasCode = '', 
  queryResult = null, 
  onOpenWorkbench 
}) {
  const [activeTab, setActiveTab] = useState('sql');
  const [copied, setCopied] = useState(false);

  if (!sqlQuery && !pandasCode && (!queryResult || !queryResult.rows)) {
    return null;
  }

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns = queryResult?.columns || [];
  const rows = queryResult?.rows || [];
  const executionTime = queryResult?.execution_time_ms;

  return (
    <div className="code-tabs-container">
      <div className="code-tab-bar">
        {/* Tab 1: DuckDB SQL */}
        {sqlQuery && (
          <button 
            className={`code-tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <Code size={13} style={{ display: 'inline', marginRight: '5px' }} />
            DuckDB SQL
          </button>
        )}

        {/* Tab 2: Python Pandas */}
        {pandasCode && (
          <button 
            className={`code-tab-btn ${activeTab === 'pandas' ? 'active' : ''}`}
            onClick={() => setActiveTab('pandas')}
          >
            <FileCode size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Pandas (Python)
          </button>
        )}

        {/* Tab 3: Result Table */}
        {rows.length > 0 && (
          <button 
            className={`code-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            <TableIcon size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Data Table ({rows.length})
          </button>
        )}

        <div className="code-tab-action">
          {executionTime !== undefined && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} />
              {executionTime}ms
            </span>
          )}

          {activeTab === 'sql' && sqlQuery && (
            <>
              {onOpenWorkbench && (
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => onOpenWorkbench(sqlQuery)}
                  style={{ padding: '2px 7px', fontSize: '11px', color: 'var(--brand-teal)' }}
                  title="Open query in interactive SQL workbench"
                >
                  <Terminal size={12} />
                  Workbench
                </button>
              )}
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => handleCopy(sqlQuery)}
                style={{ padding: '2px 7px', fontSize: '11px' }}
              >
                {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy SQL'}
              </button>
            </>
          )}

          {activeTab === 'pandas' && pandasCode && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => handleCopy(pandasCode)}
              style={{ padding: '2px 7px', fontSize: '11px' }}
            >
              {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy Python'}
            </button>
          )}
        </div>
      </div>

      {/* SQL Tab Content */}
      {activeTab === 'sql' && sqlQuery && (
        <pre className="code-content-block">
          <code>{sqlQuery}</code>
        </pre>
      )}

      {/* Pandas Python Tab Content */}
      {activeTab === 'pandas' && pandasCode && (
        <pre className="code-content-block">
          <code>{pandasCode}</code>
        </pre>
      )}

      {/* Result Table Tab Content */}
      {activeTab === 'table' && rows.length > 0 && (
        <div className="data-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, rIdx) => (
                <tr key={rIdx}>
                  {columns.map(col => (
                    <td key={col}>
                      {typeof row[col] === 'number' 
                        ? row[col].toLocaleString(undefined, { maximumFractionDigits: 2 }) 
                        : String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Showing first 50 of {rows.length} rows.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
