"""
Seed postcode_seifa from Kaggle model_df_with_clusters.csv.

Expected CSV location:
    Layer5-Data/datasets/model_df_with_clusters.csv
"""

from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Iterable

import psycopg2


def _normalize_postcode(raw: str) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None
    if value.endswith(".0"):
        value = value[:-2]
    if not value.isdigit():
        return None
    return value.zfill(4)


def _to_int(raw: str) -> int | None:
    value = (raw or "").strip()
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def _to_float(raw: str) -> float | None:
    value = (raw or "").strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


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


def _read_rows(csv_path: Path) -> tuple[list[dict[str, str]], int]:
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return rows, len(rows)


def _valid_rows(rows: Iterable[dict[str, str]], valid_region_postcodes: set[str]) -> tuple[list[tuple], int, int]:
    output: list[tuple] = []
    invalid_count = 0
    missing_fk_count = 0

    for row in rows:
        postcode = _normalize_postcode(row.get("postcode", ""))
        irsd_score = _to_float(row.get("irsd_score", ""))
        irsd_decile = _to_int(row.get("irsd_decile", ""))
        total_population = _to_int(row.get("total_population", ""))
        regional_category = (row.get("regional_category", "") or "").strip()

        unemployment_rate = _to_float(row.get("unemployment_rate", ""))
        rent_to_income_ratio = _to_float(row.get("rent_to_income_ratio", ""))
        unemployment_rate_sqrt = _to_float(row.get("unemployment_rate_sqrt", ""))
        rent_to_income_ratio_log = _to_float(row.get("rent_to_income_ratio_log", ""))
        unemployment_rate_log = _to_float(row.get("unemployment_rate_log", ""))
        total_population_log = _to_float(row.get("total_population_log", ""))
        single_parent_pct = _to_float(row.get("single_parent_pct", ""))
        median_hhd_income_weekly = _to_float(row.get("median_hhd_income_weekly", ""))
        median_rent_weekly = _to_float(row.get("median_rent_weekly", ""))
        rent_to_income_final = _to_float(row.get("rent_to_income_final", ""))

        if (
            not postcode
            or irsd_score is None
            or irsd_decile is None
            or total_population is None
            or not regional_category
        ):
            invalid_count += 1
            continue

        if irsd_decile < 1 or irsd_decile > 10:
            invalid_count += 1
            continue

        if postcode not in valid_region_postcodes:
            missing_fk_count += 1
            continue

        output.append((
            postcode,
            irsd_score,
            irsd_decile,
            unemployment_rate,
            rent_to_income_ratio,
            unemployment_rate_sqrt,
            rent_to_income_ratio_log,
            unemployment_rate_log,
            total_population_log,
            single_parent_pct,
            median_hhd_income_weekly,
            median_rent_weekly,
            rent_to_income_final,
            total_population,
            regional_category,
        ))

    return output, invalid_count, missing_fk_count


def main() -> None:
    database_url = _load_database_url()
    csv_path = _repo_root() / "Layer5-Data" / "datasets" / "model_df_with_clusters.csv"

    rows, loaded_count = _read_rows(csv_path)

    upsert_sql = """
        INSERT INTO postcode_seifa (
            postcode,
            irsd_score,
            irsd_decile,
            unemployment_rate,
            rent_to_income_ratio,
            unemployment_rate_sqrt,
            rent_to_income_ratio_log,
            unemployment_rate_log,
            total_population_log,
            single_parent_pct,
            median_hhd_income_weekly,
            median_rent_weekly,
            rent_to_income_final,
            total_population,
            regional_category,
            last_updated
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_DATE)
        ON CONFLICT (postcode) DO UPDATE
        SET
            irsd_score = EXCLUDED.irsd_score,
            irsd_decile = EXCLUDED.irsd_decile,
            unemployment_rate = EXCLUDED.unemployment_rate,
            rent_to_income_ratio = EXCLUDED.rent_to_income_ratio,
            unemployment_rate_sqrt = EXCLUDED.unemployment_rate_sqrt,
            rent_to_income_ratio_log = EXCLUDED.rent_to_income_ratio_log,
            unemployment_rate_log = EXCLUDED.unemployment_rate_log,
            total_population_log = EXCLUDED.total_population_log,
            single_parent_pct = EXCLUDED.single_parent_pct,
            median_hhd_income_weekly = EXCLUDED.median_hhd_income_weekly,
            median_rent_weekly = EXCLUDED.median_rent_weekly,
            rent_to_income_final = EXCLUDED.rent_to_income_final,
            total_population = EXCLUDED.total_population,
            regional_category = EXCLUDED.regional_category,
            last_updated = CURRENT_DATE;
    """

    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM region_categories;")
            region_count = cur.fetchone()[0]
            if region_count == 0:
                raise RuntimeError(
                    "region_categories is empty. Seed region_categories first (expected 759 rows)."
                )

            cur.execute("SELECT postcode FROM region_categories;")
            valid_region_postcodes = {row[0] for row in cur.fetchall()}

            payload_rows, invalid_count, missing_fk_count = _valid_rows(rows, valid_region_postcodes)

            inserted_count = 0
            for data_row in payload_rows:
                cur.execute(upsert_sql, data_row)
                inserted_count += 1

            cur.execute("SELECT COUNT(*) FROM postcode_seifa;")
            total_seeded = cur.fetchone()[0]

    print(f"Loaded CSV: {loaded_count} rows")
    print(f"Inserted: {inserted_count}")
    print(f"Skipped invalid rows: {invalid_count}")
    print(f"Skipped missing region_categories FK: {missing_fk_count}")
    print(f"Total in postcode_seifa: {total_seeded}")


if __name__ == "__main__":
    main()
