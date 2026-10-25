import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

export default function CorporateReportViewer({ content = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dbo-report-container">
      <div className="dbo-report-meta simple-report-actions">
        <button className="dbo-copy-btn" onClick={handleCopy} title="Copy answer">
          {copied ? <><Check size={12} color="var(--accent-emerald)" /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>

      {/* Rendered Markdown Body with Executive Styling */}
      <div className="dbo-report-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>

    </div>
  );
}
