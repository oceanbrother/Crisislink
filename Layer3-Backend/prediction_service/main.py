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

# Import the risk scoring pipeline
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Layer4-AI")))
from demand_prediction.risk_scorer import RiskScorer

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "listing_service", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
	raise RuntimeError("DATABASE_URL not set in .env")

app = FastAPI(title="Prediction Service")
database = databases.Database(DATABASE_URL)
risk_scorer = None


# ─── Startup / Shutdown ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
	"""Initialize database connection and load ML models."""
	global risk_scorer
	await database.connect()
    
	try:
		risk_scorer = RiskScorer()
		print("✓ Risk scorer models loaded successfully")
	except Exception as e:
		print(f"⚠ Risk scorer models not available: {e}")
		risk_scorer = None


@app.on_event("shutdown")
async def shutdown():
	"""Close database connection."""
	await database.disconnect()


# ─── Health Check ───────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
	"""Check service health and model status."""
	return {
		"status": "healthy",
		"service": "prediction_service",
		"models_loaded": risk_scorer is not None,
		"database_connected": database.is_connected(),
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


# ─── Batch Processing ────────────────────────────────────────────────────
@app.post("/batch/score-all-postcodes")
async def batch_score_all_postcodes():
	"""
	Score all postcodes in postcode_seifa for the current week.
    
	Long-running operation: use for weekly batch job.
	"""
	if not risk_scorer:
		raise HTTPException(status_code=503, detail="Models not loaded")
    
	# Fetch all SEIFA data
	query = """
		SELECT 
			postcode, unemployment_rate, rent_to_income_ratio,
			unemployment_rate_sqrt, rent_to_income_ratio_log,
			total_population_log, single_parent_pct,
			median_hhd_income_weekly, median_rent_weekly
		FROM postcode_seifa;
	"""
    
	rows = await database.fetch(query)
	df = pd.DataFrame(rows)
    
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
