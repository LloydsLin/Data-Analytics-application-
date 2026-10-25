from pathlib import Path

from app.services.data_store import SessionDataStoreProxy


DEMO_FILES = [
    ("sales_transactions.csv", "sales_transactions"),
    ("customers.csv", "customers"),
    ("products.csv", "products"),
    ("monthly_targets.csv", "monthly_targets"),
    ("regional_targets.csv", "regional_targets"),
]


def bootstrap_demo_data(store: SessionDataStoreProxy, sample_dir: Path):
    """Keep a fresh session ready with the five bundled demo tables."""
    if store.tables:
        return store.list_tables()

    loaded = []
    for filename, table_name in DEMO_FILES:
        path = sample_dir / filename
        if path.exists():
            registered = store.register_csv(path, custom_table_name=table_name)
            loaded.append(store.get_table_info(registered))
    return loaded
