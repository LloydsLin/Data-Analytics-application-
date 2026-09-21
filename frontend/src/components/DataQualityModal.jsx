import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, CheckCircle2, FileSpreadsheet, HardDrive, Copy } from 'lucide-react';

export default function DataQualityModal({ isOpen, onClose, tables }) {
  const [selectedTable, setSelectedTable] = useState(tables[0]?.table_name || '');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].table_name);
    }
  }, [tables]);

  useEffect(() => {
    if (!isOpen || !selectedTable) return;
    fetchQuality(selectedTable);
  }, [isOpen, selectedTable]);

  const fetchQuality = async (tableName) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/${tableName}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '850px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="var(--accent-emerald)" />
            <div className="modal-title">Data Quality & Schema Audit</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Table Selector */}
        {tables.length > 1 && (
          <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target Table:</span>
            <select
              value={selectedTable}
              onChange={e => setSelectedTable(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-medium)',
                color: '#fff',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12.5px',
                outline: 'none'
              }}
            >
              {tables.map(t => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name} ({t.row_count} rows)
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Profiling dataset attributes...
          </div>
        ) : profile ? (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health Score</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '4px' }}>
                  {profile.health_score}%
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Records</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {profile.total_rows.toLocaleString()}
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Columns</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {profile.total_columns}
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duplicates</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: profile.duplicate_rows > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)', marginTop: '4px' }}>
                  {profile.duplicate_rows} ({profile.duplicate_pct}%)
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px'
            }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--accent-indigo)', marginBottom: '6px' }}>
                DATA HYGIENE RECOMMENDATIONS:
              </div>
              {profile.recommendations.map((rec, idx) => (
                <div key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={13} color="var(--accent-emerald)" />
                  {rec}
                </div>
              ))}
            </div>

            {/* Column Breakdown Table */}
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Missing</th>
                    <th>Unique</th>
                    <th>Distribution / Stats</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.columns.map(c => (
                    <tr key={c.name}>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{c.name}</td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          background: c.type === 'numeric' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: c.type === 'numeric' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {c.type}
                        </span>
                      </td>
                      <td style={{ color: c.null_count > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                        {c.null_count} ({c.null_pct}%)
                      </td>
                      <td>{c.unique_count}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {c.stats ? (
                          `Min: ${c.stats.min} | Med: ${c.stats.median} | Max: ${c.stats.max}`
                        ) : c.top_values ? (
                          c.top_values.slice(0, 2).map(v => `${v.value} (${v.percentage}%)`).join(', ')
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
