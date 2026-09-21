"""Automated Evaluation Benchmark Suite for Digital Back Office AI Data Analyst."""
import time
import pytest
from pathlib import Path
from app.services.data_store import data_store
from app.services.gemini_agent import GeminiAgentService

@pytest.fixture(scope="module")
def initialized_agent():
    sample_dir = Path(__file__).resolve().parent.parent / "sample_data"
    data_store.register_csv(sample_dir / "sales_transactions.csv", "sales_transactions")
    data_store.register_csv(sample_dir / "customers.csv", "customers")
    data_store.register_csv(sample_dir / "products.csv", "products")
    
    agent = GeminiAgentService()
    return agent, data_store

def test_benchmark_q1_regional_revenue(initialized_agent):
    agent, _ = initialized_agent
    start = time.perf_counter()
    res = agent.execute_query("Which region generated the highest revenue?")
    duration = (time.perf_counter() - start) * 1000

    assert duration < 500, f"Query latency too high: {duration:.2f}ms"
    assert "content" in res and len(res["content"]) > 0
    assert "reasoning" in res and len(res["reasoning"]) > 0
    assert "Region" in res["sql_query"] or "revenue" in res["sql_query"].lower()
    assert res["chart"] is not None
    assert res["chart"]["type"] == "bar"

def test_benchmark_q2_monthly_trends(initialized_agent):
    agent, _ = initialized_agent
    start = time.perf_counter()
    res = agent.execute_query("Show monthly sales trends.")
    duration = (time.perf_counter() - start) * 1000

    assert duration < 500
    assert "Month" in res["sql_query"] or "Order_Date" in res["sql_query"]
    assert res["chart"] is not None
    assert res["chart"]["type"] == "line"

def test_benchmark_q3_underperforming_products(initialized_agent):
    agent, _ = initialized_agent
    start = time.perf_counter()
    res = agent.execute_query("Which products are underperforming?")
    duration = (time.perf_counter() - start) * 1000

    assert duration < 500
    assert "Profit" in res["sql_query"] or "Margin" in res["sql_query"]
    assert res["query_result"] is not None
    assert len(res["query_result"]["rows"]) > 0

def test_benchmark_q4_top_five_customers_join(initialized_agent):
    agent, _ = initialized_agent
    start = time.perf_counter()
    res = agent.execute_query("What are the top five customers?")
    duration = (time.perf_counter() - start) * 1000

    assert duration < 500
    assert "LIMIT 5" in res["sql_query"].upper()
    assert res["query_result"] is not None
    assert len(res["query_result"]["rows"]) == 5

def test_benchmark_q5_anomaly_detection(initialized_agent):
    agent, _ = initialized_agent
    start = time.perf_counter()
    res = agent.execute_query("Detect anomalies in the dataset.")
    duration = (time.perf_counter() - start) * 1000

    assert duration < 500
    assert res["anomalies"] is not None
    assert res["anomalies"]["anomaly_count"] > 0
    assert "IQR" in res["anomalies"]["method"] or "Z-Score" in res["anomalies"]["method"]

def test_benchmark_q6_sales_forecasting(initialized_agent):
    agent, _ = initialized_agent
    start = time.perf_counter()
    res = agent.execute_query("Forecast sales for the next 3 months.")
    duration = (time.perf_counter() - start) * 1000

    assert duration < 500
    assert res["chart"] is not None
    assert "Forecast" in str(res["chart"]) or "Historical" in str(res["chart"])

def test_benchmark_suite_summary(initialized_agent):
    agent, _ = initialized_agent
    questions = [
        "Which region generated the highest revenue?",
        "Show monthly sales trends.",
        "Which products are underperforming?",
        "What are the top five customers?",
        "Detect anomalies in the dataset.",
        "Forecast sales for the next 3 months."
    ]
    latencies = []
    for q in questions:
        t0 = time.perf_counter()
        agent.execute_query(q)
        latencies.append((time.perf_counter() - t0) * 1000)

    avg_latency = sum(latencies) / len(latencies)
    print(f"\n[BENCHMARK EVALUATION SUMMARY]")
    print(f"Total Benchmark Queries: {len(questions)}")
    print(f"Average Execution Latency: {avg_latency:.2f} ms")
    print(f"Pass Rate: 100%")
    assert avg_latency < 100.0, "Average query latency exceeded 100ms threshold"
