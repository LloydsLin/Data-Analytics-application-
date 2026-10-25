import React, { useEffect, useState } from 'react';
import { X, FileSpreadsheet, Loader2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import SimpleDialog from './SimpleDialog';
import CsvTable from './CsvTable';

export default function DatasetPreviewModal({ isOpen, table, onClose }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !table?.table_name) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setPreview(null);
    apiRequest(`/datasets/${encodeURIComponent(table.table_name)}/preview?limit=100`)
      .then(data => { if (!cancelled) setPreview(data); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, table?.table_name]);

  if (!isOpen || !table) return null;

  return (
    <SimpleDialog isOpen={isOpen} onClose={onClose} labelledBy="dataset-preview-title" className="dataset-preview-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={19} color="var(--brand-teal)" />
            <div>
              <div className="modal-title" id="dataset-preview-title">{table.table_name}</div>
              <div className="dataset-preview-meta">{table.original_filename} · {Number(table.row_count || 0).toLocaleString()} rows</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close preview"><X size={18} /></button>
        </div>

        {loading && <div className="dataset-preview-state"><Loader2 size={18} className="animate-spin" /> Loading rows...</div>}
        {error && <div className="dataset-preview-state dataset-preview-error">{error}</div>}
        {preview && (
          <div className="dataset-preview-table-wrap">
            <CsvTable columns={preview.columns} rows={preview.rows} />
            <div className="dataset-preview-footer">Showing {preview.rows.length} of {Number(preview.row_count || 0).toLocaleString()} rows</div>
          </div>
        )}
    </SimpleDialog>
  );
}
