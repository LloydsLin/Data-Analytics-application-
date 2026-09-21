# Digital Back Office Ltd. - AI-Powered Data Analyst

A production-grade, enterprise AI Data Analyst web application that enables business and technical stakeholders to upload one or more CSV files and interact with the data using natural language. The application answers analytical questions, creates interactive visualizations, detects statistical anomalies with explicit reasoning, exposes generated SQL/Python code, maintains multi-turn conversation memory, and performs automated data quality audits.

---

## 🏛️ System Architecture

```mermaid
graph TD
    User([User / Web Browser]) <--> |REST API & JSON| UI[Modern React + Vite + Plotly Interface]
    UI <--> |Port 8000 / Proxy 5173| Backend[FastAPI Application Server]
    
    subgraph "Backend Engine"
        UploadMgr[Upload & Validation Manager]
        Profiler[Automated Data Quality Profiler]
        DuckDBEngine[(In-Process DuckDB Relational Engine)]
        AnomalyEngine[Statistical Anomaly Engine (IQR, Z-score, Isolation Forest)]
        GeminiAgent[Gemini 2.5 Agent with Tool Calling & Fallback Intelligence]
    end
    
    Backend --> UploadMgr
    UploadMgr --> DuckDBEngine
    UploadMgr --> Profiler
    Backend --> GeminiAgent
    
    GeminiAgent <--> |execute_sql| DuckDBEngine
    GeminiAgent <--> |detect_anomalies| AnomalyEngine
    GeminiAgent <--> |get_data_quality| Profiler
    GeminiAgent <--> |Gemini API| CloudLLM[(Google Gemini 2.5 Flash API)]
```

---

## ✨ Core Features & Technical Highlights

1. **Multi-CSV Ingestion & DuckDB Relational Engine**
   - Ingests multiple CSV files simultaneously (e.g., `sales_transactions.csv`, `customers.csv`, `products.csv`).
   - Registers files into an in-memory columnar **DuckDB** database, enabling relational cross-table SQL `JOIN` queries without requiring external database servers.
   - Read-only execution guardrails to prevent SQL injection or destructive operations.

2. **Google Gemini API Agent with Tool Calling**
   - Leverages `gemini-2.5-flash` with structured function/tool calling (`execute_sql`, `detect_anomalies`, `generate_chart_spec`, `get_data_quality_report`).
   - Features a **High-Fidelity Heuristic Fallback Engine**: If no API key is supplied or if network limits are reached, the application functions without interruption.
   - Maintains multi-turn conversation memory for contextual follow-up inquiries.

3. **Explicit Chain-of-Thought & Reasoning Explanations**
   - Every answer includes an expandable **"Analytical Methodology & Reasoning Chain"** drawer explaining:
     - Hypotheses and business metrics chosen
     - Relational join paths and column filters applied
     - Mathematical rationale behind aggregations

4. **Statistical Anomaly Detection & Outlier Explanations**
   - Multi-method detection:
     - **IQR Rule** ($Q_1 - 1.5 \times IQR, Q_3 + 1.5 \times IQR$)
     - **Z-Score Analysis** ($|Z| > 3.0\sigma$)
     - **Isolation Forest** (unsupervised multi-variate outlier detection)
   - Every flagged record details its row ID, exact value, baseline fence, and contextual reason (e.g. bulk order spikes, margin loss glitches).

5. **Interactive Visualizations (Plotly.js)**
   - Dynamic Bar, Line, Pie/Donut, Scatter, and Area charts.
   - Interactive zoom, pan, hover tooltips, and one-click PNG image export.

6. **SQL & Execution Code Inspector**
   - Full transparency: inspect the exact DuckDB SQL generated, runtime execution duration (ms), total rows returned, and an interactive data table with copy-to-clipboard functionality.

7. **Data Quality & Schema Profiling**
   - Computes missingness rates, distinct cardinality, numerical distribution percentiles (Min, Q25, Median, Q75, Max, Mean, Std), duplicate rows, and overall health score (0-100%).

8. **Executive Report Export**
   - Download session analytics and SQL queries as formatted **HTML** or **Markdown** reports.

---

## 📊 Sample Datasets Included

Located in the `sample_data/` directory:
- **`sales_transactions.csv`**: 1,200 transactions across 2023–2024 featuring regional metrics, seasonal monthly trends, product sales, discounts, and intentional anomalies (bulk quantities, extreme margins).
- **`customers.csv`**: 100 enterprise and retail customer accounts across UK regions.
- **`products.csv`**: 15 items across Technology, Office Supplies, and Furniture with cost and list prices.

---

## 🚀 Quickstart Guide

### Option 1: Docker (Recommended)

Run the entire application in a single command using Docker Compose:

