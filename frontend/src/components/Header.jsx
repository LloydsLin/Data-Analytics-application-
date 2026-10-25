import React, { useState } from 'react';
import { Database, Key, Download, RotateCcw, Sparkles, Upload, FileText, CheckCircle2, Plus } from 'lucide-react';

export default function Header({ 
  tableCount, 
  onOpenUpload, 
  onLoadSample, 
  onOpenApiKey, 
  onOpenQuality, 
  onOpenExport,
  onReset, 
  loading 
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const sessionId = localStorage.getItem('dbo_session_id') || 'default';
      const res = await fetch(`/api/export/report?format=${format}`, {
        headers: { 'x-session-id': sessionId }
      });
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
          <Sparkles size={16} />
        </div>
        <div className="brand-title">
          Digital Back Office
          <span className="brand-subtitle">AI Analyst</span>
        </div>

        <div className="header-status-pill">
          <span className="pulse-indicator" />
          <span>{tableCount > 0 ? `DuckDB: ${tableCount} table${tableCount > 1 ? 's' : ''} loaded` : 'DuckDB: Ready'}</span>
        </div>
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


        <button className="btn btn-secondary btn-sm" onClick={onOpenApiKey} title="Configure Gemini API Key">
          <Key size={14} />
          Gemini API Key
        </button>

        <button 
          className="btn btn-secondary btn-sm" 
          onClick={onOpenExport}
          title="Export official Executive Intelligence Dossier (PDF / HTML / Markdown)"
        >
          <Download size={14} color="var(--brand-teal)" />
          Export Briefing
        </button>

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
