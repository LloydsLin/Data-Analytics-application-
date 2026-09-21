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
import { Send, Sparkles, Database, Bot, User as UserIcon, Loader2, LayoutDashboard } from 'lucide-react';

export default function App() {
  const [tables, setTables] = useState([]);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### Welcome to Digital Back Office AI Data Analyst! 👋

I am your autonomous corporate intelligence analyst. You can upload one or multiple CSV files to query data, discover regional sales drivers, detect revenue anomalies, and inspect generated DuckDB SQL queries.

**Recommended starting questions:**
- *"Which region generated the highest revenue?"*
- *"Show monthly sales trends."*
- *"Which products are underperforming?"*
- *"What are the top five customers?"*
- *"Detect anomalies in the dataset."*
- *"Generate SQL for this analysis."*`,
      reasoning: "Initialized analytical workspace and session memory.",
      chart: null,
      sql_query: "",
      query_result: null,
      anomalies: null,
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
      const res = await fetch('/api/datasets');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
      }
    } catch (e) {
      console.error("Failed to fetch datasets", e);
    }
  };

  const handleLoadSample = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/load-sample', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTables(data.all_tables || data.tables || []);
        
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: `✅ **Successfully loaded 3 sample enterprise datasets into DuckDB:**
- **\`sales_transactions\`** (1,200 orders across 2023-2024 with seasonal spikes & intentional anomalies)
- **\`customers\`** (100 corporate and retail accounts across the UK)
- **\`products\`** (15 catalog items across Technology, Office Supplies, and Furniture)

Ready for multi-table queries, trend forecasting, and outlier inspection!`,
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
        query_result: data.query_result,
        chart: data.chart,
        anomalies: data.anomalies,
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ **Analytical processing error**: Unable to complete query (${err.message}). Please verify the dataset or try asking with different phrasing.`,
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
      await fetch('/api/reset', { method: 'POST' });
      setTables([]);
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `### Session Reset Complete 🔄\n\nAll tables cleared from memory. Upload a new CSV or load the sample datasets to start a new analysis.`,
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
        onReset={handleReset}
        loading={loading}
      />

      <div className="main-body">
        <Sidebar
          tables={tables}
          onSelectPrompt={handleSendMessage}
          onOpenSqlPlayground={() => setIsSqlOpen(true)}
          onOpenQuality={() => setIsQualityOpen(true)}
          onLoadSample={handleLoadSample}
          loading={loading}
        />

        <main className="chat-main">
          {/* View Tab Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 24px',
            background: 'rgba(12, 16, 23, 0.75)',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '8px',
            zIndex: 10
          }}>
            <button
              className={`btn btn-sm ${activeView === 'chat' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveView('chat')}
            >
              <Bot size={14} />
              Conversational Analyst
            </button>
            <button
              className={`btn btn-sm ${activeView === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveView('dashboard')}
            >
              <LayoutDashboard size={14} />
              Executive Dashboard
            </button>
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
                        <Sparkles size={16} />
                      </div>
                    )}

                    <div className="message-card">
                      {/* Reasoning Drawer (for assistant messages) */}
                      {msg.role === 'assistant' && msg.reasoning && (
                        <ReasoningDrawer reasoning={msg.reasoning} />
                      )}

                      {/* Message Content */}
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '13.5px' }}>
                        {msg.content}
                      </div>

                      {/* Anomaly Highlight Card */}
                      {msg.anomalies && (
                        <AnomalyCard anomalies={msg.anomalies} />
                      )}

                      {/* Plotly Interactive Visualization */}
                      {msg.chart && (
                        <DataChart chartSpec={msg.chart} />
                      )}

                      {/* DuckDB SQL & Execution Inspector */}
                      {(msg.sql_query || msg.query_result) && (
                        <CodeViewer 
                          sqlQuery={msg.sql_query} 
                          queryResult={msg.query_result} 
                        />
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="avatar avatar-user">
                        <UserIcon size={16} />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="message-row assistant-row">
                    <div className="avatar avatar-ai">
                      <Sparkles size={16} />
                    </div>
                    <div className="message-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                      <Loader2 size={16} className="animate-spin" />
                      <span>AI Data Analyst is reasoning and querying DuckDB...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Dock */}
              <div className="input-dock">
                <div className="input-wrapper">
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
                    <Send size={16} />
                  </button>
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
          setTables(newTables);
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: `📁 **Uploaded and validated ${newTables.length} dataset(s) into DuckDB!** You can now ask questions across these tables or run SQL joins.`,
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
      />

      <DataQualityModal
        isOpen={isQualityOpen}
        onClose={() => setIsQualityOpen(false)}
        tables={tables}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}
