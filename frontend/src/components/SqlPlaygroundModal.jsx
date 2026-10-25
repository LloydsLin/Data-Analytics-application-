import React, { useState } from 'react';
import { X, Play, Code, Clock, Table, AlertCircle } from 'lucide-react';

export default function SqlPlaygroundModal({ isOpen, onClose, tables, selectedTable }) {
  const defaultQuery = tables.length > 0 
    ? `SELECT * FROM ${selectedTable || tables[0].table_name} LIMIT 10;`
    : `SELECT 1 AS test;`;

  const [sql, setSql] = useState(defaultQuery);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setRunning(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/sql/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': localStorage.getItem('dbo_session_id') || 'default'
        },
        body: JSON.stringify({ query: sql })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'SQL Execution failed.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const sampleQueries = [
    {
      label: "Regional Summary",
      query: `SELECT * FROM ${selectedTable || tables[0]?.table_name || 'sales'} LIMIT 10;`
    },
    {
      label: "Top 5 Customers Join",
      query: `SELECT c.Customer_Name, ROUND(SUM(s.Revenue), 2) AS Total_Spent FROM ${tables[0]?.table_name || 'sales'} s JOIN ${tables[1]?.table_name || 'customers'} c ON s.Customer_ID = c.Customer_ID GROUP BY c.Customer_Name ORDER BY Total_Spent DESC LIMIT 5;`
    },
    {
      label: "Anomalies Over £10k",
      query: `SELECT Order_ID, Region, Quantity, Revenue, Profit FROM ${tables[0]?.table_name || 'sales'} WHERE Revenue > 10000 ORDER BY Revenue DESC;`
    }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code size={20} color="var(--accent-indigo)" />
            <div className="modal-title">DuckDB SQL Playground</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Quick Sample Queries */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
            Quick Templates:
          </span>
          {sampleQueries.map((item, idx) => (
            <button
              key={idx}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => setSql(item.query)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <textarea
            value={sql}
            onChange={e => setSql(e.target.value)}
            style={{
              width: '100%',
              height: '110px',
              background: '#f8fafc',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              color: '#121519',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              outline: 'none',
              resize: 'vertical'
            }}
            placeholder="Type standard DuckDB SQL..."
          />
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            DuckDB SQL Engine (Read-only execution mode)
          </div>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleExecute}
            disabled={running}
          >
            <Play size={14} />
            {running ? 'Executing...' : 'Run Query'}
          </button>
        </div>

        {/* Errors */}
        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid var(--accent-rose)',
            color: '#fb7185',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderBottom: 'none',
              borderTopLeftRadius: 'var(--radius-md)',
              borderTopRightRadius: 'var(--radius-md)',
              fontSize: '11.5px',
              color: 'var(--text-secondary)'
            }}>
              <span>Returned <strong>{result.total_rows}</strong> row{result.total_rows !== 1 ? 's' : ''}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                {result.execution_time_ms} ms
              </span>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              border: '1px solid var(--border-subtle)',
              borderBottomLeftRadius: 'var(--radius-md)',
              borderBottomRightRadius: 'var(--radius-md)',
              maxHeight: '260px',
              background: '#090d15'
            }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    {result.columns.map(c => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {result.columns.map(c => (
                        <td key={c}>
                          {typeof row[c] === 'number' ? row[c].toLocaleString() : String(row[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
