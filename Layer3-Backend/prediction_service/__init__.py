"""
Prediction Service - Demand Forecasting & Risk Scoring.

This FastAPI service handles:
	1. Loading pre-trained ML models (K-Means, Random Forest, StandardScaler)
	2. Computing demand risk scores for each postcode
	3. Storing weekly risk assessments
	4. Identifying supply gaps for intervention

Models:
	- kmeans_model.pkl: K-Means clustering (4 clusters)
	- shap_surrogate.pkl: Random Forest regressor (risk scoring)
	- scaler.pkl: StandardScaler (feature normalization)

Key Endpoints:
	- POST /predictions/demand-forecast: Score single postcode
	- GET /predictions/risk-scores: Fetch multiple scores
	- GET /intelligence/supply-gaps: Identify high-need areas
	- POST /batch/score-all-postcodes: Weekly batch processing

Startup:
	1. Ensure models are in Layer4-AI/demand_prediction/models/
	2. DATABASE_URL is set in Layer3-Backend/.env
	3. Run: python -m uvicorn prediction_service.main:app --port 8001
"""
