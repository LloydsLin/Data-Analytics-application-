import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Digital Back Office" in data["project"]

def test_load_sample_datasets():
    response = client.post("/api/load-sample")
    assert response.status_code == 200
    data = response.json()
    assert len(data["tables"]) >= 1
    assert "sales_transactions" in [t["table_name"] for t in data["tables"]]

def test_list_datasets():
    response = client.get("/api/datasets")
    assert response.status_code == 200
    data = response.json()
    assert "tables" in data
    assert len(data["tables"]) >= 1

def test_chat_query():
    # Test Question 1: Region revenue
    payload = {"question": "Which region generated the highest revenue?"}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    assert "reasoning" in data
    assert "sql_query" in data
    assert data["chart"] is not None
    assert data["chart"]["type"] == "bar"

def test_chat_anomaly_query():
    payload = {"question": "Detect anomalies in the dataset."}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    assert data["anomalies"] is not None
    assert data["anomalies"]["anomaly_count"] > 0

def test_sql_playground_execution():
    payload = {"query": "SELECT COUNT(*) AS total_count FROM sales_transactions;"}
    response = client.post("/api/sql/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_rows"] == 1
    assert data["rows"][0]["total_count"] > 0

def test_export_report():
    response = client.get("/api/export/report?format=markdown")
    assert response.status_code == 200
    assert "Digital Back Office" in response.text
