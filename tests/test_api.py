import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

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


def test_demo_workspace_is_ready_with_five_tables():
    response = client.get("/api/datasets", headers={"x-session-id": "fresh-demo-session"})
    assert response.status_code == 200
    assert len(response.json()["tables"]) == 5

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
    response = client.get("/api/export/report?format=markdown", headers={"x-session-id": "test-export"})
    assert response.status_code == 200
    assert "Digital Back Office" in response.text


def test_session_history_isolated_for_exports():
    loaded = client.post("/api/load-sample", headers={"x-session-id": "session-a"})
    assert loaded.status_code == 200
    first = client.post(
        "/api/chat",
        json={"question": "Which region generated the highest revenue?"},
        headers={"x-session-id": "session-a"},
    )
    assert first.status_code == 200
    report_a = client.get("/api/export/report?format=markdown", headers={"x-session-id": "session-a"})
    report_b = client.get("/api/export/report?format=markdown", headers={"x-session-id": "session-b"})
    assert "Regional Revenue Analysis" in report_a.text
    assert "Regional Revenue Analysis" not in report_b.text
    assert len(client.get("/api/datasets", headers={"x-session-id": "session-a"}).json()["tables"]) == 5
    assert len(client.get("/api/datasets", headers={"x-session-id": "session-b"}).json()["tables"]) == 5


def test_upload_rejects_non_csv():
    response = client.post(
        "/api/upload",
        files={"files": ("notes.txt", b"not,csv\n1,2\n", "text/plain")},
    )
    assert response.status_code == 400
    assert "not a CSV" in response.json()["detail"]


def test_upload_uses_safe_storage_name():
    response = client.post(
        "/api/upload",
        files={"files": ("../../customer data.csv", b"id,value\n1,10\n", "text/csv")},
    )
    assert response.status_code == 200
    uploaded = response.json()["tables"][0]
    assert uploaded["original_filename"] == "customer data.csv"
    assert all(path.name != "customer data.csv" for path in settings.DATA_DIR.iterdir())
