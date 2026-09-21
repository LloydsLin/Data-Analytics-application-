import React, { useState } from 'react';
import { Database, Key, Download, RotateCcw, Sparkles, Upload, FileText, CheckCircle2 } from 'lucide-react';

export default function Header({ 
  tableCount, 
  onOpenUpload, 
  onLoadSample, 
  onOpenApiKey, 
  onOpenQuality, 
  onReset, 
  loading 
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const res = await fetch(`/api/export/report?format=${format}`);
      if (format === 'markdown') {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DBO_AI_Analyst_Report_${new Date().toISOString().slice(0,10)}.md`;
        a.click();
      } else {
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DBO_AI_Analyst_Report_${new Date().toISOString().slice(0,10)}.html`;
        a.click();
      }
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand-badge">
          <Sparkles size={18} />
        </div>
        <div className="brand-title">
          Digital Back Office
          <span className="brand-subtitle">AI Data Analyst</span>
        </div>

        {tableCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <span className="pulse-indicator" />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {tableCount} table{tableCount > 1 ? 's' : ''} active in DuckDB
            </span>
          </div>
        )}
      </div>

      <div className="header-right">
        {tableCount === 0 && (
          <button 
            className="btn btn-primary btn-sm" 
            onClick={onLoadSample}
            disabled={loading}
          >
            <Sparkles size={14} />
            Load Sample Dataset
          </button>
        )}

        <button className="btn btn-secondary btn-sm" onClick={onOpenUpload}>
          <Upload size={14} />
          Upload CSVs
        </button>

        <button className="btn btn-secondary btn-sm" onClick={onOpenApiKey} title="Configure Gemini API Key">
          <Key size={14} />
          Gemini API Key
        </button>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => handleExport('html')}
            disabled={exporting}
            title="Download Executive HTML Report"
          >
            <Download size={14} />
            Export HTML
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => handleExport('markdown')}
            disabled={exporting}
            title="Download Executive Markdown Report"
          >
            <FileText size={14} />
            Export MD
          </button>
        </div>

        {tableCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={onReset} title="Reset session and clear memory">
            <RotateCcw size={14} />
            Reset
          </button>
        )}
      </div>
    </header>
  );
}
