"""
Prediction Service: FastAPI backend for demand forecasting and risk scoring.

Endpoints:
  POST /predictions/demand-forecast
  GET /predictions/risk-scores
  POST /predictions/postcode-risk
  GET /intelligence/supply-gaps
"""

import asyncio
import os
from datetime import date, datetime, timedelta
from typing import Optional

import databases
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
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
	print(f"⚠ APScheduler not available: {e}")

# Import the risk scoring pipeline
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Layer4-AI")))
from demand_prediction.risk_scorer import RiskScorer

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "listing_service", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
	# Do not raise here; we'll allow startup to attempt and fail gracefully
	DATABASE_URL = None

app = FastAPI(title="Prediction Service")
database = databases.Database(DATABASE_URL) if DATABASE_URL else None
risk_scorer: Optional[RiskScorer] = None
scheduler: Optional[AsyncIOScheduler] = None


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
		risk_scorer = RiskScorer()
		print("✓ Risk scorer models loaded successfully")
	except Exception as e:
		print(f"⚠ Risk scorer models not available: {e}")
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
		print("⚠ Scheduler disabled; APScheduler not available")


@app.on_event("shutdown")
async def shutdown():
	"""Close database connection."""
	global scheduler
	if scheduler:
		scheduler.shutdown(wait=False)
	if database and database.is_connected:
		await database.disconnect()


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

	# Fetch feature rows in batches
	features_query = """
		SELECT postcode, unemployment_rate, rent_to_income_ratio,
			unemployment_rate_sqrt, rent_to_income_ratio_log,
			total_population_log, single_parent_pct,
			median_hhd_income_weekly, median_rent_weekly
		FROM postcode_seifa
		WHERE postcode = ANY(:postcodes);
	"""
	for chunk_start in range(0, len(postcodes), 200):
		chunk = postcodes[chunk_start:chunk_start+200]
		rows = await database.fetch(features_query, {"postcodes": chunk})
		df = pd.DataFrame(rows)
		if df.empty:
			continue
		scored = risk_scorer.score(df)
		week_start = date.today() - timedelta(days=date.today().weekday())
		upsert_query = """
			INSERT INTO postcode_risk_scores (postcode, week_start, demand_risk_score, created_at)
			VALUES (:postcode, :week_start, :score, :created_at)
			ON CONFLICT (postcode, week_start) DO UPDATE
			SET demand_risk_score = :score, created_at = :created_at;
		"""
		for _, row in scored.iterrows():
			await database.execute(
				upsert_query,
				{
					"postcode": row["postcode"],
					"week_start": week_start,
					"score": float(row["demand_risk_score"]),
					"created_at": datetime.utcnow(),
				},
			)
		print(f"Weekly job: processed chunk {chunk_start}..{chunk_start+len(chunk)}")

	# Optionally perform online learning with river models if implemented
	try:
		if hasattr(risk_scorer, "online_update"):
			await asyncio.to_thread(risk_scorer.online_update)
			print("Weekly job: performed online update")
	except Exception as e:
		print(f"Weekly job: online update failed: {e}")

	print("Weekly prediction job complete")


