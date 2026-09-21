import datetime
from typing import Any, Dict, List
from app.services.data_store import data_store
from app.services.profiler import profiler

class ReportExporter:
    """Generates executive analytical reports in Markdown and clean HTML format."""

    @staticmethod
    def generate_markdown_report(session_history: List[Dict[str, Any]]) -> str:
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        tables = data_store.list_tables()
        
        md = []
        md.append("# Digital Back Office Ltd. - AI Data Analyst Executive Report")
        md.append(f"**Generated:** {now_str}  \n**Environment:** In-Memory DuckDB Engine + Gemini AI Analyst\n")
        md.append("---")
        
        md.append("## 1. Loaded Datasets & Scope")
        for t in tables:
            md.append(f"- **Table:** `{t['table_name']}` ({t['original_filename']}) - **{t['row_count']:,}** records, **{t['column_count']}** attributes")
        md.append("")

        md.append("## 2. Analytical Findings & Queries")
        for i, item in enumerate(session_history, 1):
            q = item.get("question", "Analysis")
            res = item.get("response", {})
            content = res.get("content", "")
            sql = res.get("sql_query", "")
            reasoning = res.get("reasoning", "")
            
            md.append(f"### 2.{i} Business Question: {q}")
            if reasoning:
                md.append(f"**Methodology & Reasoning:**\n{reasoning}\n")
            if sql:
                md.append(f"**DuckDB SQL Executed:**\n```sql\n{sql}\n```\n")
            if content:
                md.append(f"**Executive Insights:**\n{content}\n")
            md.append("---")

        md.append("\n*Report compiled autonomously by Digital Back Office AI Data Analyst.*")
        return "\n".join(md)

    @staticmethod
    def generate_html_report(session_history: List[Dict[str, Any]]) -> str:
        md_content = ReportExporter.generate_markdown_report(session_history)
        # Convert to clean HTML with styling
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Digital Back Office AI Data Analyst - Executive Report</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #f8fafc; }}
  .container {{ background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; }}
  h1 {{ color: #0f172a; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-top: 0; }}
  h2 {{ color: #334155; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }}
  h3 {{ color: #4f46e5; margin-top: 24px; }}
  pre {{ background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; }}
  code {{ font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }}
  pre code {{ background: transparent; color: inherit; padding: 0; }}
  .badge {{ display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px; }}
  hr {{ border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; }}
  blockquote {{ border-left: 4px solid #6366f1; margin: 0; padding-left: 16px; color: #64748b; }}
</style>
</head>
<body>
<div class="container">
  <h1>Digital Back Office Ltd.</h1>
  <p><span class="badge">AI Data Analyst Executive Report</span> Generated on {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
  <hr>
  <pre style="white-space: pre-wrap; background: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1;">{md_content}</pre>
</div>
</body>
</html>
"""
        return html

exporter = ReportExporter()
