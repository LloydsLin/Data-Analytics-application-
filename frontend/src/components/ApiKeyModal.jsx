import React, { useState } from 'react';
import { X, Key, Check, ShieldAlert } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, apiKey, onSaveApiKey }) {
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--accent-indigo)" />
            <div className="modal-title">Google Gemini API Key</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
          Configure your Google Gemini API Key. The key is securely passed in request headers and stored only in your local browser session.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            GEMINI API KEY:
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            style={{
              width: '100%',
              background: '#090d15',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              color: '#fff',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          marginBottom: '20px'
        }}>
          💡 <em>If no key is configured, the application automatically uses its high-fidelity built-in analytical engine to process the benchmark questions and dataset exploration seamlessly.</em>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {saved ? <Check size={14} /> : null}
            {saved ? 'Saved!' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
