"""
Convert and filter the ABS Postal Areas shapefile to the 495 regional Victorian
postcodes in region_categories, then write a compact GeoJSON for the frontend map.

what todo:
  1. Download POA_2021_AUST_GDA2020_SHP.zip from:
     https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files
  2. Place the zip in Layer5-Data/datasets/
  3. Run:  python3 filter_geojson.py
  4. Output goes to:  Layer2-Frontend/donor-app/public/vic_regional_postcodes.geojson

Requires:  pip install geopandas
"""

from __future__ import annotations

import csv
import json
import zipfile
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_known_postcodes(csv_path: Path) -> set[str]:
    known: set[str] = set()
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            pc = (row.get("postcode", "") or "").strip()
            if pc.endswith(".0"):
                pc = pc[:-2]
            if pc.isdigit():
                known.add(pc.zfill(4))
    return known


def main() -> None:
    try:
        import geopandas as gpd
    except ImportError:
        raise SystemExit(
            "geopandas is required. Install it with:\n"
            "  pip install geopandas\n"
            "or if using the project venv:\n"
            "  venv/bin/pip install geopandas"
        )

    repo = _repo_root()
    csv_path = repo / "Layer5-Data" / "datasets" / "model_df_with_clusters.csv"
    zip_path = repo / "Layer5-Data" / "datasets" / "POA_2021_AUST_GDA2020_SHP.zip"
    out_path = repo / "Layer2-Frontend" / "donor-app" / "public" / "vic_regional_postcodes.geojson"

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    if not zip_path.exists():
        raise FileNotFoundError(
            f"Shapefile zip not found: {zip_path}\n\n"
            "Download POA_2021_AUST_GDA2020_SHP.zip from:\n"
            "  https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-"
            "asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files\n"
            "and place it in Layer5-Data/datasets/"
        )

    known = _load_known_postcodes(csv_path)
    print(f"Known postcodes from CSV: {len(known)}")

    # Extract and read the shapefile from inside the zip
    print("Reading shapefile from zip (this may take 30-60 seconds)...")
    with zipfile.ZipFile(zip_path) as zf:
        shp_names = [n for n in zf.namelist() if n.endswith(".shp")]
        if not shp_names:
            raise ValueError("No .shp file found inside the zip")
        extract_dir = zip_path.parent / "_poa_extract"
        zf.extractall(extract_dir)

    shp_path = extract_dir / Path(shp_names[0]).name
    # geopandas can read directly from the zip path too
    gdf = gpd.read_file(str(shp_path))
    print(f"Total features in shapefile: {len(gdf)}")

    # Filter to known postcodes
    pc_col = next((c for c in gdf.columns if "POA_CODE" in c.upper()), None)
    if not pc_col:
        # fallback: try first column that looks like postcodes
        pc_col = gdf.columns[0]
    print(f"Using postcode column: {pc_col!r}")

    gdf[pc_col] = gdf[pc_col].astype(str).str.zfill(4)
    filtered = gdf[gdf[pc_col].isin(known)].copy()
    print(f"Filtered to {len(filtered)} features")

    # Rename column to POA_CODE21 for consistency with the frontend
    if pc_col != "POA_CODE21":
        filtered = filtered.rename(columns={pc_col: "POA_CODE21"})

    # Also keep POA_NAME21 for area name display in the frontend
    name_col = next((c for c in filtered.columns if "POA_NAME" in c.upper()), None)
    if name_col and name_col != "POA_NAME21":
        filtered = filtered.rename(columns={name_col: "POA_NAME21"})

    keep_cols = ["POA_CODE21"] + (["POA_NAME21"] if "POA_NAME21" in filtered.columns else []) + ["geometry"]
    drop_cols = [c for c in filtered.columns if c not in keep_cols]
    filtered = filtered.drop(columns=drop_cols)

    # Reproject to WGS84 (EPSG:4326) — required by Leaflet
    filtered = filtered.to_crs(epsg=4326)

    # Write compact GeoJSON
    out_path.parent.mkdir(parents=True, exist_ok=True)
    geojson_str = filtered.to_json(show_bbox=False, drop_id=True)
    # Re-parse and re-dump to minify
    out_path.write_text(
        json.dumps(json.loads(geojson_str), separators=(",", ":")),
        encoding="utf-8",
    )

    size_mb = out_path.stat().st_size / 1_048_576
    print(f"Written to: {out_path}  ({size_mb:.1f} MB)")

    # Clean up extracted files
    import shutil
    shutil.rmtree(extract_dir, ignore_errors=True)
    print("Done.")


if __name__ == "__main__":
    main()
