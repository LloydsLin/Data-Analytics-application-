import React, { useState } from 'react';
import { Code, Table as TableIcon, Copy, Check, Clock, Rows } from 'lucide-react';

export default function CodeViewer({ sqlQuery, queryResult }) {
  const [activeTab, setActiveTab] = useState('sql');
  const [copied, setCopied] = useState(false);

  if (!sqlQuery && (!queryResult || !queryResult.rows)) {
    return null;
  }

  const handleCopy = () => {
    if (!sqlQuery) return;
    navigator.clipboard.writeText(sqlQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns = queryResult?.columns || [];
  const rows = queryResult?.rows || [];
  const executionTime = queryResult?.execution_time_ms;

  return (
    <div className="code-tabs-container">
      <div className="code-tab-bar">
        {sqlQuery && (
          <button 
            className={`code-tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <Code size={13} style={{ display: 'inline', marginRight: '5px' }} />
            DuckDB SQL
          </button>
        )}

        {rows.length > 0 && (
          <button 
            className={`code-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            <TableIcon size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Result Table ({rows.length})
          </button>
        )}

        <div className="code-tab-action">
          {executionTime !== undefined && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} />
              {executionTime}ms
            </span>
          )}

          {sqlQuery && activeTab === 'sql' && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleCopy}
              style={{ padding: '3px 8px', fontSize: '11px' }}
            >
              {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy SQL'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'sql' && sqlQuery && (
        <pre className="code-content-block">
          <code>{sqlQuery}</code>
        </pre>
      )}

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
