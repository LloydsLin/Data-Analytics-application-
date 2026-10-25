import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.data_store import current_session_id, data_store
from app.services.demo_bootstrap import DEMO_FILES, bootstrap_demo_data
from app.services.profiler import profiler
from app.services.anomaly_engine import anomaly_engine
from app.services.gemini_agent import gemini_agent
from app.services.exporter import exporter
from app.services.forecast_engine import forecast_engine
from app.services.logger import audit_logger

router = APIRouter()

# In-memory session history for export. Dataset isolation remains a follow-up
# because the analytical services currently share one DuckDB store.
session_histories: Dict[str, List[Dict[str, Any]]] = {}


def _history_for(session_id: Optional[str]) -> List[Dict[str, Any]]:
    key = (session_id or "default").strip()[:128] or "default"
    return session_histories.setdefault(key, [])

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=2_000)
    chat_history: Optional[List[Dict[str, str]]] = Field(default=None, max_length=20)
    api_key: Optional[str] = None

class SqlRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=20_000)
    max_rows: Optional[int] = Field(default=500, ge=1, le=10_000)

class AnomalyRequest(BaseModel):
    table_name: Optional[str] = None
    column: Optional[str] = None
    method: Optional[str] = Field(default="iqr", pattern="^(iqr|zscore|isolation_forest)$")

class ForecastRequest(BaseModel):
    table_name: Optional[str] = None
    date_column: Optional[str] = None
    metric_column: Optional[str] = None
    periods: Optional[int] = 3

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "loaded_tables": len(data_store.tables),
    }

@router.post("/upload")
async def upload_csv_files(files: List[UploadFile] = File(...)):
    """Upload and validate one or more CSV files into DuckDB."""
    if not files or len(files) > settings.MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Upload between 1 and {settings.MAX_UPLOAD_FILES} CSV files.")
    uploaded_tables = []
    
    for file in files:
        original_name = Path(file.filename or "").name
        if not original_name or not original_name.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' is not a CSV file.")
        safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", original_name)
        saved_path = settings.DATA_DIR / f"{uuid.uuid4().hex}_{safe_name}"
        bytes_written = 0
        try:
            with open(saved_path, "wb") as buffer:
                while chunk := await file.read(1024 * 1024):
                    bytes_written += len(chunk)
                    if bytes_written > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                        raise ValueError(f"File exceeds the {settings.MAX_FILE_SIZE_MB} MB limit.")
                    buffer.write(chunk)
            if bytes_written == 0:
                raise ValueError("File is empty.")
        except Exception as e:
            saved_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=f"Invalid upload '{original_name}': {e}")
            
        try:
            table_name = data_store.register_csv(
                saved_path,
                custom_table_name=original_name,
                max_rows=settings.MAX_CSV_ROWS,
                max_columns=settings.MAX_CSV_COLUMNS,
            )
            existing_path = data_store.file_paths.get(table_name)
            if existing_path and existing_path != saved_path:
                saved_path.unlink(missing_ok=True)
            table_meta = data_store.get_table_info(table_name)
            table_meta["original_filename"] = original_name
            uploaded_tables.append(table_meta)
        except Exception as e:
            saved_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=f"Failed to ingest CSV '{file.filename}': {e}")
            
    return {
        "message": f"Successfully uploaded and registered {len(uploaded_tables)} dataset(s).",
        "tables": uploaded_tables,
        "all_tables": data_store.list_tables()
    }

@router.post("/load-sample")
def load_sample_datasets():
    """Restore the five bundled demo datasets for the current session."""
    loaded = bootstrap_demo_data(data_store, settings.SAMPLE_DIR)
    if not loaded:
        raise HTTPException(status_code=500, detail="Bundled demo datasets are unavailable.")
        
    return {
        "message": f"Successfully loaded {len(loaded)} sample datasets.",
        "tables": loaded,
        "all_tables": data_store.list_tables()
    }

@router.get("/datasets")
def list_datasets():
    """List all registered tables and schemas."""
    return {
        "tables": data_store.list_tables(),
        "schema_summary": data_store.get_schema_summary_for_llm()
    }

