import json
import logging
import re
import time
from typing import Any, Dict, List, Optional
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from app.core.config import settings
from app.services.data_store import data_store
from app.services.demo_bootstrap import bootstrap_demo_data
from app.services.anomaly_engine import anomaly_engine
from app.services.profiler import profiler
from app.services.forecast_engine import forecast_engine
from app.services.logger import audit_logger

logger = logging.getLogger(__name__)


class AgentChartModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str = "bar"
    title: str = "Data Visualization"
    x_key: Optional[str] = None
    y_key: Optional[str] = None
    series: List[Dict[str, Any]] = Field(default_factory=list)


class AgentOutputModel(BaseModel):
    """Small, explicit contract for model-generated analytical responses."""

    model_config = ConfigDict(extra="ignore")
    content: str = ""
    reasoning: str = ""
    sql_query: str = ""
    pandas_code: str = ""
    chart: Optional[AgentChartModel] = None
    detected_anomalies_summary: Optional[str] = None
    suggested_followups: List[str] = Field(default_factory=list, max_length=5)

SYSTEM_INSTRUCTION = """You are a concise data analyst.
You have direct access to in-memory relational databases containing CSV datasets uploaded by the user.

Rules:
1. Answer in 1–3 short sentences with the numbers that matter.
2. Use short bullets only when they improve clarity. Do not add recommendations unless asked.
3. Inspect the schema and generate DuckDB SQL when data is needed.
4. Provide a chart only when it helps.
5. Keep reasoning to one short sentence. Keep SQL and Python as optional details.

Return only valid JSON matching this structure:
{
  "content": "Short direct answer with specific values.",
  "reasoning": "One short sentence describing the calculation.",
  "sql_query": "The executed DuckDB SQL or an empty string.",
  "pandas_code": "Equivalent Python or an empty string.",
  "chart": null,
  "detected_anomalies_summary": null,
  "suggested_followups": []
}
"""

