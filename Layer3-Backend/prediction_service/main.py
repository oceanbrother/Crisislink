"""
Prediction Service: FastAPI backend for demand forecasting and risk scoring.

Endpoints:
  POST /predictions/demand-forecast
  GET /predictions/risk-scores
  POST /predictions/postcode-risk
  GET /intelligence/supply-gaps
"""

import asyncio
import json
import os
from datetime import date, datetime, timedelta
from typing import Optional

import databases
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
	from apscheduler.schedulers.asyncio import AsyncIOScheduler
	from apscheduler.triggers.cron import CronTrigger
	APSCHEDULER_AVAILABLE = True
except Exception as e:
	# Allow API to start even if APScheduler deps are missing on this machine
	AsyncIOScheduler = None
	CronTrigger = None
	APSCHEDULER_AVAILABLE = False
	print(f"[WARN] APScheduler not available: {e}")

from demand_prediction.risk_scorer import RiskScorer

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "listing_service", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
	# Do not raise here; we'll allow startup to attempt and fail gracefully
	DATABASE_URL = None

app = FastAPI(title="Prediction Service")

_cors_origins = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if not _cors_origins:
    _cors_origins = ["http://localhost:3004", "http://127.0.0.1:3004", "https://donor-app-dusky.vercel.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

database = databases.Database(DATABASE_URL) if DATABASE_URL else None
risk_scorer: Optional[RiskScorer] = None
scheduler: Optional[AsyncIOScheduler] = None


def _risk_label(score: float) -> str:
	"""Map numeric score to stable UI-facing risk bands."""
	if score >= 0.75:
		return "high"
	if score >= 0.5:
		return "medium-high"
	if score >= 0.25:
		return "medium-low"
	return "low"


def _ensure_model_file(dest_path, url: str, label: str) -> None:
	"""Download a model artifact from URL if not already present."""
	if dest_path.exists():
		return
	if not url:
		return
	import urllib.request
	dest_path.parent.mkdir(parents=True, exist_ok=True)
	print(f"Downloading {label} from {url} ...")
	try:
		urllib.request.urlretrieve(url, dest_path)
		print(f"[OK] {label} downloaded ({dest_path.stat().st_size // 1024} KB)")
	except Exception as e:
		print(f"[WARN] Failed to download {label}: {e}")


def _ensure_models(models_dir) -> None:
	"""Download any missing model artifacts using env-var URLs."""
	_ensure_model_file(models_dir / "demand_forecaster.pkl",  os.getenv("MODEL_FORECASTER_URL", ""), "demand_forecaster.pkl")
	_ensure_model_file(models_dir / "kmeans_model.pkl",       os.getenv("MODEL_KMEANS_URL", ""),     "kmeans_model.pkl")
	_ensure_model_file(models_dir / "scaler.pkl",             os.getenv("MODEL_SCALER_URL", ""),      "scaler.pkl")
	_ensure_model_file(models_dir / "shap_surrogate.pkl",     os.getenv("MODEL_SHAP_URL", ""),        "shap_surrogate.pkl")


# ─── Startup / Shutdown ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
	"""Initialize database connection and load ML models."""
	global risk_scorer
	# Database connect
	if database:
		await database.connect()

	# Load ML models (singleton). If any model fails to load, mark risk_scorer None.
	try:
		from pathlib import Path as _Path
		_models_dir = _Path(__file__).parent / "models"
		# Auto-fetch model artifacts when URLs are provided in env vars.
		_ensure_models(_models_dir)
		risk_scorer = RiskScorer(models_dir=_models_dir)
		print("[OK] Risk scorer models loaded successfully")
	except Exception as e:
		print(f"[WARN] Risk scorer models not available: {e}")
		risk_scorer = None

	# Setup scheduler for periodic tasks (optional)
	global scheduler
	if APSCHEDULER_AVAILABLE:
		scheduler = AsyncIOScheduler()
		# Weekly prediction: Monday 06:00
		scheduler.add_job(_weekly_prediction_job, CronTrigger(day_of_week="mon", hour=6, minute=0))
		# Daily gap detection: every day 07:00
		scheduler.add_job(_daily_gap_detection_job, CronTrigger(hour=7, minute=0))
		scheduler.start()
	else:
		scheduler = None
		print("[WARN] Scheduler disabled; APScheduler not available")


@app.on_event("shutdown")
async def shutdown():
	"""Close database connection."""
	global scheduler
	if scheduler:
		scheduler.shutdown(wait=False)
	if database and database.is_connected:
		await database.disconnect()


_UPSERT_RISK_SCORES = """
	INSERT INTO postcode_risk_scores (
		postcode, week_start, demand_risk_score, risk_label,
		confidence, predicted_window_start, predicted_window_end,
		top_features, generated_at
	)
	VALUES (
		:postcode, :week_start, :score, :risk_label,
		:confidence, :window_start, :window_end,
		:top_features, :generated_at
	)
	ON CONFLICT (postcode, week_start) DO UPDATE
	SET demand_risk_score      = EXCLUDED.demand_risk_score,
		risk_label             = EXCLUDED.risk_label,
		confidence             = EXCLUDED.confidence,
		predicted_window_start = EXCLUDED.predicted_window_start,
		predicted_window_end   = EXCLUDED.predicted_window_end,
		top_features           = EXCLUDED.top_features,
		generated_at           = EXCLUDED.generated_at;
"""


def _upsert_params(postcode: str, week_start: date, score: float, top_features=None, confidence: float = 0.92) -> dict:
	return {
		"postcode": postcode,
		"week_start": week_start,
		"score": score,
		"risk_label": _risk_label(score),
		"confidence": confidence,
		"window_start": week_start,
		"window_end": week_start + timedelta(days=6),
		"top_features": json.dumps(top_features) if top_features is not None else None,
		"generated_at": datetime.utcnow(),
	}


async def _weekly_prediction_job():
	"""Weekly job: score all postcodes and perform online learning if supported."""
	global risk_scorer, database
	if not risk_scorer:
		print("Weekly job skipped: models not loaded")
		return
	if not database:
		print("Weekly job skipped: database not configured")
		return

	print("Starting weekly prediction job...")
	query = "SELECT postcode FROM postcode_seifa;"
	rows = await database.fetch_all(query)
	postcodes = [r["postcode"] for r in rows]

	features_query = """
		SELECT postcode, irsd_decile, unemployment_rate, rent_to_income_ratio,
			unemployment_rate_sqrt, rent_to_income_ratio_log,
			total_population_log, single_parent_pct,
			median_hhd_income_weekly, median_rent_weekly
		FROM postcode_seifa
		WHERE postcode = ANY(:postcodes);
	"""
	week_start = date.today() - timedelta(days=date.today().weekday())

	for chunk_start in range(0, len(postcodes), 200):
		# Process in chunks to cap memory and keep DB round-trips predictable.
		chunk = postcodes[chunk_start:chunk_start + 200]
		rows = await database.fetch_all(features_query, {"postcodes": chunk})
		df = pd.DataFrame(rows)
		if df.empty:
			continue
		ml_cols = [c for c in df.columns if c != "irsd_decile"]
		scored = risk_scorer.score(df[ml_cols])
		ml_scores = scored["demand_risk_score"].values
		ml_degenerate = len(set(round(float(s), 3) for s in ml_scores)) <= 1
		for idx, row in scored.iterrows():
			if ml_degenerate:
				# Fallback heuristic if model output collapses to near-constant values.
				irsd_decile = int(df.iloc[idx]["irsd_decile"])
				unemp = float(df.iloc[idx]["unemployment_rate"] or 0)
				score = min(0.99, max(0.01,
					(11.0 - irsd_decile) / 10.0 * 0.75 + 0.05 + unemp * 0.8
				))
				confidence = 0.70
			else:
				score = float(row["demand_risk_score"])
				confidence = float(row.get("confidence", 0.92))
			await database.execute(
				_UPSERT_RISK_SCORES,
				_upsert_params(
					postcode=row["postcode"],
					week_start=week_start,
					score=score,
					top_features=row.get("top_features"),
					confidence=confidence,
				),
			)
		print(f"Weekly job: processed chunk {chunk_start}..{chunk_start + len(chunk)}")

	# Optionally perform online learning with river models if implemented
	try:
		if hasattr(risk_scorer, "online_update"):
			await asyncio.to_thread(risk_scorer.online_update)
			print("Weekly job: performed online update")
	except Exception as e:
		print(f"Weekly job: online update failed: {e}")

	print("Weekly prediction job complete")


async def _daily_gap_detection_job():
	"""Daily job: detect postcodes in the two most disadvantaged deciles with zero supply."""
	global database
	if not database:
		print("Daily gap detection skipped: database not configured")
		return

	print("Starting daily gap detection job...")
	query = """
		SELECT ps.postcode, ps.total_population,
			COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END), 0) AS total_supply
		FROM postcode_seifa ps
		LEFT JOIN food_listing fl ON ps.postcode = fl.postcode AND fl.status = 'available'
		WHERE ps.irsd_decile <= 2
		GROUP BY ps.postcode, ps.total_population
		HAVING COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END), 0) = 0
		ORDER BY ps.postcode;
	"""
	rows = await database.fetch_all(query)
	# Cache lightweight result in app state for fast API reads.
	app.state.gap_postcodes = [{"postcode": r["postcode"], "total_population": int(r["total_population"])} for r in rows]
	print(f"Daily gap detection complete: found {len(rows)} postcodes")


# ─── Health Check ───────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
	"""Check service health and model status."""
	return {
		"status": "healthy",
		"service": "prediction_service",
		"models_loaded": risk_scorer is not None,
		"database_connected": database.is_connected if database else False,
	}


# ─── Models ──────────────────────────────────────────────────────────────
class DemandForecastRequest(BaseModel):
	"""Request to forecast demand for a specific week."""
	postcode: str
	week_start: date
	force_recompute: bool = False


class DemandForecastResponse(BaseModel):
	"""Demand forecast response."""
	postcode: str
	week_start: date
	demand_risk_score: float
	cluster_assignment: int
	confidence: float


class RiskScoresRequest(BaseModel):
	"""Request to fetch risk scores for multiple postcodes."""
	postcodes: list[str] = []
	week_start: Optional[date] = None


class SupplyGapRequest(BaseModel):
	"""Request to identify supply gaps."""
	region_category: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────
@app.post("/predictions/demand-forecast", response_model=DemandForecastResponse)
async def post_demand_forecast(req: DemandForecastRequest):
	"""
	Generate demand forecast for a postcode in a given week.

	Returns risk score (0-1) indicating expected demand pressure.
	"""
	if not risk_scorer:
		raise HTTPException(status_code=503, detail="Models not loaded")
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	query = """
		SELECT
			postcode, unemployment_rate, rent_to_income_ratio,
			unemployment_rate_sqrt, rent_to_income_ratio_log,
			total_population_log, single_parent_pct,
			median_hhd_income_weekly, median_rent_weekly
		FROM postcode_seifa
		WHERE postcode = :postcode;
	"""

	row = await database.fetch_one(query, {"postcode": req.postcode})
	if not row:
		raise HTTPException(status_code=404, detail=f"Postcode {req.postcode} not found")

	row_dict = dict(row)
	result = risk_scorer.score_single(req.postcode, row_dict)

	if not result:
		raise HTTPException(status_code=500, detail="Scoring failed")

	score = float(result["demand_risk_score"])
	confidence = float(result.get("confidence", 0.92))

	await database.execute(
		_UPSERT_RISK_SCORES,
		_upsert_params(
			postcode=req.postcode,
			week_start=req.week_start,
			score=score,
			top_features=result.get("top_features"),
			confidence=confidence,
		),
	)

	return DemandForecastResponse(
		postcode=req.postcode,
		week_start=req.week_start,
		demand_risk_score=score,
		cluster_assignment=int(result["cluster_assignment"]),
		confidence=confidence,
	)


@app.get("/predictions/risk-scores", response_model=list[DemandForecastResponse])
async def get_risk_scores(
	postcodes: list[str] = Query([]),
	week_start: Optional[date] = None,
):
	"""
	Fetch demand risk scores for postcodes.

	If week_start is not provided, returns latest scores.
	"""
	if not postcodes:
		raise HTTPException(status_code=400, detail="At least one postcode required")
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	if week_start is None:
		today = date.today()
		week_start = today - timedelta(days=today.weekday())

	query = """
		SELECT DISTINCT ON (postcode)
			postcode, week_start, demand_risk_score, confidence
		FROM postcode_risk_scores
		WHERE postcode = ANY(:postcodes)
		ORDER BY postcode, week_start DESC
		LIMIT 1;
	"""

	rows = await database.fetch_all(query, {"postcodes": postcodes})

	return [
		DemandForecastResponse(
			postcode=row["postcode"],
			week_start=row["week_start"],
			demand_risk_score=float(row["demand_risk_score"]),
			cluster_assignment=0,
			confidence=float(row["confidence"]),
		)
		for row in rows
	]


@app.post("/predictions/postcode-risk")
async def post_postcode_risk(postcode: str):
	"""
	Compute risk score for a single postcode immediately.
	"""
	if not risk_scorer:
		raise HTTPException(status_code=503, detail="Models not loaded")
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	query = """
		SELECT
			postcode, unemployment_rate, rent_to_income_ratio,
			unemployment_rate_sqrt, rent_to_income_ratio_log,
			total_population_log, single_parent_pct,
			median_hhd_income_weekly, median_rent_weekly
		FROM postcode_seifa
		WHERE postcode = :postcode;
	"""

	row = await database.fetch_one(query, {"postcode": postcode})
	if not row:
		raise HTTPException(status_code=404, detail=f"Postcode {postcode} not found")

	row_dict = dict(row)
	result = risk_scorer.score_single(postcode, row_dict)

	return {
		"postcode": postcode,
		"demand_risk_score": float(result["demand_risk_score"]),
		"cluster_assignment": int(result["cluster_assignment"]),
	}


COLD_START_THRESHOLD = 10  # minimum historical claim records per postcode before using ML scores


async def _get_postcode_record_counts() -> dict:
	"""Return {postcode: claim_count} for cold-start check."""
	if not database:
		return {}
	rows = await database.fetch_all(
		"""
		SELECT postcode, COUNT(*) AS cnt
		FROM food_listing
		WHERE status IN ('claimed', 'picked_up')
		GROUP BY postcode
		"""
	)
	return {r["postcode"]: int(r["cnt"]) for r in rows}


@app.get("/intelligence/supply-gaps")
async def get_supply_gaps(region_category: Optional[str] = None):
	"""
	Identify supply gaps: postcodes with high risk but low active listings.

	Returns ranked list of high-need areas. Each item carries:
	  - data_source: "ai_forecast" | "rule_based"
	  - cold_start: true if postcode has fewer than COLD_START_THRESHOLD historical records
	"""
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	record_counts = await _get_postcode_record_counts()

	# Query postcodes that have ML scores stored
	query = """
		SELECT
			ps.postcode,
			ps.irsd_score,
			MAX(prs.demand_risk_score) AS latest_risk_score,
			COUNT(CASE WHEN fl.status = 'available' THEN 1 END) AS active_listings,
			COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END), 0) AS total_supply
		FROM postcode_seifa ps
		LEFT JOIN postcode_risk_scores prs ON ps.postcode = prs.postcode
		LEFT JOIN food_listing fl ON ps.postcode = fl.postcode AND fl.status = 'available'
		WHERE 1=1
	"""

	params = {}

	if region_category:
		query += " AND ps.regional_category = :region"
		params["region"] = region_category

	query += """
		GROUP BY ps.postcode, ps.irsd_score
		HAVING MAX(prs.demand_risk_score) > 0.5
		ORDER BY latest_risk_score DESC, active_listings ASC
		LIMIT 50;
	"""

	rows = await database.fetch_all(query, params)

	result = []
	for row in rows:
		postcode = row["postcode"]
		count = record_counts.get(postcode, 0)
		cold_start = count < COLD_START_THRESHOLD
		# Data source: if models loaded and postcode has enough history → AI, else rule-based
		data_source = "ai_forecast" if (risk_scorer is not None and not cold_start) else "rule_based"
		result.append({
			"postcode": postcode,
			"irsd_score": float(row["irsd_score"]),
			"demand_risk_score": float(row["latest_risk_score"]) if row["latest_risk_score"] else 0.0,
			"active_listings": row["active_listings"],
			"total_supply": float(row["total_supply"]),
			"data_source": data_source,
			"cold_start": cold_start,
		})
	return result


@app.get('/predictions/all-risk-scores')
async def api_all_risk_scores():
	"""Return the latest risk score for every scored postcode — used by the coverage map."""
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	query = """
		SELECT DISTINCT ON (prs.postcode)
			prs.postcode,
			prs.demand_risk_score,
			prs.risk_label,
			ps.irsd_score,
			ps.regional_category,
			COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END), 0) AS total_supply,
			COUNT(CASE WHEN fl.status = 'available' THEN 1 END) AS active_listings
		FROM postcode_risk_scores prs
		JOIN postcode_seifa ps ON ps.postcode = prs.postcode
		LEFT JOIN food_listing fl ON fl.postcode = prs.postcode
		GROUP BY prs.postcode, prs.demand_risk_score, prs.risk_label, ps.irsd_score, ps.regional_category, prs.week_start
		ORDER BY prs.postcode, prs.week_start DESC;
	"""
	rows = await database.fetch_all(query)
	return [
		{
			"postcode": row["postcode"],
			"demand_risk_score": float(row["demand_risk_score"]),
			"risk_label": row["risk_label"],
			"irsd_score": float(row["irsd_score"]),
			"regional_category": row["regional_category"],
			"total_supply": float(row["total_supply"]),
			"active_listings": int(row["active_listings"]),
		}
		for row in rows
	]


@app.get('/predictions/gap-postcodes')
async def api_gap_postcodes(radius_km: Optional[float] = None, lat: Optional[float] = None, lon: Optional[float] = None):
	"""Return weak/zero-supply postcodes with basic info; optional radius filter by lat/lon."""
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	rows = getattr(app.state, 'gap_postcodes', [])
	results = []
	if not rows:
		return results

	if not (radius_km and lat is not None and lon is not None):
		return rows

	postcodes = [r['postcode'] for r in rows]
	placeholders = ','.join(['%s'] * len(postcodes))
	query = f"SELECT postcode, latitude, longitude FROM location WHERE postcode IN ({placeholders})"
	db_rows = await database.fetch_all(query, postcodes)

	def haversine_km(lat1, lon1, lat2, lon2):
		from math import radians, sin, cos, asin, sqrt
		dlat = radians(lat2 - lat1)
		dlon = radians(lon2 - lon1)
		a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
		return 2 * 6371 * asin(sqrt(a))

	loc_map = {r['postcode']: (r['latitude'], r['longitude']) for r in db_rows}
	for row in rows:
		pc = row['postcode']
		loc = loc_map.get(pc)
		if not loc or loc[0] is None or loc[1] is None:
			continue
		dist = haversine_km(lat, lon, float(loc[0]), float(loc[1]))
		if dist <= radius_km:
			results.append({**row, 'distance_km': dist})

	return results


@app.get('/predictions/hotspots')
async def api_hotspots(limit: int = 50):
	"""
	Return donor-facing hotspots ordered by unmet demand.

	Each item carries:
	  - data_source: "ai_forecast" | "rule_based"
	  - cold_start: true if postcode has fewer than COLD_START_THRESHOLD historical records
	"""
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	record_counts = await _get_postcode_record_counts()

	query = """
		SELECT ps.postcode, ps.irsd_score, ps.regional_category,
			COALESCE(MAX(prs.demand_risk_score), 0) AS risk_score,
			COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END), 0) AS total_supply
		FROM postcode_seifa ps
		LEFT JOIN postcode_risk_scores prs ON ps.postcode = prs.postcode
		LEFT JOIN food_listing fl ON ps.postcode = fl.postcode
		GROUP BY ps.postcode, ps.irsd_score, ps.regional_category
		HAVING COALESCE(MAX(prs.demand_risk_score), 0) > 0
		ORDER BY (COALESCE(MAX(prs.demand_risk_score), 0) - LEAST(COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END), 0), 100) / 100.0) DESC
		LIMIT :limit;
	"""
	rows = await database.fetch_all(query, {"limit": limit})

	result = []
	for row in rows:
		postcode = row['postcode']
		count = record_counts.get(postcode, 0)
		cold_start = count < COLD_START_THRESHOLD
		data_source = "ai_forecast" if (risk_scorer is not None and not cold_start) else "rule_based"
		result.append({
			'postcode': postcode,
			'irsd_score': float(row['irsd_score']),
			'regional_category': row['regional_category'],
			'risk_score': float(row['risk_score']),
			'total_supply': float(row['total_supply']),
			'top_shortage_categories': [],
			'data_source': data_source,
			'cold_start': cold_start,
		})
	return result


# ─── Batch Processing ────────────────────────────────────────────────────
@app.post("/batch/score-all-postcodes")
async def batch_score_all_postcodes():
	"""
	Score all postcodes in postcode_seifa for the current week.

	Long-running operation: use for weekly batch job.
	"""
	if not risk_scorer:
		raise HTTPException(status_code=503, detail="Models not loaded")
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	query = """
		SELECT
			postcode, irsd_decile, unemployment_rate, rent_to_income_ratio,
			unemployment_rate_sqrt, rent_to_income_ratio_log,
			total_population_log, single_parent_pct,
			median_hhd_income_weekly, median_rent_weekly
		FROM postcode_seifa;
	"""

	rows = await database.fetch_all(query)
	df = pd.DataFrame([dict(row) for row in rows])

	if df.empty:
		return {"processed": 0, "failed": 0}

	results = risk_scorer.score(df[df.columns.difference(["irsd_decile"])])
	week_start = date.today() - timedelta(days=date.today().weekday())

	# Detect degenerate ML output (all scores identical) → fall back to SEIFA rule
	scores = results["demand_risk_score"].values
	ml_degenerate = len(set(round(float(s), 3) for s in scores)) <= 1

	for idx, row in results.iterrows():
		if ml_degenerate:
			irsd_decile = int(df.iloc[idx]["irsd_decile"])
			unemp = float(df.iloc[idx]["unemployment_rate"] or 0)
			score = min(0.99, max(0.01,
				(11.0 - irsd_decile) / 10.0 * 0.75 + 0.05 + unemp * 0.8
			))
			confidence = 0.70
		else:
			score = float(row["demand_risk_score"])
			confidence = float(row.get("confidence", 0.92))
		await database.execute(
			_UPSERT_RISK_SCORES,
			_upsert_params(
				postcode=row["postcode"],
				week_start=week_start,
				score=score,
				top_features=row.get("top_features"),
				confidence=confidence,
			),
		)

	return {
		"processed": len(results),
		"week_start": week_start.isoformat(),
		"message": "All postcodes scored successfully",
	}


if __name__ == "__main__":
	import uvicorn
	uvicorn.run(app, host="0.0.0.0", port=8001)
