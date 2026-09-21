import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
os.makedirs(LOG_DIR, exist_ok=True)
AUDIT_LOG_FILE = LOG_DIR / "audit.jsonl"

class AuditLogger:
    def __init__(self):
        self.log_file = AUDIT_LOG_FILE

    def log_interaction(
        self,
        question: str,
        sql_query: Optional[str] = None,
        duration_ms: Optional[float] = None,
        tool_used: Optional[str] = None,
        status: str = "success",
        error: Optional[str] = None
    ):
        entry = {
            "timestamp": time.time(),
            "datetime": time.strftime("%Y-%m-%d %H:%M:%S"),
            "question": question,
            "sql_query": sql_query or "",
            "duration_ms": duration_ms or 0.0,
            "tool_used": tool_used or "direct_query",
            "status": status,
            "error": error or ""
        }
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            logging.error(f"Failed writing audit log: {e}")

    def get_recent_logs(self, limit: int = 50) -> list[Dict[str, Any]]:
        if not self.log_file.exists():
            return []
        try:
            with open(self.log_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
            logs = [json.loads(line.strip()) for line in lines if line.strip()]
            return logs[-limit:][::-1]
        except Exception as e:
            logging.error(f"Failed reading audit logs: {e}")
            return []

audit_logger = AuditLogger()
