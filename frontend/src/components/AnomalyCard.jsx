import React, { useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, Activity } from 'lucide-react';

export default function AnomalyCard({ anomalies }) {
  const [showAll, setShowAll] = useState(false);

  if (!anomalies || anomalies.error) {
    return null;
  }

  const { method, column, anomaly_count, anomaly_pct, parameters, anomalies: outlierList } = anomalies;
  const displayList = showAll ? outlierList : outlierList?.slice(0, 4);

  return (
    <div className="anomaly-callout">
      <div className="anomaly-callout-header">
        <AlertOctagon size={18} />
        <span>Statistical Outlier Alert</span>
        <span className="anomaly-tag">{anomaly_count} Anomalies Detected ({anomaly_pct}%)</span>
      </div>

      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
        Evaluation Method: <strong style={{ color: 'var(--text-primary)' }}>{method}</strong> on column <code style={{ color: 'var(--accent-rose)' }}>{column}</code>.
        {parameters && (
          <span style={{ display: 'block', marginTop: '4px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Threshold bounds: Lower: {parameters.lower_bound ?? 'N/A'} | Upper: {parameters.upper_bound ?? 'N/A'}
          </span>
        )}
      </div>

      {outlierList && outlierList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayList?.map((item, idx) => (
            <div 
              key={idx} 
              style={{
                background: '#ffffff',
                border: '1px solid rgba(244, 63, 94, 0.18)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Row #{item.row_index} {item.record?.Order_ID ? `(${item.record.Order_ID})` : ''}: 
                  <span style={{ color: 'var(--accent-rose)', marginLeft: '6px' }}>
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                  {item.reason}
                </div>
              </div>
            </div>
          ))}

          {outlierList.length > 4 && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => setShowAll(!showAll)}
              style={{ alignSelf: 'flex-start', padding: '4px 8px', fontSize: '11px', color: 'var(--accent-rose)' }}
            >
              {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showAll ? 'Collapse' : `View all ${outlierList.length} anomalies`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
