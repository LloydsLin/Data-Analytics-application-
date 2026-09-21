import pytest
from pathlib import Path
from app.services.data_store import DataStore

@pytest.fixture
def store():
    ds = DataStore()
    sample_dir = Path(__file__).resolve().parent.parent / "sample_data"
    ds.register_csv(sample_dir / "sales_transactions.csv", "sales")
    ds.register_csv(sample_dir / "customers.csv", "customers")
    ds.register_csv(sample_dir / "products.csv", "products")
    yield ds
    ds.reset()

def test_tables_registered(store):
    tables = store.list_tables()
    assert len(tables) == 3
    table_names = [t["table_name"] for t in tables]
    assert "sales" in table_names
    assert "customers" in table_names
    assert "products" in table_names

def test_sql_aggregation(store):
    res = store.execute_sql("SELECT Region, SUM(Revenue) AS Total_Rev FROM sales GROUP BY Region;")
    assert len(res["rows"]) > 0
    assert "Region" in res["columns"]
    assert "Total_Rev" in res["columns"]
    assert res["execution_time_ms"] >= 0

def test_multi_table_join(store):
    query = """
    SELECT 
        c.Customer_Name, 
        p.Product_Name, 
        s.Revenue
    FROM sales s
    JOIN customers c ON s.Customer_ID = c.Customer_ID
    JOIN products p ON s.Product_ID = p.Product_ID
    LIMIT 5;
    """
    res = store.execute_sql(query)
    assert len(res["rows"]) == 5
    assert "Customer_Name" in res["columns"]
    assert "Product_Name" in res["columns"]

def test_destructive_sql_rejection(store):
    with pytest.raises(PermissionError):
        store.execute_sql("DROP TABLE sales;")

    with pytest.raises(PermissionError):
        store.execute_sql("DELETE FROM sales WHERE Quantity > 5;")
