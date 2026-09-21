import pandas as pd
import pytest
from app.services.profiler import DataProfiler

def test_profiler_metrics():
    df = pd.DataFrame({
        "order_id": ["ORD-1", "ORD-2", "ORD-3", "ORD-4", "ORD-5"],
        "price": [10.5, 20.0, None, 45.0, 50.0],
        "category": ["Tech", "Office", "Tech", "Office", "Furniture"],
        "date": ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05"]
    })
    
    report = DataProfiler.profile_dataframe(df, "test_table")
    assert report["total_rows"] == 5
    assert report["total_columns"] == 4
    assert report["health_score"] > 80.0
    
    cols = {c["name"]: c for c in report["columns"]}
    assert cols["price"]["null_count"] == 1
    assert cols["price"]["type"] == "numeric"
    assert cols["category"]["type"] == "categorical"
    assert len(report["recommendations"]) > 0