```bash
# 1. Clone the repository
git clone <repository-url>
cd "Data Analyst application"

# 2. (Optional) Set your Gemini API Key
export GEMINI_API_KEY="your_api_key_here"

# 3. Start with Docker Compose
docker-compose up --build
```

Access the application at **http://localhost:8000**.

---

### Option 2: Local Development Setup

#### Prerequisites
- Python 3.9+ 
- Node.js 18+ and npm

#### 1. Backend Setup
```bash
# Navigate to project root
cd "Data Analyst application"

# Create and activate Python virtual environment
python3 -m venv backend/venv
source backend/venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt

# (Optional) Export Gemini API key
export GEMINI_API_KEY="your_api_key_here"

# Start the FastAPI backend
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup (in a separate terminal)
```bash
cd "Data Analyst application/frontend"

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open your browser at **http://localhost:5173** (proxies API requests to port 8000).

---

## 🧪 Running Automated Tests

A comprehensive `pytest` test suite validates the relational data store, SQL execution, anomaly detection algorithms, profiler, and API endpoints:

```bash
# Activate virtual environment
source backend/venv/bin/activate

# Run pytest
PYTHONPATH=backend pytest -v tests/
```

Test coverage includes:
- `tests/test_data_store.py`: Ingestion, DuckDB queries, multi-table JOINs, security guardrails.
- `tests/test_anomaly_engine.py`: IQR, Z-Score, and Isolation Forest algorithms.
- `tests/test_profiler.py`: Data quality metrics, null counts, duplicate detection, and health score.
- `tests/test_api.py`: FastAPI endpoints and integration tests.

---

## 💡 Benchmark Assignment Questions & Expected Behavior

| Prompt Question | Engine Action | Visual / Analytical Output |
| :--- | :--- | :--- |
| **"Which region generated the highest revenue?"** | Runs DuckDB SQL aggregation grouping by `Region` | Bar chart displaying revenue and profit breakdown; identifies West/North as revenue leaders. |
| **"Show monthly sales trends."** | Date-truncates `Order_Date` to months, sums revenue & profit | Line chart with monthly progression showing revenue trajectory. |
| **"Which products are underperforming?"** | Calculates profit margin % and flags low-margin items | Table and bar chart identifying items with negative profit margins and excessive discounts. |
| **"What are the top five customers?"** | Executes relational `JOIN` between `sales` and `customers` | Ranked list and bar chart of top 5 customer accounts by total spend. |
| **"Detect anomalies in the dataset."** | Executes statistical IQR & Z-score detection on financial metrics | High-contrast anomaly cards detailing outlier rows, statistical fences, and specific reasons. |
| **"Generate SQL for this analysis."** | Generates standard DuckDB SQL | SQL code block with copy button, runtime duration, and interactive tabular preview. |

---

## 📂 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py      # REST & query endpoints
│   │   ├── core/
│   │   │   └── config.py         # Application settings
│   │   ├── services/
│   │   │   ├── anomaly_engine.py # IQR, Z-score, Isolation Forest
│   │   │   ├── data_store.py     # DuckDB in-memory engine & schema manager
│   │   │   ├── exporter.py       # HTML and Markdown report generation
│   │   │   ├── gemini_agent.py   # Gemini API agent & fallback engine
│   │   │   └── profiler.py       # Data quality & schema profiler
│   │   └── main.py               # FastAPI application entrypoint
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnomalyCard.jsx
│   │   │   ├── ApiKeyModal.jsx
│   │   │   ├── CodeViewer.jsx
│   │   │   ├── DataChart.jsx
│   │   │   ├── DataQualityModal.jsx
│   │   │   ├── FileUploadModal.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── ReasoningDrawer.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── SqlPlaygroundModal.jsx
│   │   ├── App.jsx
│   │   ├── index.css             # Vanilla CSS design system
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── sample_data/
│   ├── customers.csv
│   ├── products.csv
│   └── sales_transactions.csv
├── tests/
│   ├── conftest.py
│   ├── test_anomaly_engine.py
│   ├── test_api.py
│   ├── test_data_store.py
│   └── test_profiler.py
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml
└── README.md
```

---

## 🔒 Assumptions & Design Decisions

1. **DuckDB as SQL Engine**: Avoids heavy external database dependencies (e.g. Postgres) while delivering enterprise-grade columnar OLAP performance and native multi-CSV joins.
2. **Deterministic Dual-Mode AI**: Supports both the live Gemini API and an autonomous fallback analytical engine, guaranteeing that assignment evaluators can test every feature immediately with or without an active API key.
3. **Security**: Read-only enforcement on SQL queries prevents file deletion or shell breakout; file uploads are isolated and validated for `.csv` MIME types.
4. **Clean Aesthetics**: Custom Vanilla CSS design tokens ensure high-contrast legibility, responsive glassmorphism, and smooth micro-interactions without third-party utility bloat.
