import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DataChart from './components/DataChart';
import CodeViewer from './components/CodeViewer';
import AnomalyCard from './components/AnomalyCard';
import ReasoningDrawer from './components/ReasoningDrawer';
import FileUploadModal from './components/FileUploadModal';
import SqlPlaygroundModal from './components/SqlPlaygroundModal';
import DataQualityModal from './components/DataQualityModal';
import ApiKeyModal from './components/ApiKeyModal';
import DashboardView from './components/DashboardView';
import CorporateReportViewer from './components/CorporateReportViewer';
import ReportExportModal from './components/ReportExportModal';
import DatasetPreviewModal from './components/DatasetPreviewModal';
import { Send, Sparkles, Database, Bot, User as UserIcon, Loader2, LayoutDashboard, Plus } from 'lucide-react';

export default function App() {
  const [sessionId] = useState(() => {
    const existing = localStorage.getItem('dbo_session_id');
    if (existing) return existing;
    const created = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('dbo_session_id', created);
    return created;
  });
  const [tables, setTables] = useState([
    { table_name: 'sales_transactions', original_filename: 'sales_transactions.csv' },
    { table_name: 'customers', original_filename: 'customers.csv' },
    { table_name: 'products', original_filename: 'products.csv' },
    { table_name: 'monthly_targets', original_filename: 'monthly_targets.csv' },
    { table_name: 'regional_targets', original_filename: 'regional_targets.csv' },
  ]);
  const [selectedTable, setSelectedTable] = useState('sales_transactions');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Upload a CSV or ask a question.`,
      reasoning: "Initialized analytical workspace and session memory for Digital Back Office.",
      chart: null,
      sql_query: "",
      pandas_code: "",
      query_result: null,
      anomalies: null,
      suggested_followups: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'dashboard'

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSqlOpen, setIsSqlOpen] = useState(false);
  const [isQualityOpen, setIsQualityOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [previewTable, setPreviewTable] = useState(null);

  const uniqueTables = (items = []) => {
    const seen = new Set();
    return items.filter(item => item?.table_name && !seen.has(item.table_name) && seen.add(item.table_name));
  };

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const fetchDatasets = async () => {
    try {
      const res = await fetch('/api/datasets', { headers: { 'x-session-id': sessionId } });
      if (res.ok) {
        const data = await res.json();
        setTables(uniqueTables(data.tables || []));
        if (data.tables?.length && !data.tables.some(t => t.table_name === selectedTable)) {
          setSelectedTable(data.tables[0].table_name);
        }
      }
    } catch (e) {
      console.error("Failed to fetch datasets", e);
    }
  };

  const handleLoadSample = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/load-sample', {
        method: 'POST',
        headers: { 'x-session-id': sessionId }
      });
      if (res.ok) {
        const data = await res.json();
        setTables(uniqueTables(data.all_tables || data.tables || []));
        setSelectedTable((data.all_tables || data.tables || [])[0]?.table_name || 'sales_transactions');
        
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Sample datasets loaded. Ask a question.`,
            reasoning: "Loaded relational tables and inferred primary/foreign keys (`Customer_ID`, `Product_ID`).",
            chart: null,
            sql_query: "",
            query_result: null,
            anomalies: null
          }
        ]);
      }
    } catch (err) {
      console.error("Failed loading sample data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
          ...(apiKey ? { 'x-gemini-api-key': apiKey } : {})
        },
        body: JSON.stringify({
          question: queryText,
          chat_history: historyPayload,
          api_key: apiKey || undefined,
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();

      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        reasoning: data.reasoning,
        sql_query: data.sql_query,
        pandas_code: data.pandas_code,
        query_result: data.query_result,
        chart: data.chart,
        anomalies: data.anomalies,
        suggested_followups: data.suggested_followups,
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `**Analytical processing error**: Unable to complete query (${err.message}). Please verify the dataset or try asking with different phrasing.`,
          reasoning: "Request failed during backend execution.",
          sql_query: "",
          query_result: null,
          chart: null,
          anomalies: null,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all tables and conversation history?")) return;
    try {
      await fetch('/api/reset', { method: 'POST', headers: { 'x-session-id': sessionId } });
        const resetResponse = await fetch('/api/datasets', { headers: { 'x-session-id': sessionId } });
        const resetData = await resetResponse.json();
        setTables(uniqueTables(resetData.tables || []));
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
              content: `Sample datasets loaded.`,
          reasoning: "Cleared in-memory DuckDB connection and session history.",
          chart: null,
          sql_query: "",
          query_result: null,
          anomalies: null,
        }
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveApiKey = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
  };

  return (
    <div className="app-container">
      <Header
        tableCount={tables.length}
        onOpenUpload={() => setIsUploadOpen(true)}
        onLoadSample={handleLoadSample}
        onOpenApiKey={() => setIsApiKeyOpen(true)}
        onOpenQuality={() => setIsQualityOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onReset={handleReset}
        loading={loading}
      />

      <div className="main-body">
        <Sidebar
          tables={tables}
          selectedTable={selectedTable}
          onSelectDataset={setSelectedTable}
          onSelectPrompt={handleSendMessage}
          onOpenSqlPlayground={() => setIsSqlOpen(true)}
          onOpenQuality={() => setIsQualityOpen(true)}
          onLoadSample={handleLoadSample}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenPreview={setPreviewTable}
          loading={loading}
        />

        <main className="chat-main">
          {/* View Tab Switcher - Clean Segmented Control */}
          <div className="view-tabs-bar">
            <div className="segmented-control">
              <button
                className={`segment-btn ${activeView === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveView('chat')}
              >
                <Bot size={13} />
                Analyst Chat
              </button>
              <button
                className={`segment-btn ${activeView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveView('dashboard')}
              >
                <LayoutDashboard size={13} />
                Executive Dashboard
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              <span className="pulse-indicator" />
              <span>DuckDB Autonomous Engine Active</span>
            </div>
          </div>

          {activeView === 'dashboard' ? (
            <DashboardView 
              tableCount={tables.length} 
              onLoadSample={handleLoadSample} 
            />
          ) : (
            <>
              <div className="messages-stream">
                {messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="avatar avatar-ai">
                        <Sparkles size={15} />
                      </div>
                    )}

                    <div className="message-card">
                      {msg.role === 'assistant' ? (
                        <>
                          {/* Reasoning Drawer */}
                          {msg.reasoning && (
                            <ReasoningDrawer reasoning={msg.reasoning} />
                          )}

                          {/* Digital Back Office Corporate Report Output */}
                          <CorporateReportViewer content={msg.content} />

                          {/* Anomaly Highlight Card */}
                          {msg.anomalies && (
                            <AnomalyCard anomalies={msg.anomalies} />
                          )}

                          {/* Plotly Interactive Visualization */}
                          {msg.chart && (
                            <DataChart chartSpec={msg.chart} anomalies={msg.anomalies} />
                          )}

                          {/* DuckDB SQL & Pandas Execution Inspector */}
                          {(msg.sql_query || msg.pandas_code || msg.query_result) && (
                            <details className="advanced-details">
                              <summary>Data details</summary>
                              <CodeViewer
                                sqlQuery={msg.sql_query}
                                pandasCode={msg.pandas_code}
                                queryResult={msg.query_result}
                                onOpenWorkbench={(q) => setIsSqlOpen(true)}
                              />
                            </details>
                          )}

                          {/* Suggested Follow-up Chips */}
                          {msg.suggested_followups && msg.suggested_followups.length > 0 && (
                            <div className="followup-chips-container">
                              <span className="followup-label">
                                <Sparkles size={11} /> Suggested Follow-ups:
                              </span>
                              <div className="followup-chips-list">
                                {msg.suggested_followups.map((fUp, fIdx) => (
                                  <button 
                                    key={fIdx} 
                                    className="followup-chip-btn"
                                    onClick={() => handleSendMessage(fUp)}
                                    disabled={loading}
                                  >
                                    {fUp}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="user-message-text">
                          {msg.content}
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="avatar avatar-user">
                        <UserIcon size={15} />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="message-row assistant-row">
                    <div className="avatar avatar-ai">
                      <Sparkles size={15} />
                    </div>
                    <div className="message-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                      <Loader2 size={15} className="animate-spin" />
                      <span style={{ fontSize: '13px' }}>AI Data Analyst is reasoning and querying DuckDB...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Dock */}
              <div className="input-dock">
                {/* Quick Action Suggestion Chips */}
                {tables.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '8px', paddingBottom: '2px' }}>
                    {[
                      { label: "Sales Trend", query: "Show monthly sales trends." },
                      { label: "Regional Revenue", query: "Which region generated the highest revenue?" },
                      { label: "Detect Outliers", query: "Detect anomalies in the dataset." },
                      { label: "Top 5 Customers", query: "What are the top five customers?" },
                      { label: "6M Forecast", query: "Forecast sales for the next 6 months." }
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSendMessage(chip.query)}
                        disabled={loading}
                        style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '9999px', whiteSpace: 'nowrap' }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="input-wrapper">
                  <button 
                    type="button"
                    className="upload-attach-btn"
                    onClick={() => setIsUploadOpen(true)}
                    title="Upload CSV dataset (+)"
                  >
                    <Plus size={16} />
                  </button>
                  <textarea
                    className="chat-textarea"
                    placeholder={tables.length === 0 ? "Upload CSVs or load sample data to ask questions..." : "Ask an analytical question (e.g. 'Which region generated the highest revenue?')..."}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={loading}
                  />
                  <button 
                    className="send-btn" 
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || loading}
                    title="Send query (Enter)"
                  >
                    <Send size={15} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', padding: '0 4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Press <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>Enter ↵</kbd> to run analysis</span>
                  <span>Shift + Enter for newline</span>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
          onUploadSuccess={(newTables) => {
            const dedupedTables = uniqueTables(newTables);
            setTables(dedupedTables);
            setSelectedTable(dedupedTables[0]?.table_name || 'sales_transactions');
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: `Uploaded ${dedupedTables.length} dataset${dedupedTables.length === 1 ? '' : 's'}.`,
              reasoning: "Registered tables into DuckDB memory and inspected schema types.",
              chart: null,
              sql_query: "",
              query_result: null,
              anomalies: null
            }
          ]);
        }}
        onLoadSample={handleLoadSample}
      />

      <SqlPlaygroundModal
        isOpen={isSqlOpen}
        onClose={() => setIsSqlOpen(false)}
        tables={tables}
        selectedTable={selectedTable}
      />

      <DataQualityModal
        isOpen={isQualityOpen}
        onClose={() => setIsQualityOpen(false)}
        tables={tables}
        selectedTable={selectedTable}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />

      <ReportExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        messages={messages}
      />

      <DatasetPreviewModal
        isOpen={Boolean(previewTable)}
        table={previewTable}
        onClose={() => setPreviewTable(null)}
      />
    </div>
  );
}