async def _daily_gap_detection_job():
	"""Daily job: detect postcodes with high vulnerability and zero supply."""
	global database
	if not database:
		print("Daily gap detection skipped: database not configured")
		return

	print("Starting daily gap detection job...")
	query = """
		SELECT ps.postcode, ps.total_population, COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END),0) as total_supply
		FROM postcode_seifa ps
		LEFT JOIN food_listing fl ON ps.postcode = fl.postcode AND fl.status = 'available'
		GROUP BY ps.postcode, ps.total_population
		HAVING COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END),0) = 0
		ORDER BY ps.postcode;
	"""
	rows = await database.fetch_all(query)
	# Cache results in memory (simple module-level variable)
	app.state.gap_postcodes = [ {"postcode": r["postcode"], "total_population": int(r["total_population"])} for r in rows ]
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
    
	# Fetch SEIFA data
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
    
	# Score the postcode
	row_dict = dict(row)
	result = risk_scorer.score_single(req.postcode, row_dict)
    
	if not result:
		raise HTTPException(status_code=500, detail="Scoring failed")
    
	# Upsert into postcode_risk_scores
	upsert_query = """
		INSERT INTO postcode_risk_scores (postcode, week_start, demand_risk_score, created_at)
		VALUES (:postcode, :week_start, :score, :created_at)
		ON CONFLICT (postcode, week_start) DO UPDATE
		SET demand_risk_score = :score, created_at = :created_at;
	"""
    
	await database.execute(
		upsert_query,
		{
			"postcode": req.postcode,
			"week_start": req.week_start,
			"score": float(result["demand_risk_score"]),
			"created_at": datetime.utcnow(),
		},
	)
    
	return DemandForecastResponse(
		postcode=req.postcode,
		week_start=req.week_start,
		demand_risk_score=float(result["demand_risk_score"]),
		cluster_assignment=int(result["cluster_assignment"]),
		confidence=0.92,  # Placeholder
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
    
	# Default to current week start
	if week_start is None:
		today = date.today()
		week_start = today - timedelta(days=today.weekday())
    
	query = """
		SELECT DISTINCT ON (postcode)
			postcode, week_start, demand_risk_score
		FROM postcode_risk_scores
		WHERE postcode = ANY(:postcodes)
		ORDER BY postcode, week_start DESC
		LIMIT 1;
	"""
    
	rows = await database.fetch(query, {"postcodes": postcodes})
    
	return [
		DemandForecastResponse(
			postcode=row["postcode"],
			week_start=row["week_start"],
			demand_risk_score=float(row["demand_risk_score"]),
			cluster_assignment=0,  # Fetch from table if needed
			confidence=0.92,
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


@app.get("/intelligence/supply-gaps")
async def get_supply_gaps(region_category: Optional[str] = None):
	"""
	Identify supply gaps: postcodes with high risk but low active listings.
    
	Returns ranked list of high-need areas.
	"""
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	query = """
		SELECT 
			ps.postcode,
			ps.irsd_score,
			MAX(prs.demand_risk_score) as latest_risk_score,
			COUNT(CASE WHEN fl.status = 'available' THEN 1 END) as active_listings,
			COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END), 0) as total_supply
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
    
	rows = await database.fetch(query, params)
    
	return [
		{
			"postcode": row["postcode"],
			"irsd_score": float(row["irsd_score"]),
			"demand_risk_score": float(row["latest_risk_score"]) if row["latest_risk_score"] else 0.0,
			"active_listings": row["active_listings"],
			"total_supply": float(row["total_supply"]),
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

	# If no radius filter, return cached list.
	if not (radius_km and lat is not None and lon is not None):
		return rows

	# Fetch locations for gap postcodes
	postcodes = [r['postcode'] for r in rows]
	placeholders = ','.join(['%s'] * len(postcodes))
	query = f"SELECT postcode, latitude, longitude FROM location WHERE postcode IN ({placeholders})"
	db_rows = await database.fetch_all(query, postcodes)

	# Haversine filtering in Python
	def haversine_km(lat1, lon1, lat2, lon2):
		from math import radians, sin, cos, asin, sqrt
		dlat = radians(lat2 - lat1)
		dlon = radians(lon2 - lon1)
		a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
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
	"""Return donor-facing hotspots ordered by unmet demand (simple heuristic)."""
	if not database:
		raise HTTPException(status_code=503, detail="Database not configured")

	query = """
		SELECT ps.postcode, ps.irsd_score, COALESCE(MAX(prs.demand_risk_score),0) as risk_score,
			COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END),0) as total_supply
		FROM postcode_seifa ps
		LEFT JOIN postcode_risk_scores prs ON ps.postcode = prs.postcode
		LEFT JOIN food_listing fl ON ps.postcode = fl.postcode
		GROUP BY ps.postcode, ps.irsd_score
		HAVING COALESCE(MAX(prs.demand_risk_score),0) > 0
		ORDER BY (COALESCE(MAX(prs.demand_risk_score),0) - LEAST(COALESCE(SUM(CASE WHEN fl.status = 'available' THEN fl.quantity ELSE 0 END),0), 100)/100.0) DESC
		LIMIT :limit;
	"""
	rows = await database.fetch(query, {"limit": limit})

	hotspots = []
	for row in rows:
		hotspots.append({
			'postcode': row['postcode'],
			'irsd_score': float(row['irsd_score']),
			'risk_score': float(row['risk_score']),
			'total_supply': float(row['total_supply']),
			'top_shortage_categories': [],
		})

	return hotspots


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
    
	# Fetch all SEIFA data
	query = """
		SELECT 
			postcode, unemployment_rate, rent_to_income_ratio,
			unemployment_rate_sqrt, rent_to_income_ratio_log,
			total_population_log, single_parent_pct,
			median_hhd_income_weekly, median_rent_weekly
		FROM postcode_seifa;
	"""
    
	rows = await database.fetch_all(query)
	# Convert asyncpg Record objects to plain dicts for pandas
	df = pd.DataFrame([dict(row) for row in rows])
    
	if df.empty:
		return {"processed": 0, "failed": 0}
    
	# Score all at once
	results = risk_scorer.score(df)
    
	# Upsert all results
	week_start = date.today() - timedelta(days=date.today().weekday())
    
	upsert_query = """
		INSERT INTO postcode_risk_scores (postcode, week_start, demand_risk_score, created_at)
		VALUES (:postcode, :week_start, :score, :created_at)
		ON CONFLICT (postcode, week_start) DO UPDATE
		SET demand_risk_score = :score, created_at = :created_at;
	"""
    
	for _, row in results.iterrows():
		await database.execute(
			upsert_query,
			{
				"postcode": row["postcode"],
				"week_start": week_start,
				"score": float(row["demand_risk_score"]),
				"created_at": datetime.utcnow(),
			},
		)
    
	return {
		"processed": len(results),
		"week_start": week_start.isoformat(),
		"message": "All postcodes scored successfully",
	}


if __name__ == "__main__":
	import uvicorn
	uvicorn.run(app, host="0.0.0.0", port=8001)