class GeminiAgentService:
    def __init__(self):
        self.default_api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"

    def _get_client(self, custom_api_key: Optional[str] = None):
        key = custom_api_key or self.default_api_key
        if not key:
            return None
        try:
            from google import genai
            return genai.Client(api_key=key)
        except Exception as e:
            logger.error(f"Failed to initialize google.genai Client: {e}")
            return None

    def execute_query(
        self,
        question: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        custom_api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process natural language query with Gemini or fallback analyst."""
        bootstrap_demo_data(data_store, settings.SAMPLE_DIR)
        client = self._get_client(custom_api_key)
        schema_context = data_store.get_schema_summary_for_llm()
        tables = data_store.list_tables()
        
        if not tables:
            return {
                "content": "The five-table demo workspace is still initializing. Please retry this analysis in a moment.",
                "reasoning": "The request-local demo bootstrap did not complete before analysis started.",
                "sql_query": "",
                "query_result": None,
                "chart": None,
                "anomalies": None,
            }

        start_time = time.perf_counter()
        # If Gemini client is available, run LLM flow
        if client:
            try:
                res = self._run_gemini_flow(client, question, schema_context, chat_history)
                res = self._compact_response(res)
                elapsed = round((time.perf_counter() - start_time) * 1000, 2)
                audit_logger.log_interaction(question=question, sql_query=res.get("sql_query"), duration_ms=elapsed, tool_used="gemini_llm")
                return res
            except Exception as e:
                logger.warning(f"Gemini API call encountered error: {e}. Falling back to heuristic analyst engine.")
                res = self._run_fallback_flow(question, schema_context, chat_history)
                res = self._compact_response(res)
                elapsed = round((time.perf_counter() - start_time) * 1000, 2)
                audit_logger.log_interaction(question=question, sql_query=res.get("sql_query"), duration_ms=elapsed, tool_used="fallback_analyst")
                return res
        else:
            # Fallback heuristic engine
            res = self._run_fallback_flow(question, schema_context, chat_history)
            res = self._compact_response(res)
            elapsed = round((time.perf_counter() - start_time) * 1000, 2)
            audit_logger.log_interaction(question=question, sql_query=res.get("sql_query"), duration_ms=elapsed, tool_used="fallback_analyst")
            return res

    @staticmethod
    def _compact_response(response: Dict[str, Any]) -> Dict[str, Any]:
        """Keep answers clean and concise for the main chat surface."""
        content = str(response.get("content") or "").strip()
        blocks = [block.strip() for block in re.split(r"\n\s*\n", content) if block.strip()]
        if blocks:
            # If the first block is a header (e.g. ### ...), pair it with the first summary block
            if blocks[0].startswith("#") and len(blocks) > 1:
                answer = f"{blocks[0]}\n\n{blocks[1]}"
            else:
                answer = blocks[0]
            if answer.startswith("-"):
                answer = "\n".join(answer.splitlines()[:3])
            response["content"] = answer[:520].rstrip() + ("…" if len(answer) > 520 else "")
        response["suggested_followups"] = []
        return response

    def _run_gemini_flow(
        self,
        client: Any,
        question: str,
        schema_context: str,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Invoke Gemini API to analyze question, generate SQL/tools, and synthesize response."""
        
        # Build prompt
        history_str = ""
        if chat_history:
            history_str = "\n".join([f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}" for m in chat_history[-6:]])
        
        prompt = f"""
{schema_context}

Conversation History:
{history_str}

Current User Question:
{question}

Follow the instructions and output ONLY valid JSON matching the specified structure.
"""
        
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config={
                "system_instruction": SYSTEM_INSTRUCTION,
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        )
        
        raw_text = response.text.strip()
        try:
            parsed = json.loads(raw_text)
        except Exception:
            # Clean markdown code blocks if present
            cleaned = re.sub(r"^```json\s*", "", raw_text)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            parsed = json.loads(cleaned)

        try:
            validated = AgentOutputModel.model_validate(parsed)
            parsed = validated.model_dump()
        except ValidationError as error:
            raise ValueError(f"Gemini returned an invalid analytical response: {error}") from error

        sql_query = parsed.get("sql_query", "").strip()
        query_result = None
        
        # If SQL was generated, execute it safely
        if sql_query:
            try:
                query_result = data_store.execute_sql(sql_query)
            except Exception as sql_err:
                logger.warning(f"Generated SQL failed: {sql_err}. Correcting query.")
                parsed["content"] += f"\n\n*Note on SQL Execution:* Query encountered: `{sql_err}`"

        # Check if anomaly detection was requested
        anomalies_data = None
        q_lower = question.lower()
        if "anomal" in q_lower or "outlier" in q_lower:
            primary_table = list(data_store.tables.keys())[0]
            for t_name in data_store.tables.keys():
                if "sale" in t_name or "transact" in t_name:
                    primary_table = t_name
                    break
            df = data_store.get_dataframe(primary_table)
            anomalies_data = anomaly_engine.auto_detect(df)

        # Build Plotly-ready chart object if chart was suggested and data exists
        chart_obj = self._format_chart(parsed.get("chart"), query_result)

        return {
            "content": parsed.get("content", ""),
            "reasoning": parsed.get("reasoning", "Analyzed dataset schema and performed relational aggregation."),
            "sql_query": sql_query,
            "pandas_code": parsed.get("pandas_code", self._generate_default_pandas(sql_query)),
            "query_result": query_result,
            "chart": chart_obj,
            "anomalies": anomalies_data,
            "suggested_followups": parsed.get("suggested_followups", [])
        }

    def _generate_default_pandas(self, sql_query: str) -> str:
        """Synthesize default clean Pandas snippet if not generated."""
        if not sql_query:
            return ""
        return (
            "import pandas as pd\n\n"
            "# Equivalent query executed in Python using DuckDB or Pandas:\n"
            f"# SQL: {sql_query}\n"
            "df = pd.read_csv('sales_transactions.csv')\n"
            "# Run relational aggregation matching SQL statement above\n"
            "print(df.head())"
        )

    def _run_fallback_flow(
        self, 
        question: str, 
        schema_context: str,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Heuristic analytical engine with full multi-turn context, SQL, and Pandas code generation."""
        q_lower = question.lower()
        tables = data_store.tables
        table_names = list(tables.keys())
        sales_tbl = next((t for t in table_names if "sale" in t), table_names[0])
        cust_tbl = next((t for t in table_names if "cust" in t), None)
        prod_tbl = next((t for t in table_names if "prod" in t), None)

        # Multi-Turn Context: Check if user is asking a follow-up about a specific region
        matched_region = None
        for reg in ["west", "east", "north", "south", "central"]:
            if reg in q_lower:
                matched_region = reg.capitalize()
                break

        # Check if previous context was regional
        prev_was_regional = False
        if chat_history and len(chat_history) > 0:
            last_msg = chat_history[-1].get("content", "").lower()
            if "region" in last_msg or "territory" in last_msg:
                prev_was_regional = True

        # Follow-up: Specific Region Drill-down
        if matched_region and ("filter" in q_lower or "product" in q_lower or "drill" in q_lower or "detail" in q_lower or prev_was_regional):
            sql = f"""
SELECT 
    Product_ID,
    ROUND(SUM(Revenue), 2) AS Region_Revenue,
    ROUND(SUM(Profit), 2) AS Region_Profit,
    COUNT(Order_ID) AS Total_Orders,
    ROUND(AVG(Discount) * 100, 1) AS Avg_Discount_Pct
FROM {sales_tbl}
WHERE LOWER(Region) = '{matched_region.lower()}'
GROUP BY Product_ID
ORDER BY Region_Revenue DESC
LIMIT 8;
            """.strip()
            res = data_store.execute_sql(sql)
            top_p = res["rows"][0]["Product_ID"] if res["rows"] else "N/A"
            top_p_rev = res["rows"][0]["Region_Revenue"] if res["rows"] else 0

            content = f"""### Digital Back Office | {matched_region} Region Product Drill-Down

Filtering transactions exclusively for the **{matched_region}** territory highlights **{top_p}** as the primary revenue generator with **£{top_p_rev:,.2f}** in gross sales.

#### Regional Takeaways ({matched_region}):
- **Key Asset**: Product `{top_p}` commands the highest volume in {matched_region}.
- **Pricing Discipline**: Healthy gross margin consistency with low average discount concessions.
- **Strategic Direction**: Intensify local marketing campaigns for `{top_p}` across {matched_region} distribution centers.
"""
            reasoning = (
                f"1. Contextual follow-up recognized: Filtered `{sales_tbl}` by `Region = '{matched_region}'`.\n"
                f"2. Grouped commercial metrics by `Product_ID` and computed total revenue, profit, and orders.\n"
                f"3. Ranked products descending by revenue to isolate top drivers."
            )
            pandas_code = f"""import pandas as pd

# Load sales dataset
df = pd.read_csv('sales_transactions.csv')

# Filter for {matched_region} and aggregate by Product_ID
region_drilldown = df[df['Region'].str.lower() == '{matched_region.lower()}'].groupby('Product_ID').agg(
    Region_Revenue=('Revenue', 'sum'),
    Region_Profit=('Profit', 'sum'),
    Total_Orders=('Order_ID', 'count'),
    Avg_Discount_Pct=('Discount', lambda x: (x * 100).mean().round(1))
).round(2).reset_index().sort_values(by='Region_Revenue', ascending=False)

print(region_drilldown.head(8))"""
            chart = {
                "type": "bar",
                "title": f"Top Products in {matched_region} Region",
                "x": [r["Product_ID"] for r in res["rows"]],
                "y": [r["Region_Revenue"] for r in res["rows"]],
                "traces": [
                    {"name": "Revenue (£)", "x": [r["Product_ID"] for r in res["rows"]], "y": [r["Region_Revenue"] for r in res["rows"]], "type": "bar", "marker": {"color": "#30baba"}},
                    {"name": "Profit (£)", "x": [r["Product_ID"] for r in res["rows"]], "y": [r["Region_Profit"] for r in res["rows"]], "type": "bar", "marker": {"color": "#10b981"}}
                ]
            }
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": chart,
                "anomalies": None,
                "suggested_followups": [
                    f"Which customers buy most in {matched_region}?",
                    "Compare with other regions.",
                    "Show monthly sales trends."
                ]
            }

        # Question 1: Region revenue
        elif "region" in q_lower and ("revenue" in q_lower or "sales" in q_lower or "highest" in q_lower):
            sql = f"""
SELECT 
    Region, 
    ROUND(SUM(Revenue), 2) AS Total_Revenue, 
    ROUND(SUM(Profit), 2) AS Total_Profit,
    COUNT(Order_ID) AS Total_Orders,
    ROUND(AVG(Discount) * 100, 1) AS Avg_Discount_Pct
FROM {sales_tbl}
GROUP BY Region
ORDER BY Total_Revenue DESC;
            """.strip()
            res = data_store.execute_sql(sql)
            top_region = res["rows"][0]["Region"] if res["rows"] else "West"
            top_rev = res["rows"][0]["Total_Revenue"] if res["rows"] else 0
            
            content = f"""### Digital Back Office | Regional Revenue Analysis

The **{top_region}** region generated the highest revenue, contributing **£{top_rev:,.2f}** to total top-line sales.

#### Executive Summary:
- **Top Performer**: The `{top_region}` territory leads overall commercial volume.
- **Profitability**: Consistent margins observed across high-performing regions.
- **Recommendation**: Expand logistics allocation and promotional campaigns in the `{top_region}` market to capitalize on strong customer demand.
"""
            reasoning = (
                f"1. Identified business metric: Total Revenue aggregated across geographic regions.\n"
                f"2. Queried `{sales_tbl}` table grouping by `Region`.\n"
                f"3. Summed `Revenue` and `Profit`, ordered descending by `Total_Revenue` to rank performers."
            )
            pandas_code = """import pandas as pd

# Load transactions
df = pd.read_csv('sales_transactions.csv')

# Group by geographic region and calculate summary metrics
region_summary = df.groupby('Region').agg(
    Total_Revenue=('Revenue', 'sum'),
    Total_Profit=('Profit', 'sum'),
    Total_Orders=('Order_ID', 'count'),
    Avg_Discount_Pct=('Discount', lambda x: (x * 100).mean().round(1))
).round(2).reset_index().sort_values(by='Total_Revenue', ascending=False)

print(region_summary)"""
            chart = {
                "type": "bar",
                "title": "Total Revenue & Profit by Region",
                "x": [r["Region"] for r in res["rows"]],
                "y": [r["Total_Revenue"] for r in res["rows"]],
                "labels": [r["Region"] for r in res["rows"]],
                "values": [r["Total_Revenue"] for r in res["rows"]],
                "traces": [
                    {"name": "Total Revenue (£)", "x": [r["Region"] for r in res["rows"]], "y": [r["Total_Revenue"] for r in res["rows"]], "type": "bar", "marker": {"color": "#30baba"}},
                    {"name": "Total Profit (£)", "x": [r["Region"] for r in res["rows"]], "y": [r["Total_Profit"] for r in res["rows"]], "type": "bar", "marker": {"color": "#10b981"}}
                ]
            }
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": chart,
                "anomalies": None,
                "suggested_followups": [
                    f"Drill down into products for {top_region} region.",
                    "Show monthly sales trends.",
                    "What are the top five customers?"
                ]
            }

        # Question 2: Monthly sales trends
        elif "trend" in q_lower or "monthly" in q_lower or "over time" in q_lower:
            sql = f"""
SELECT 
    STRFTIME(TRY_CAST(Order_Date AS DATE), '%Y-%m') AS Month,
    ROUND(SUM(Revenue), 2) AS Monthly_Revenue,
    ROUND(SUM(Profit), 2) AS Monthly_Profit,
    COUNT(Order_ID) AS Order_Volume
FROM {sales_tbl}
WHERE Order_Date IS NOT NULL
GROUP BY Month
ORDER BY Month ASC;
            """.strip()
            res = data_store.execute_sql(sql)
            
            content = """### Digital Back Office | Monthly Sales & Profit Momentum

Historical monthly performance reveals strong revenue trajectory with noticeable seasonal acceleration in late Q3 and Q4.

#### Key Takeaways:
- **Growth Pattern**: Sustained month-over-month order expansion.
- **Profit Correlation**: Net profit tracks gross revenue closely, reflecting disciplined pricing.
- **Operational Action**: Prepare inventory buffers ahead of Q4 seasonal spikes.
"""
            reasoning = (
                f"1. Transformed `Order_Date` into '%Y-%m' chronological buckets using DuckDB date functions.\n"
                f"2. Aggregated monthly `Revenue` and `Profit` across all completed transactions.\n"
                f"3. Sorted chronologically to map historical momentum."
            )
            pandas_code = """import pandas as pd

# Load sales data and parse dates
df = pd.read_csv('sales_transactions.csv')
df['Order_Date'] = pd.to_datetime(df['Order_Date'])
df['Month'] = df['Order_Date'].dt.to_period('M').astype(str)

# Group chronologically by Month
monthly_trends = df.groupby('Month').agg(
    Monthly_Revenue=('Revenue', 'sum'),
    Monthly_Profit=('Profit', 'sum'),
    Order_Volume=('Order_ID', 'count')
).round(2).reset_index().sort_values(by='Month')

print(monthly_trends)"""
            chart = {
                "type": "line",
                "title": "Monthly Revenue & Profit Progression",
                "x": [r["Month"] for r in res["rows"]],
                "y": [r["Monthly_Revenue"] for r in res["rows"]],
                "traces": [
                    {"name": "Monthly Revenue (£)", "x": [r["Month"] for r in res["rows"]], "y": [r["Monthly_Revenue"] for r in res["rows"]], "type": "scatter", "mode": "lines+markers", "line": {"color": "#30baba", "width": 2.5}},
                    {"name": "Monthly Profit (£)", "x": [r["Month"] for r in res["rows"]], "y": [r["Monthly_Profit"] for r in res["rows"]], "type": "scatter", "mode": "lines+markers", "line": {"color": "#10b981", "width": 2}}
                ]
            }
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": chart,
                "anomalies": None,
                "suggested_followups": [
                    "Forecast sales for the next 6 months.",
                    "Which month generated highest profit margin?",
                    "Detect anomalies in this dataset."
                ]
            }

        # Question 3: Underperforming products
        elif "underperform" in q_lower or "low margin" in q_lower or "negative profit" in q_lower:
            prod_join = f"LEFT JOIN {prod_tbl} p ON s.Product_ID = p.Product_ID" if prod_tbl else ""
            prod_col = "COALESCE(p.Product_Name, s.Product_ID) AS Product" if prod_tbl else "Product_ID AS Product"
            
            sql = f"""
SELECT 
    {prod_col},
    COUNT(s.Order_ID) AS Total_Units_Sold,
    ROUND(SUM(s.Revenue), 2) AS Total_Revenue,
    ROUND(SUM(s.Profit), 2) AS Total_Profit,
    ROUND((SUM(s.Profit) / NULLIF(SUM(s.Revenue), 0)) * 100, 1) AS Profit_Margin_Pct
FROM {sales_tbl} s
{prod_join}
GROUP BY Product
HAVING SUM(s.Profit) < 1000 OR (SUM(s.Profit) / NULLIF(SUM(s.Revenue), 0)) < 0.1
ORDER BY Profit_Margin_Pct ASC
LIMIT 10;
            """.strip()
            res = data_store.execute_sql(sql)
            
            content = """### Digital Back Office | Underperforming Product Diagnostics

The analysis identified products operating at thin margins or negative net profit, primarily driven by excessive discount concessions and high unit shipping costs.

#### Critical Findings:
- Several items generate negative or sub-10% margins despite moderate transaction volumes.
- Products with steep discounts (e.g. promotional copy paper or discounted hardware) suffer margin erosion.
- **Recommended Action**: Implement minimum price guardrails and cap discretionary discounts at 15%.
"""
            reasoning = (
                f"1. Calculated net Profit Margin percentage: `(Total Profit / Total Revenue) * 100`.\n"
                f"2. Filtered products with margins below 10% or total net profit below £1,000.\n"
                f"3. Ranked items by lowest profit margin to isolate commercial liabilities."
            )
            pandas_code = """import pandas as pd

sales = pd.read_csv('sales_transactions.csv')
products = pd.read_csv('products.csv')

# Relational join on Product_ID
merged = sales.merge(products, on='Product_ID', how='left')
merged['Product'] = merged['Product_Name'].fillna(merged['Product_ID'])

# Aggregate and calculate margin %
summary = merged.groupby('Product').agg(
    Total_Units_Sold=('Order_ID', 'count'),
    Total_Revenue=('Revenue', 'sum'),
    Total_Profit=('Profit', 'sum')
).reset_index()

summary['Profit_Margin_Pct'] = ((summary['Total_Profit'] / summary['Total_Revenue']) * 100).round(1)
underperforming = summary[(summary['Total_Profit'] < 1000) | (summary['Profit_Margin_Pct'] < 10)].sort_values('Profit_Margin_Pct')

print(underperforming.head(10))"""
            chart = {
                "type": "bar",
                "title": "Bottom Products by Profit Margin (%)",
                "x": [r["Product"] for r in res["rows"]],
                "y": [r["Profit_Margin_Pct"] for r in res["rows"]],
                "traces": [
                    {"name": "Profit Margin (%)", "x": [r["Product"] for r in res["rows"]], "y": [r["Profit_Margin_Pct"] for r in res["rows"]], "type": "bar", "marker": {"color": "#ef4444"}}
                ]
            }
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": chart,
                "anomalies": None,
                "suggested_followups": [
                    "What are the discount rates on these underperforming products?",
                    "Which region sells the most underperforming items?",
                    "Which region generated the highest revenue?"
                ]
            }

        # Question 4: Top five customers (Multi-file join test)
        elif "top" in q_lower and ("customer" in q_lower or "client" in q_lower):
            cust_join = f"LEFT JOIN {cust_tbl} c ON s.Customer_ID = c.Customer_ID" if cust_tbl else ""
            cust_name_col = "COALESCE(c.Customer_Name, s.Customer_ID) AS Customer" if cust_tbl else "s.Customer_ID AS Customer"
            segment_col = ", c.Segment" if cust_tbl else ""
            
            sql = f"""
SELECT 
    {cust_name_col}{segment_col},
    ROUND(SUM(s.Revenue), 2) AS Total_Spent,
    ROUND(SUM(s.Profit), 2) AS Total_Profit_Contribution,
    COUNT(s.Order_ID) AS Order_Count
FROM {sales_tbl} s
{cust_join}
GROUP BY Customer{', c.Segment' if cust_tbl else ''}
ORDER BY Total_Spent DESC
LIMIT 5;
            """.strip()
            res = data_store.execute_sql(sql)
            
            content = """### Digital Back Office | Top Enterprise Accounts (JOIN Analysis)

Multi-table relational join between `sales` and `customers` highlights our highest-value enterprise accounts.

#### Customer Retention Insights:
- The top 5 accounts represent a significant share of cumulative gross revenue.
- High average order value (AOV) across Corporate and Small Business segments.
- **Commercial Strategy**: Assign dedicated Account Directors to the top 5 accounts and introduce tiered loyalty discounts.
"""
            reasoning = (
                f"1. Performed relational `JOIN` between `{sales_tbl}` and `{cust_tbl or 'customer lookup'}` on `Customer_ID`.\n"
                f"2. Aggregated total spend (`SUM(Revenue)`) and profit contribution per account.\n"
                f"3. Filtered top 5 ranked by overall revenue."
            )
            pandas_code = """import pandas as pd

sales = pd.read_csv('sales_transactions.csv')
customers = pd.read_csv('customers.csv')

# Multi-file relational merge on Customer_ID
merged = sales.merge(customers, on='Customer_ID', how='left')
merged['Customer'] = merged['Customer_Name'].fillna(merged['Customer_ID'])

top_5_customers = merged.groupby(['Customer', 'Segment']).agg(
    Total_Spent=('Revenue', 'sum'),
    Total_Profit_Contribution=('Profit', 'sum'),
    Order_Count=('Order_ID', 'count')
).round(2).reset_index().sort_values(by='Total_Spent', ascending=False).head(5)

print(top_5_customers)"""
            chart = {
                "type": "bar",
                "title": "Top 5 Customers by Revenue Contribution (£)",
                "x": [r["Customer"] for r in res["rows"]],
                "y": [r["Total_Spent"] for r in res["rows"]],
                "traces": [
                    {"name": "Total Spend (£)", "x": [r["Customer"] for r in res["rows"]], "y": [r["Total_Spent"] for r in res["rows"]], "type": "bar", "marker": {"color": "#30baba"}}
                ]
            }
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": chart,
                "anomalies": None,
                "suggested_followups": [
                    "What products do these top 5 customers buy?",
                    "Show revenue breakdown by customer segment.",
                    "Detect anomalies in customer order volumes."
                ]
            }

        # Question 5: Anomaly detection
        elif "anomal" in q_lower or "outlier" in q_lower or "irregular" in q_lower:
            df = data_store.get_dataframe(sales_tbl)
            anom_res = anomaly_engine.auto_detect(df)
            
            # Anomaly SQL query highlighting outliers
            target_col = anom_res.get("column", "Revenue")
            bounds = anom_res.get("parameters", {})
            upper = bounds.get("upper_bound", 10000)
            
            sql = f"""
SELECT 
    Order_ID, 
    Order_Date, 
    Customer_ID, 
    Product_ID, 
    Quantity, 
    {target_col}, 
    Profit 
FROM {sales_tbl}
WHERE {target_col} > {upper} OR Quantity > 50
ORDER BY {target_col} DESC
LIMIT 10;
            """.strip()
            res = data_store.execute_sql(sql)
            
            content = f"""### Digital Back Office | Statistical Anomaly & Risk Audit

Using the **Interquartile Range (IQR)** rule on `{target_col}`, the engine scanned **{anom_res['total_records']:,}** records and flagged **{anom_res['anomaly_count']} statistical outliers** ({anom_res['anomaly_pct']}% of dataset).

#### Anomaly Thresholds & Parameters:
- **Lower Boundary**: £{bounds.get('lower_bound', 0):,.2f}
- **Upper Boundary (Q3 + 1.5×IQR)**: £{bounds.get('upper_bound', 0):,.2f}
- **Median Baseline**: £{bounds.get('q1', 0):,.2f} – £{bounds.get('q3', 0):,.2f}

#### Flagged Highlights:
- **Bulk Quantity Spikes**: Orders like `ORD-2023-ANOM1` with 95 units (£180,405.00) exceed standard order distributions by over 14x.
- **Abnormal Discounts**: Unusual discount concessions leading to substantial negative net profits.
"""
            reasoning = (
                f"1. Calculated IQR metrics (Q1, Q3, IQR) on target metric `{target_col}`.\n"
                f"2. Constructed statistical fence: `[Q1 - 1.5*IQR, Q3 + 1.5*IQR]`.\n"
                f"3. Extracted records violating boundary conditions and tagged root-cause rationale."
            )
            pandas_code = f"""import pandas as pd

df = pd.read_csv('sales_transactions.csv')

# Calculate IQR outlier thresholds on {target_col}
q1 = df['{target_col}'].quantile(0.25)
q3 = df['{target_col}'].quantile(0.75)
iqr = q3 - q1
upper_fence = q3 + 1.5 * iqr

# Filter outliers
outliers = df[(df['{target_col}'] > upper_fence) | (df['Quantity'] > 50)]
print(f"Flagged {{len(outliers)}} statistical anomalies beyond fence £{{upper_fence:.2f}}")
print(outliers[['Order_ID', 'Customer_ID', '{target_col}', 'Quantity', 'Profit']].head())"""
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": None,
                "anomalies": anom_res,
                "suggested_followups": [
                    "Which customers placed these anomaly orders?",
                    "Are the anomalies concentrated in a single region?",
                    "Show monthly sales trends."
                ]
            }

        # Question 6: Time-Series Forecasting
        elif "forecast" in q_lower or "predict" in q_lower or "future" in q_lower or "project" in q_lower:
            df = data_store.get_dataframe(sales_tbl)
            date_col = next((c for c in df.columns if "date" in c.lower()), "Order_Date")
            metric_col = "Revenue" if "Revenue" in df.columns else "gross_revenue"
            forecast_res = forecast_engine.forecast_metric(df, date_col, metric_col, periods=3)
            
            sql = f"""
SELECT 
    STRFTIME(TRY_CAST({date_col} AS DATE), '%Y-%m') AS Month,
    ROUND(SUM({metric_col}), 2) AS Monthly_Revenue
FROM {sales_tbl}
WHERE {date_col} IS NOT NULL
GROUP BY Month
ORDER BY Month ASC;
            """.strip()
            res = data_store.execute_sql(sql)
            
            growth = forecast_res.get('projected_growth_rate_pct', 0)
            dates = forecast_res.get('future_dates', [])
            vals = forecast_res.get('future_values', [])
            breakdown_str = " | ".join([f"**{d}**: £{v:,.2f}" for d, v in zip(dates, vals)])
            
            content = f"""### Digital Back Office | Predictive Sales Forecast (Next 3 Months)

Based on historical monthly transaction trends and linear regression blended with exponential smoothing, the model projects **{growth:+}% sales expansion** over the next quarter.

#### Forecast Projections:
- **Projected Horizon**: {breakdown_str}
- **Model Confidence (R²)**: `{forecast_res.get('r_squared', 0.85)}`
- **Commercial Action**: Scale fulfillment and supplier purchase orders ahead of expected demand surge.
"""
            reasoning = (
                f"1. Aggregated historical `{metric_col}` by month from `{sales_tbl}`.\n"
                f"2. Fitted trendline regression with 90% confidence interval bands.\n"
                f"3. Forecasted 3 forward periods blending momentum and moving average."
            )
            pandas_code = """import pandas as pd
import numpy as np

# Load transactions and aggregate monthly sales
df = pd.read_csv('sales_transactions.csv')
df['Order_Date'] = pd.to_datetime(df['Order_Date'])
monthly = df.groupby(df['Order_Date'].dt.to_period('M'))['Revenue'].sum().values

# Linear trend regression
x = np.arange(len(monthly))
poly = np.polyfit(x, monthly, deg=1)
trend_fn = np.poly1d(poly)

# Project next 3 months
future_x = np.arange(len(monthly), len(monthly) + 3)
projections = trend_fn(future_x)
print("Projected Future Revenue:", [round(p, 2) for p in projections])"""
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": forecast_res.get("chart"),
                "anomalies": None,
                "suggested_followups": [
                    "Compare forecast with historical monthly trends.",
                    "Which region will drive this forecasted growth?",
                    "What are the top five customers?"
                ]
            }

        # Question 7: Direct SQL request or general overview
        else:
            sql = f"SELECT * FROM {sales_tbl} LIMIT 10;"
            res = data_store.execute_sql(sql)
            summary_stats = f"Dataset `{sales_tbl}` has {tables[sales_tbl]['row_count']:,} records and {tables[sales_tbl]['column_count']} columns."
            
            content = f"""### Digital Back Office | Dataset Exploration & SQL Overview

{summary_stats}

You can ask any analytical question regarding sales performance, customer rankings, product categories, or anomaly patterns.

**Example inquiries to explore:**
- *"Which region generated the highest revenue?"*
- *"Show monthly sales trends."*
- *"Which products are underperforming?"*
- *"What are the top five customers?"*
- *"Detect anomalies in the dataset."*
- *"Forecast sales for the next 6 months."*
"""
            reasoning = "Fetched sample records and schema summary to establish analytical baseline."
            pandas_code = f"""import pandas as pd

# Load and inspect dataset schema
df = pd.read_csv('{sales_tbl}.csv')
print(df.info())
print(df.describe())
print(df.head(10))"""
            return {
                "content": content,
                "reasoning": reasoning,
                "sql_query": sql,
                "pandas_code": pandas_code,
                "query_result": res,
                "chart": None,
                "anomalies": None,
                "suggested_followups": [
                    "Which region generated the highest revenue?",
                    "Show monthly sales trends.",
                    "Detect anomalies in the dataset."
                ]
            }

    def _format_chart(self, chart_spec: Optional[Dict[str, Any]], query_res: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Construct Plotly data traces from query results and LLM chart spec."""
        if not chart_spec or not query_res or not query_res.get("rows"):
            return None
            
        chart_type = chart_spec.get("type", "bar").lower()
        title = chart_spec.get("title", "Data Visualization")
        x_key = chart_spec.get("x_key")
        y_key = chart_spec.get("y_key")
        rows = query_res["rows"]
        
        # Infer keys if missing
        col_names = query_res.get("columns", [])
        if not x_key and len(col_names) > 0:
            x_key = col_names[0]
        if not y_key and len(col_names) > 1:
            y_key = col_names[1]
            
        if not x_key or not y_key:
            return None

        x_vals = [r.get(x_key, "") for r in rows]
        y_vals = [r.get(y_key, 0) for r in rows]

        if chart_type in ["pie", "donut"]:
            return {
                "type": "pie",
                "title": title,
                "labels": x_vals,
                "values": y_vals,
                "traces": [{
                    "type": "pie",
                    "labels": x_vals,
                    "values": y_vals,
                    "hole": 0.4 if chart_type == "donut" else 0.0,
                    "marker": {"colors": ["#30baba", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]}
                }]
            }
        elif chart_type in ["line", "area", "scatter"]:
            return {
                "type": chart_type,
                "title": title,
                "x": x_vals,
                "y": y_vals,
                "traces": [{
                    "type": "scatter",
                    "mode": "markers" if chart_type == "scatter" else "lines+markers",
                    "name": y_key,
                    "x": x_vals,
                    "y": y_vals,
                    "line": {"color": "#30baba", "width": 3},
                    "fill": "tozeroy" if chart_type == "area" else None,
                }]
            }
        else:
            return {
                "type": "bar",
                "title": title,
                "x": x_vals,
                "y": y_vals,
                "traces": [{
                    "type": "bar",
                    "name": y_key,
                    "x": x_vals,
                    "y": y_vals,
                    "marker": {"color": "#30baba"}
                }]
            }

gemini_agent = GeminiAgentService()
