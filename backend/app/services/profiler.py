import numpy as np
import pandas as pd
from typing import Any, Dict, List

class DataProfiler:
    """Automated data quality profiling and schema inspection engine."""
    
    @staticmethod
    def profile_dataframe(df: pd.DataFrame, table_name: str = "dataset") -> Dict[str, Any]:
        total_rows = len(df)
        total_cols = len(df.columns)
        
        if total_rows == 0:
            return {
                "table_name": table_name,
                "total_rows": 0,
                "total_columns": total_cols,
                "health_score": 0,
                "columns": [],
                "summary": "Empty dataset",
            }

        # Memory usage
        memory_bytes = df.memory_usage(deep=True).sum()
        memory_mb = round(memory_bytes / (1024 * 1024), 2)
        
        # Duplicate rows
        duplicate_rows = int(df.duplicated().sum())
        duplicate_pct = round((duplicate_rows / total_rows) * 100, 2)
        
        columns_profile: List[Dict[str, Any]] = []
        total_null_cells = 0
        total_cells = total_rows * total_cols
        
        for col in df.columns:
            series = df[col]
            null_count = int(series.isna().sum())
            total_null_cells += null_count
            null_pct = round((null_count / total_rows) * 100, 2)
            n_unique = int(series.nunique(dropna=True))
            
            # Detect logical data type
            if pd.api.types.is_numeric_dtype(series):
                dtype_category = "numeric"
            elif pd.api.types.is_datetime64_any_dtype(series):
                dtype_category = "datetime"
            else:
                # Check if parseable as datetime
                dtype_category = "categorical"
                if series.dropna().shape[0] > 0 and isinstance(series.dropna().iloc[0], str):
                    try:
                        sample_val = str(series.dropna().iloc[0])
                        if len(sample_val) >= 8 and ("-" in sample_val or "/" in sample_val):
                            pd.to_datetime(series.dropna().head(10))
                            dtype_category = "datetime"
                    except Exception:
                        pass
            
            col_info: Dict[str, Any] = {
                "name": col,
                "raw_type": str(series.dtype),
                "type": dtype_category,
                "null_count": null_count,
                "null_pct": null_pct,
                "unique_count": n_unique,
                "is_unique": n_unique == total_rows,
            }
            
            # Detailed stats
            if dtype_category == "numeric":
                clean_num = series.dropna()
                if len(clean_num) > 0:
                    col_info["stats"] = {
                        "min": round(float(clean_num.min()), 2),
                        "q25": round(float(clean_num.quantile(0.25)), 2),
                        "median": round(float(clean_num.median()), 2),
                        "q75": round(float(clean_num.quantile(0.75)), 2),
                        "max": round(float(clean_num.max()), 2),
                        "mean": round(float(clean_num.mean()), 2),
                        "std": round(float(clean_num.std()), 2) if len(clean_num) > 1 else 0.0,
                    }
            elif dtype_category == "categorical":
                top_vals = series.value_counts(dropna=True).head(5)
                col_info["top_values"] = [
                    {"value": str(k), "count": int(v), "percentage": round((v / total_rows) * 100, 1)}
                    for k, v in top_vals.items()
                ]
            elif dtype_category == "datetime":
                try:
                    dt_series = pd.to_datetime(series.dropna())
                    col_info["datetime_range"] = {
                        "min": str(dt_series.min()),
                        "max": str(dt_series.max()),
                        "span_days": int((dt_series.max() - dt_series.min()).days)
                    }
                except Exception:
                    pass
            
            columns_profile.append(col_info)
            
        # Calculate overall Health Score (0 - 100)
        # Completeness penalty: proportion of missing values
        completeness_ratio = 1.0 - (total_null_cells / max(total_cells, 1))
        # Duplicate penalty
        duplicate_ratio = 1.0 - (duplicate_rows / max(total_rows, 1))
        
        raw_score = (completeness_ratio * 70.0) + (duplicate_ratio * 30.0)
        health_score = max(0, min(100, round(raw_score, 1)))
        
        # Recommendations
        recommendations = []
        if duplicate_rows > 0:
            recommendations.append(f"Found {duplicate_rows} duplicate rows ({duplicate_pct}%). Consider deduplicating.")
        if total_null_cells > 0:
            null_cols = [c["name"] for c in columns_profile if c["null_count"] > 0]
            recommendations.append(f"Missing values detected in columns: {', '.join(null_cols[:5])}.")
        if not recommendations:
            recommendations.append("Dataset passed all basic cleanliness checks with high data integrity.")

        return {
            "table_name": table_name,
            "total_rows": total_rows,
            "total_columns": total_cols,
            "memory_mb": memory_mb,
            "duplicate_rows": duplicate_rows,
            "duplicate_pct": duplicate_pct,
            "health_score": health_score,
            "columns": columns_profile,
            "recommendations": recommendations,
        }

profiler = DataProfiler()
