import os
import re
import time
from contextvars import ContextVar
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import duckdb
import pandas as pd

class DataStore:
    def __init__(self):
        # In-memory DuckDB connection
        self.conn = duckdb.connect(database=":memory:", read_only=False)
        self.tables: Dict[str, Dict[str, Any]] = {}
        self.file_paths: Dict[str, Path] = {}

    def _sanitize_table_name(self, name: str) -> str:
        base = Path(name).stem
        sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", base).lower()
        if sanitized and sanitized[0].isdigit():
            sanitized = f"t_{sanitized}"
        return sanitized or "table_1"

    def register_csv(
        self,
        file_path: Path,
        custom_table_name: Optional[str] = None,
        max_rows: int = 250_000,
        max_columns: int = 250,
    ) -> str:
        source_name = Path(custom_table_name or file_path.name).name
        if Path(source_name).suffix.lower() != ".csv":
            source_name = f"{source_name}.csv"
        sanitized_target = self._sanitize_table_name(custom_table_name or file_path.name)
        existing = next(
            (name for name, meta in self.tables.items()
             if name == sanitized_target or meta.get("original_filename") in (source_name, file_path.name)),
            None,
        )
        if existing:
            return existing

        table_name = self._sanitize_table_name(custom_table_name or file_path.name)

        # Do not replace an existing table when two uploads have the same stem.
        base_table_name = table_name
        suffix = 2
        while table_name in self.tables:
            table_name = f"{base_table_name}_{suffix}"
            suffix += 1
        
        # Load into DuckDB using read_csv_auto
        escaped_path = str(file_path).replace("'", "''")
        query = f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{escaped_path}', header=True, sample_size=-1);"
        self.conn.execute(query)
        
        # Cache metadata
        row_count = self.conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        col_info = self.conn.execute(f"PRAGMA table_info('{table_name}')").fetchall()
        if row_count > max_rows or len(col_info) > max_columns:
            self.conn.execute(f"DROP TABLE {table_name}")
            raise ValueError(
                f"CSV exceeds limits (rows={row_count}, columns={len(col_info)}; "
                f"maximums are {max_rows} rows and {max_columns} columns)."
            )
        columns = [{"name": c[1], "type": str(c[2]), "nullable": not bool(c[3])} for c in col_info]
        
        # Get sample rows
        sample_df = self.conn.execute(f"SELECT * FROM {table_name} LIMIT 3").fetchdf()
        
        self.tables[table_name] = {
            "table_name": table_name,
            "original_filename": file_path.name,
            "row_count": row_count,
            "column_count": len(columns),
            "columns": columns,
            "sample_rows": sample_df.to_dict(orient="records"),
        }
        self.file_paths[table_name] = file_path
        return table_name

    def list_tables(self) -> List[Dict[str, Any]]:
        return list(self.tables.values())

    def get_table_info(self, table_name: str) -> Optional[Dict[str, Any]]:
        return self.tables.get(table_name)

    def get_dataframe(self, table_name: str) -> pd.DataFrame:
        if table_name not in self.tables:
            raise ValueError(f"Table '{table_name}' does not exist.")
        return self.conn.execute(f"SELECT * FROM {table_name}").fetchdf()

    def execute_sql(self, query: str, max_rows: int = 500) -> Dict[str, Any]:
        """Safely execute a SQL query against DuckDB and return records + timing."""
        if not isinstance(query, str) or not query.strip():
            raise ValueError("A SQL query is required.")
        clean_query = query.strip()
        if clean_query.endswith(";"):
            clean_query = clean_query[:-1].rstrip()
        if ";" in clean_query or "--" in clean_query or "/*" in clean_query or "*/" in clean_query:
            raise PermissionError("Only one plain read-only SQL statement is permitted.")

        # DuckDB is deliberately exposed as a read-only analytical surface. An
        # allowlist at the statement boundary plus blocked file/network functions
        # prevents mutation and arbitrary file access through SELECT expressions.
        if not re.match(r"^(SELECT|WITH)\b", clean_query, re.IGNORECASE):
            raise PermissionError("Only SELECT and WITH queries are permitted.")
        forbidden = [
            r"\b(INSERT|UPDATE|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|ATTACH|DETACH|COPY|EXPORT|IMPORT|INSTALL|LOAD|CALL)\b",
            r"\b(read_csv|read_csv_auto|read_parquet|parquet_scan|glob|httpfs|sqlite_scan|postgres_scan|mysql_scan)\s*\(",
        ]
        if any(re.search(pattern, clean_query, re.IGNORECASE) for pattern in forbidden):
            raise PermissionError("Destructive, external-file, or extension SQL operations are not permitted.")
        max_rows = max(1, min(int(max_rows or 500), 10_000))
        
        start_time = time.perf_counter()
        cursor = self.conn.execute(clean_query)
        col_names = [desc[0] for desc in cursor.description] if cursor.description else []
        
        # Fetch up to max_rows
        df = cursor.fetchdf()
        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        
        total_rows = len(df)
        truncated = total_rows > max_rows
        display_df = df.head(max_rows)
        
        # Handle NaN and date serialization
        records = display_df.fillna("").to_dict(orient="records")
        for row in records:
            for k, v in row.items():
                if isinstance(v, (pd.Timestamp, pd.Period)):
                    row[k] = str(v)
        
        return {
            "sql": clean_query,
            "columns": col_names,
            "rows": records,
            "total_rows": total_rows,
            "displayed_rows": len(display_df),
            "truncated": truncated,
            "execution_time_ms": execution_time_ms
        }

    def get_schema_summary_for_llm(self) -> str:
        """Constructs a comprehensive schema representation for the LLM prompt,
        including relationships, data types, and sample values.
        """
        if not self.tables:
            return "Demo workspace is initializing."
        
        lines = ["=== AVAILABLE DATABASE TABLES ==="]
        for name, meta in self.tables.items():
            lines.append(f"\nTable: `{name}` (From file: '{meta['original_filename']}', Rows: {meta['row_count']}, Columns: {meta['column_count']})")
            lines.append("Columns:")
            for col in meta["columns"]:
                lines.append(f"  - `{col['name']}` ({col['type']})")
            
            # Show sample row
            if meta["sample_rows"]:
                sample = meta["sample_rows"][0]
                sample_str = ", ".join([f"{k}: {repr(v)}" for k, v in list(sample.items())[:6]])
                lines.append(f"  Sample row: {{{sample_str}}}")
        
        # Detect common relational foreign keys across tables
        table_names = list(self.tables.keys())
        if len(table_names) > 1:
            lines.append("\n=== DETECTED RELATIONAL KEYS (FOR JOINS) ===")
            seen_relationships = set()
            for i, t1 in enumerate(table_names):
                cols1 = {c["name"].lower(): c["name"] for c in self.tables[t1]["columns"]}
                for t2 in table_names[i+1:]:
                    cols2 = {c["name"].lower(): c["name"] for c in self.tables[t2]["columns"]}
                    common = set(cols1.keys()).intersection(set(cols2.keys()))
                    for key in common:
                        if "id" in key or "code" in key or "key" in key:
                            rel = f"`{t1}`.{cols1[key]} = `{t2}`.{cols2[key]}"
                            if rel not in seen_relationships:
                                seen_relationships.add(rel)
                                lines.append(f"  - Possible JOIN key: {rel}")
        
        return "\n".join(lines)

    def reset(self):
        self.conn.close()
        self.conn = duckdb.connect(database=":memory:", read_only=False)
        self.tables.clear()
        self.file_paths.clear()

_session_id: ContextVar[str] = ContextVar("data_store_session_id", default="default")


def set_session_id(session_id: Optional[str]):
    """Set the request-local store key; middleware owns the context lifetime."""
    return _session_id.set((session_id or "default").strip()[:128] or "default")


def reset_session_id(token):
    _session_id.reset(token)


def current_session_id() -> str:
    return _session_id.get()


class SessionDataStoreProxy:
    """Preserve the existing DataStore API while routing requests by session."""

    def __init__(self):
        self._stores: Dict[str, DataStore] = {"default": DataStore()}

    def _current(self) -> DataStore:
        key = _session_id.get()
        if key not in self._stores:
            self._stores[key] = DataStore()
        return self._stores[key]

    def __getattr__(self, name):
        return getattr(self._current(), name)

    def reset_current(self):
        key = _session_id.get()
        current = self._stores.pop(key, None)
        if current is not None:
            current.reset()
        self._stores[key] = DataStore()


data_store = SessionDataStoreProxy()
