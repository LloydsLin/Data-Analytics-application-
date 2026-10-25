import { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { inspectCsv, CSV_LIMITS } from '../lib/csv';
import SimpleDialog from './SimpleDialog';
import CsvTable from './CsvTable';

export default function FileUploadModal({ isOpen, onClose, onUploadSuccess, onLoadSample }) {
  const [entries, setEntries] = useState([]);
  const [active, setActive] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);
  const entriesRef = useRef([]);
  const update = items => { entriesRef.current = items; setEntries(items); };
  const close = () => {
    if (uploading) return;
    update([]); setActive(null); setError(''); onClose();
  };
  const addFiles = files => {
    if (uploading) return;
    setError('');
    const next = [...entriesRef.current];
    const added = [];
    for (const file of files) {
      if (next.some(entry => entry.file.name.toLowerCase() === file.name.toLowerCase())) continue;
      if (next.length >= CSV_LIMITS.files) { setError('Upload up to 10 files at a time.'); break; }
      const issue = !file.name.toLowerCase().endsWith('.csv') ? 'Choose a CSV file.'
        : file.size === 0 ? 'This file is empty.'
        : file.size > CSV_LIMITS.bytes ? 'Use a file smaller than 50 MB.' : '';
      const entry = { id: crypto.randomUUID(), file, status: issue ? 'error' : 'checking', error: issue };
      next.push(entry); added.push(entry);
    }
    update(next);
    setActive(previous => previous || next[0]?.id || null);
    for (const entry of added.filter(item => item.status === 'checking')) {
      inspectCsv(entry.file).then(preview => {
        update(entriesRef.current.map(item => item.id === entry.id ? { ...item, preview, status: 'ready' } : item));
      }).catch(issue => {
        update(entriesRef.current.map(item => item.id === entry.id ? { ...item, status: 'error', error: issue.message } : item));
      });
    }
  };
  const remove = id => {
    const next = entriesRef.current.filter(entry => entry.id !== id);
    update(next);
    if (active === id) setActive(next[0]?.id || null);
  };
  const submit = async () => {
    if (!entries.length || entries.some(entry => entry.status !== 'ready') || uploading) return;
    setUploading(true); setError('');
    try {
      const form = new FormData();
      entries.forEach(entry => form.append('files', entry.file));
      const data = await apiRequest('/upload', { method: 'POST', body: form });
      onUploadSuccess(data.all_tables, data.tables, data.message);
      if (data.errors?.length) {
        const failed = new Map(data.errors.map(item => [item.filename, item.error]));
        const next = entriesRef.current.filter(item => failed.has(item.file.name)).map(item => ({ ...item, status: 'error', error: failed.get(item.file.name) }));
        update(next); setActive(next[0]?.id || null);
        setError('Some files could not be uploaded.');
      } else {
        update([]); setActive(null); onClose();
      }
    } catch (issue) { setError(issue.message); }
    finally { setUploading(false); }
  };
  const selected = entries.find(entry => entry.id === active);
  const ready = entries.length > 0 && entries.every(entry => entry.status === 'ready');
  return (
    <SimpleDialog isOpen={isOpen} onClose={close} busy={uploading} labelledBy="upload-title" className="upload-dialog">
      <div className="modal-header"><h2 id="upload-title">Upload CSV</h2>
        <button className="btn btn-ghost" onClick={close} disabled={uploading} aria-label="Close upload"><X size={18} /></button>
      </div>
      <div className="upload-body">
        {error && <p role="alert" className="inline-error">{error}</p>}
        <button className={`dropzone upload-dropzone ${dragOver ? 'active' : ''}`} disabled={uploading}
          onClick={() => fileInput.current?.click()}
          onDragOver={event => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={event => { event.preventDefault(); setDragOver(false); addFiles(Array.from(event.dataTransfer.files)); }}>
          <Upload size={24} /><strong>Drop CSV files or browse</strong><span>Up to 10 files · 50 MB each</span>
        </button>
        <input ref={fileInput} type="file" multiple accept=".csv,text/csv" hidden onChange={event => {
          addFiles(Array.from(event.target.files)); event.target.value = '';
        }} />
        {entries.length > 0 && <div className="upload-file-list">{entries.map(entry => (
          <div className={`upload-file ${active === entry.id ? 'selected' : ''}`} key={entry.id}>
            <button onClick={() => setActive(entry.id)} className="upload-file-select">
              <FileSpreadsheet size={17} /><span><strong>{entry.file.name}</strong>
                <small>{entry.error || (entry.preview ? `${entry.preview.rowCount.toLocaleString()} rows · ${entry.preview.columns.length} columns` : 'Checking CSV…')}</small></span>
              {entry.status === 'ready' ? <Check size={16} /> : entry.status === 'error' ? <AlertCircle size={16} /> : <Loader2 className="animate-spin" size={16} />}
            </button>
            <button className="btn btn-ghost" disabled={uploading} onClick={() => remove(entry.id)} aria-label={`Remove ${entry.file.name}`}><X size={15} /></button>
          </div>
        ))}</div>}
        {selected?.preview && <section className="upload-preview-panel" aria-label="File preview">
          <div className="upload-preview-header">Preview · first {selected.preview.rows.length} rows</div>
          <CsvTable columns={selected.preview.columns} rows={selected.preview.rows} />
        </section>}
      </div>
      <div className="dialog-footer">
        <button className="btn btn-ghost" disabled={uploading} onClick={() => { onLoadSample(); close(); }}>Try sample data</button>
        <button className="btn btn-primary" disabled={!ready || uploading} onClick={submit}>
          {uploading ? <><Loader2 className="animate-spin" size={14} /> Uploading…</> : `Upload${entries.length ? ` ${entries.length} file${entries.length === 1 ? '' : 's'}` : ''}`}
        </button>
      </div>
    </SimpleDialog>
  );
}
