"""
Seed region_categories from model_df_with_clusters.csv.

Expected CSV location:
    Layer5-Data/datasets/model_df_with_clusters.csv
"""

from __future__ import annotations

import csv
import os
from pathlib import Path

import psycopg2


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_database_url() -> str:
    repo_root = _repo_root()
    backend_env = repo_root / "Layer3-Backend" / ".env"

    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    if backend_env.exists():
        for line in backend_env.read_text(encoding="utf-8-sig").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key.strip() == "DATABASE_URL":
                database_url = value.strip().strip('"').strip("'")
                break

    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Add it to Layer3-Backend/.env.")
    return database_url


def main() -> None:
    database_url = _load_database_url()
    csv_path = _repo_root() / "Layer5-Data" / "datasets" / "model_df_with_clusters.csv"

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    rows = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            postcode = (row.get("postcode", "") or "").strip()
            if postcode.endswith(".0"):
                postcode = postcode[:-2]
            if not postcode.isdigit():
                continue
            postcode = postcode.zfill(4)
            regional_category = (row.get("regional_category", "") or "").strip()
            if postcode and regional_category:
                rows.append((postcode, regional_category))

    upsert_sql = """
        INSERT INTO region_categories (postcode, regional_category)
        VALUES (%s, %s)
        ON CONFLICT (postcode) DO UPDATE
        SET regional_category = EXCLUDED.regional_category;
    """

    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.executemany(upsert_sql, rows)
            cur.execute("SELECT COUNT(*) FROM region_categories;")
            total = cur.fetchone()[0]

    print(f"Loaded CSV: {len(rows)} rows")
    print(f"Total in region_categories: {total}")


if __name__ == "__main__":
    main()
