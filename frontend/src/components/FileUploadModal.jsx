import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function FileUploadModal({ isOpen, onClose, onUploadSuccess, onLoadSample }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFiles = (files) => {
    setError('');
    const valid = [];
    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.csv')) {
        setError(`"${f.name}" is not a CSV file.`);
        return;
      }
      valid.push(f);
    }
    setSelectedFiles(prev => [...prev, ...valid]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    selectedFiles.forEach(f => {
      formData.append('files', f);
    });

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Upload failed');
      }
      const data = await res.json();
      onUploadSuccess(data.all_tables);
      onClose();
    } catch (err) {
      setError(err.message || 'Error uploading files.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Upload Datasets (CSV)</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid var(--accent-rose)',
            color: '#fb7185',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div
          className={`dropzone ${isDragOver ? 'active' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            multiple
            accept=".csv"
            onChange={e => handleFiles(Array.from(e.target.files))}
          />
          <Upload size={36} color="var(--accent-indigo)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Drag & drop your CSV files here
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Supports multi-file uploads (e.g. Sales, Customers, Products) up to 50MB
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Selected Files ({selectedFiles.length}):
            </div>
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={15} color="var(--accent-indigo)" />
                  <span>{file.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => removeFile(idx)}
                  style={{ padding: '2px 6px' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onLoadSample();
              onClose();
            }}
          >
            <Sparkles size={13} color="var(--accent-indigo)" />
            Load Sample Datasets Instead
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleUploadSubmit}
              disabled={selectedFiles.length === 0 || uploading}
            >
              {uploading ? 'Processing...' : `Ingest ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
