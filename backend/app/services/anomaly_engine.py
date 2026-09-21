import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional
from sklearn.ensemble import IsolationForest

class AnomalyDetectionEngine:
    """Multi-method statistical and machine-learning anomaly detection engine."""

    @staticmethod
    def detect_iqr(df: pd.DataFrame, column: str, multiplier: float = 1.5) -> Dict[str, Any]:
        """Detect anomalies using the Interquartile Range (IQR) rule."""
        if column not in df.columns:
            raise ValueError(f"Column '{column}' does not exist in dataset.")
        
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if len(series) < 4:
            return {"error": "Insufficient numeric data for IQR detection."}
        
        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        lower_bound = round(q1 - (multiplier * iqr), 2)
        upper_bound = round(q3 + (multiplier * iqr), 2)
        
        # Outliers mask
        mask = (series < lower_bound) | (series > upper_bound)
        outlier_indices = series[mask].index
        
        outliers: List[Dict[str, Any]] = []
        for idx in outlier_indices:
            val = float(series.loc[idx])
            reason = (
                f"Value {val:,.2f} is higher than upper bound {upper_bound:,.2f} (Q3 + {multiplier}*IQR)"
                if val > upper_bound
                else f"Value {val:,.2f} is lower than lower bound {lower_bound:,.2f} (Q1 - {multiplier}*IQR)"
            )
            row_dict = df.loc[idx].to_dict()
            # Clean timestamp / NaNs in row_dict
            clean_row = {k: ("" if pd.isna(v) else str(v) if isinstance(v, (pd.Timestamp, pd.Period)) else v) for k, v in row_dict.items()}
            outliers.append({
                "row_index": int(idx),
                "value": val,
                "reason": reason,
                "record": clean_row
            })
            
        return {
            "method": "IQR (Interquartile Range)",
            "column": column,
            "total_records": len(series),
            "anomaly_count": len(outliers),
            "anomaly_pct": round((len(outliers) / len(series)) * 100, 2),
            "parameters": {
                "q1": round(q1, 2),
                "q3": round(q3, 2),
                "iqr": round(iqr, 2),
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "multiplier": multiplier
            },
            "anomalies": outliers[:50],  # Cap sample
        }

    @staticmethod
    def detect_zscore(df: pd.DataFrame, column: str, threshold: float = 3.0) -> Dict[str, Any]:
        """Detect anomalies using standard Z-scores."""
        if column not in df.columns:
            raise ValueError(f"Column '{column}' does not exist in dataset.")
            
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if len(series) < 4:
            return {"error": "Insufficient numeric data for Z-score detection."}
            
        mean = float(series.mean())
        std = float(series.std())
        if std == 0:
            return {"error": "Standard deviation is zero; cannot compute Z-scores."}
            
        z_scores = (series - mean) / std
        mask = z_scores.abs() > threshold
        outlier_indices = series[mask].index
        
        outliers: List[Dict[str, Any]] = []
        for idx in outlier_indices:
            val = float(series.loc[idx])
            z_val = round(float(z_scores.loc[idx]), 2)
            direction = "above" if z_val > 0 else "below"
            reason = f"Z-score of {abs(z_val)} is {direction} mean ({mean:,.2f}), exceeding {threshold}σ limit."
            row_dict = df.loc[idx].to_dict()
            clean_row = {k: ("" if pd.isna(v) else str(v) if isinstance(v, (pd.Timestamp, pd.Period)) else v) for k, v in row_dict.items()}
            outliers.append({
                "row_index": int(idx),
                "value": val,
                "z_score": z_val,
                "reason": reason,
                "record": clean_row
            })
            
        return {
            "method": "Z-Score Analysis",
            "column": column,
            "total_records": len(series),
            "anomaly_count": len(outliers),
            "anomaly_pct": round((len(outliers) / len(series)) * 100, 2),
            "parameters": {
                "mean": round(mean, 2),
                "std": round(std, 2),
                "threshold": threshold,
            },
            "anomalies": outliers[:50],
        }

    @staticmethod
    def detect_multivariate_isolation_forest(
        df: pd.DataFrame,
        numeric_columns: Optional[List[str]] = None,
        contamination: float = 0.015
    ) -> Dict[str, Any]:
        """Detect multi-variate anomalies across multiple numerical columns using Isolation Forest."""
        if numeric_columns is None:
            numeric_columns = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]
            
        if len(numeric_columns) < 1:
            return {"error": "No numeric columns available for Isolation Forest."}
            
        clean_df = df[numeric_columns].dropna()
        if len(clean_df) < 10:
            return {"error": "Insufficient data points for Isolation Forest."}
            
        iso = IsolationForest(contamination=contamination, random_state=42)
        preds = iso.fit_predict(clean_df)
        scores = iso.decision_function(clean_df)
        
        # Outliers have pred == -1
        outlier_indices = clean_df.index[preds == -1]
        
        outliers: List[Dict[str, Any]] = []
        for idx in outlier_indices:
            anomaly_score = round(float(-scores[clean_df.index.get_loc(idx)]), 3)
            row_dict = df.loc[idx].to_dict()
            clean_row = {k: ("" if pd.isna(v) else str(v) if isinstance(v, (pd.Timestamp, pd.Period)) else v) for k, v in row_dict.items()}
            
            # Formulate multi-variate reason
            col_highlights = []
            for col in numeric_columns[:3]:
                col_val = df.loc[idx, col]
                col_highlights.append(f"{col}={col_val}")
            
            reason = f"Unusual combination of metrics ({', '.join(col_highlights)}) with anomaly score {anomaly_score}."
            outliers.append({
                "row_index": int(idx),
                "anomaly_score": anomaly_score,
                "reason": reason,
                "record": clean_row
            })
            
        return {
            "method": "Multi-variate Isolation Forest",
            "columns_evaluated": numeric_columns,
            "total_records": len(clean_df),
            "anomaly_count": len(outliers),
            "anomaly_pct": round((len(outliers) / len(clean_df)) * 100, 2),
            "parameters": {
                "contamination": contamination,
            },
            "anomalies": outliers[:50],
        }

    def auto_detect(self, df: pd.DataFrame, preferred_column: Optional[str] = None) -> Dict[str, Any]:
        """Automatically find the most critical anomalies across key numeric columns (e.g. Revenue, Profit, Quantity)."""
        numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        if not numeric_cols:
            return {"error": "No numeric columns found for anomaly detection."}
            
        target_col = preferred_column if (preferred_column and preferred_column in numeric_cols) else None
        
        if not target_col:
            # Prioritize standard financial/quantity metric names
            for candidate in ["Revenue", "gross_revenue", "Profit", "Quantity", "Total_Amount", "Price"]:
                for c in numeric_cols:
                    if candidate.lower() in c.lower():
                        target_col = c
                        break
                if target_col:
                    break
        
        if not target_col:
            target_col = numeric_cols[0]
            
        # Run IQR and Z-Score
        iqr_result = self.detect_iqr(df, target_col)
        return iqr_result

anomaly_engine = AnomalyDetectionEngine()