@router.get("/datasets/{table_name}/preview")
def preview_dataset(table_name: str, limit: int = Query(50, ge=1, le=200)):
    """Return a bounded, read-only preview of one registered dataset."""
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", table_name):
        raise HTTPException(status_code=400, detail="Invalid table name.")
    if not data_store.get_table_info(table_name):
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' does not exist.")
    try:
        result = data_store.execute_sql(f"SELECT * FROM {table_name} LIMIT {limit}", max_rows=limit)
        return {
            "table_name": table_name,
            "columns": result["columns"],
            "rows": result["rows"],
            "row_count": data_store.get_table_info(table_name)["row_count"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quality/{table_name}")
def get_data_quality(table_name: str):
    """Deep data quality audit on specified table."""
    try:
        df = data_store.get_dataframe(table_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
        
    report = profiler.profile_dataframe(df, table_name=table_name)
    return report

@router.post("/chat")
def chat_with_data(
    req: ChatRequest,
    x_gemini_api_key: Optional[str] = Header(None),
    x_session_id: Optional[str] = Header(None),
):
    """Natural language query answering, reasoning, SQL generation, and chart synthesis."""
    effective_key = req.api_key or x_gemini_api_key
    response = gemini_agent.execute_query(
        question=req.question,
        chat_history=req.chat_history,
        custom_api_key=effective_key
    )
    
    # Record in session history
    _history_for(x_session_id).append({
        "question": req.question,
        "response": response
    })
    
    return response

@router.post("/anomalies")
def detect_anomalies(req: AnomalyRequest):
    """Execute anomaly detection using IQR, Z-Score, or Isolation Forest."""
    bootstrap_demo_data(data_store, settings.SAMPLE_DIR)
    tables = list(data_store.tables.keys())
    if not tables:
        raise HTTPException(status_code=503, detail="Demo workspace is still initializing.")
        
    t_name = req.table_name or tables[0]
    try:
        df = data_store.get_dataframe(t_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    method = (req.method or "iqr").lower()
    
    if method == "zscore":
        if not req.column:
            # Pick first numeric
            num_cols = [c for c in df.columns if str(df[c].dtype).startswith(("int", "float"))]
            col = num_cols[0] if num_cols else df.columns[0]
        else:
            col = req.column
        return anomaly_engine.detect_zscore(df, col)
    elif method == "isolation_forest":
        return anomaly_engine.detect_multivariate_isolation_forest(df)
    else:
        if req.column:
            return anomaly_engine.detect_iqr(df, req.column)
        return anomaly_engine.auto_detect(df)

@router.post("/sql/execute")
def run_sql(req: SqlRequest):
    """Execute raw SQL in DuckDB playground."""
    try:
        res = data_store.execute_sql(req.query, max_rows=req.max_rows or 500)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/export/report")
def export_report(
    format: str = Query("html", pattern="^(html|markdown)$"),
    x_session_id: Optional[str] = Header(None),
):
    """Export current session findings as an executive report."""
    if format == "markdown":
        md = exporter.generate_markdown_report(_history_for(x_session_id))
        return PlainTextResponse(content=md, media_type="text/markdown")
    else:
        html = exporter.generate_html_report(_history_for(x_session_id))
        return HTMLResponse(content=html)

@router.post("/reset")
def reset_session():
    """Clear in-memory tables and session history."""
    data_store.reset_current()
    session_histories.pop(current_session_id(), None)
    loaded = bootstrap_demo_data(data_store, settings.SAMPLE_DIR)
    return {"message": "Demo session restored.", "tables": loaded}

@router.get("/dashboard")
def get_executive_dashboard():
    """Return comprehensive corporate KPI metrics and visual breakdowns for executive dashboard."""
    bootstrap_demo_data(data_store, settings.SAMPLE_DIR)
    tables = list(data_store.tables.keys())
    if not tables:
        return {"loaded": False, "message": "Demo workspace is still initializing."}

    sales_tbl = next((t for t in tables if "sale" in t), tables[0])
    cust_tbl = next((t for t in tables if "cust" in t), None)
    prod_tbl = next((t for t in tables if "prod" in t), None)

    # 1. High-level KPIs
    kpi_sql = f"""
    SELECT 
        ROUND(SUM(Revenue), 2) AS total_revenue,
        ROUND(SUM(Profit), 2) AS total_profit,
        ROUND((SUM(Profit) / NULLIF(SUM(Revenue), 0)) * 100, 1) AS profit_margin_pct,
        COUNT(Order_ID) AS total_orders,
        ROUND(AVG(Revenue), 2) AS avg_order_value,
        COUNT(DISTINCT Customer_ID) AS unique_customers
    FROM {sales_tbl};
    """
    kpis = data_store.execute_sql(kpi_sql)["rows"][0]

    # Anomaly count
    df = data_store.get_dataframe(sales_tbl)
    anom_summary = anomaly_engine.auto_detect(df)
    kpis["anomaly_count"] = anom_summary.get("anomaly_count", 0)

    # 2. Regional Breakdown
    region_sql = f"""
    SELECT Region, ROUND(SUM(Revenue), 2) AS Revenue, ROUND(SUM(Profit), 2) AS Profit
    FROM {sales_tbl}
    GROUP BY Region
    ORDER BY Revenue DESC;
    """
    region_data = data_store.execute_sql(region_sql)["rows"]

    # 3. Monthly Trends
    monthly_sql = f"""
    SELECT 
        STRFTIME(TRY_CAST(Order_Date AS DATE), '%Y-%m') AS Month,
        ROUND(SUM(Revenue), 2) AS Revenue,
        ROUND(SUM(Profit), 2) AS Profit
    FROM {sales_tbl}
    WHERE Order_Date IS NOT NULL
    GROUP BY Month
    ORDER BY Month ASC;
    """
    monthly_data = data_store.execute_sql(monthly_sql)["rows"]

    # 4. Top 5 Customers
    cust_join = f"JOIN {cust_tbl} c ON s.Customer_ID = c.Customer_ID" if cust_tbl else ""
    cust_name = "c.Customer_Name" if cust_tbl else "s.Customer_ID"
    cust_sql = f"""
    SELECT {cust_name} AS Customer, ROUND(SUM(s.Revenue), 2) AS Revenue
    FROM {sales_tbl} s
    {cust_join}
    GROUP BY Customer
    ORDER BY Revenue DESC
    LIMIT 5;
    """
    customer_data = data_store.execute_sql(cust_sql)["rows"]

    # 5. Product Category Distribution
    prod_join = f"JOIN {prod_tbl} p ON s.Product_ID = p.Product_ID" if prod_tbl else ""
    cat_col = "p.Category" if prod_tbl else "'All Products'"
    cat_sql = f"""
    SELECT {cat_col} AS Category, ROUND(SUM(s.Revenue), 2) AS Revenue
    FROM {sales_tbl} s
    {prod_join}
    GROUP BY Category
    ORDER BY Revenue DESC;
    """
    category_data = data_store.execute_sql(cat_sql)["rows"]

    return {
        "loaded": True,
        "kpis": kpis,
        "regional_breakdown": region_data,
        "monthly_trend": monthly_data,
        "top_customers": customer_data,
        "category_distribution": category_data,
    }

@router.post("/forecast")
def run_forecast(req: ForecastRequest):
    """Execute predictive forecasting on selected table and metric."""
    bootstrap_demo_data(data_store, settings.SAMPLE_DIR)
    tables = list(data_store.tables.keys())
    if not tables:
        raise HTTPException(status_code=503, detail="Demo workspace is still initializing.")

    t_name = req.table_name or next((t for t in tables if "sale" in t), tables[0])
    df = data_store.get_dataframe(t_name)
    
    date_col = req.date_column or next((c for c in df.columns if "date" in c.lower()), df.columns[0])
    metric_col = req.metric_column or ("Revenue" if "Revenue" in df.columns else df.columns[1])
    
    result = forecast_engine.forecast_metric(df, date_col, metric_col, periods=req.periods or 3)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.get("/logs")
def get_audit_logs(limit: int = Query(50, ge=1, le=200)):
    """Retrieve structured audit logs for observability."""
    return {"logs": audit_logger.get_recent_logs(limit=limit)}
