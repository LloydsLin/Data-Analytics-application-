import React, { useState } from 'react';
import { X, Download, FileText, Printer, Check, Sparkles, ShieldCheck } from 'lucide-react';

export default function ReportExportModal({ isOpen, onClose, messages = [] }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Filter assistant messages with substantive analytical content
  const analyticalReports = messages.filter(m => m.role === 'assistant' && m.content);

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Generate clean consolidated Markdown report
  const generateMarkdownReport = () => {
    let md = `# Digital Back Office Ltd. - Executive Intelligence Dossier\n`;
    md += `**Date:** ${currentDate}\n`;
    md += `**Engine:** DuckDB In-Memory High-Performance Analytics\n`;
    md += `**Confidentiality:** Strictly Confidential & Proprietary\n\n`;
    md += `---\n\n`;

    analyticalReports.forEach((report, idx) => {
      md += `## Section ${idx + 1}: ${report.content.split('\n')[0].replace(/^[#\s|]+/, '').trim() || 'Analysis'}\n\n`;
      md += `${report.content}\n\n`;
      if (report.sql_query) {
        md += `\`\`\`sql\n${report.sql_query}\n\`\`\`\n\n`;
      }
      if (report.pandas_code) {
        md += `\`\`\`python\n${report.pandas_code}\n\`\`\`\n\n`;
      }
      md += `---\n\n`;
    });

    md += `*Generated automatically by Digital Back Office AI Analyst Platform.*`;
    return md;
  };

  const handleDownloadMarkdown = () => {
    const mdContent = generateMarkdownReport();
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DBO_Executive_Dossier_${new Date().toISOString().slice(0, 10)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMarkdown = () => {
    const mdContent = generateMarkdownReport();
    navigator.clipboard.writeText(mdContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintHTML = () => {
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Digital Back Office Ltd - Executive Dossier</title>
  <style>
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      margin: 40px;
      color: #1e293b;
      line-height: 1.6;
    }
    .header {
      border-bottom: 2px solid #30baba;
      padding-bottom: 16px;
      margin-bottom: 28px;
    }
    .org-title {
      font-size: 24px;
      font-weight: 800;
      color: #30baba;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 14px;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      background: rgba(48, 186, 186, 0.1);
      color: #30baba;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      margin-top: 8px;
    }
    h2, h3 {
      color: #0f172a;
      margin-top: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
      overflow-x: auto;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="org-title">Digital Back Office Ltd.</div>
    <div class="subtitle">Corporate AI Intelligence Dossier | Date: ${currentDate}</div>
    <div class="badge">Executive Verified | DuckDB Engine</div>
  </div>

  ${analyticalReports.map((report, idx) => `
    <div style="margin-bottom: 30px;">
      <h2>Inquiry ${idx + 1} Analysis</h2>
      <div>${report.content.replace(/\n/g, '<br/>')}</div>
      ${report.sql_query ? `<h3>Executed DuckDB SQL:</h3><pre><code>${report.sql_query}</code></pre>` : ''}
      ${report.pandas_code ? `<h3>Equivalent Python Pandas Code:</h3><pre><code>${report.pandas_code}</code></pre>` : ''}
    </div>
  `).join('')}

  <div class="footer">
    Digital Back Office Ltd. | Confidential Analytical Document | London, United Kingdom
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlReport);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--brand-teal)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--brand-teal)' }}>
              Export Executive Intelligence Dossier
            </h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Generate and export a consolidated briefing report of all analytical inquiries, SQL executions, Pandas code snippets, and commercial findings in this session.
          </p>

          <div style={{
            background: 'rgba(48, 186, 186, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Session Inquiries
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {analyticalReports.length} analytical outputs recorded
              </div>
            </div>
            <span className="dbo-verified-badge">
              <ShieldCheck size={11} />
              DBO Verified
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {/* Action 1: Print / PDF HTML */}
            <button 
              className="btn btn-primary"
              onClick={handlePrintHTML}
              style={{ width: '100%', justifyContent: 'center', padding: '9px 14px' }}
            >
              <Printer size={15} />
              Print / Save as Corporate PDF
            </button>

            {/* Action 2: Download Markdown */}
            <button 
              className="btn btn-secondary"
              onClick={handleDownloadMarkdown}
              style={{ width: '100%', justifyContent: 'center', padding: '9px 14px' }}
            >
              <Download size={15} />
              Download Markdown Dossier (.md)
            </button>

            {/* Action 3: Copy to Clipboard */}
            <button 
              className="btn btn-ghost"
              onClick={handleCopyMarkdown}
              style={{ width: '100%', justifyContent: 'center', padding: '7px 14px', fontSize: '12px' }}
            >
              {copied ? <Check size={14} color="var(--accent-emerald)" /> : <FileText size={14} />}
              {copied ? 'Dossier Copied to Clipboard!' : 'Copy Raw Markdown to Clipboard'}
            </button>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
