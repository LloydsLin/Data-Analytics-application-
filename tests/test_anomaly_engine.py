import pandas as pd
import pytest
from app.services.anomaly_engine import AnomalyDetectionEngine

@pytest.fixture
def sample_df():
    data = {
        "id": list(range(1, 101)),
        "amount": [100.0 + (i % 10) * 5 for i in range(98)] + [5000.0, 8000.0],
        "quantity": [2] * 98 + [50, 80]
    }
    return pd.DataFrame(data)

def test_iqr_anomaly_detection(sample_df):
    engine = AnomalyDetectionEngine()
    result = engine.detect_iqr(sample_df, "amount")
    assert result["anomaly_count"] == 2
    assert result["method"].startswith("IQR")
    assert "parameters" in result
    assert result["anomalies"][0]["value"] in [5000.0, 8000.0]
    assert "higher than upper bound" in result["anomalies"][0]["reason"]

def test_zscore_anomaly_detection(sample_df):
    engine = AnomalyDetectionEngine()
    result = engine.detect_zscore(sample_df, "amount", threshold=2.5)
    assert result["anomaly_count"] >= 2
    assert "z_score" in result["anomalies"][0]
    assert "exceeding" in result["anomalies"][0]["reason"]

def test_isolation_forest_detection(sample_df):
    engine = AnomalyDetectionEngine()
    result = engine.detect_multivariate_isolation_forest(sample_df, ["amount", "quantity"], contamination=0.03)
    assert result["anomaly_count"] > 0
    assert "anomaly_score" in result["anomalies"][0]
