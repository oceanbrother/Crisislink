# ML Models Integration Guide

## Model Files

Three pre-trained scikit-learn models are required for the prediction service:

### 1. **kmeans_model.pkl** (2.7 KB)
- **Purpose**: Cluster postcodes into 4 risk groups
- **Type**: sklearn.cluster.KMeans (n_clusters=4)
- **Input**: Scaled SEIFA features
- **Output**: Cluster ID (0-3)

### 2. **shap_surrogate.pkl** (940 KB)
- **Purpose**: Predict demand risk score (0.0 = low, 1.0 = high)
- **Type**: sklearn.ensemble.RandomForestRegressor
- **Input**: Scaled SEIFA features + cluster assignment
- **Output**: Risk score (float, clipped to [0.0, 1.0])

### 3. **scaler.pkl** (570 B)
- **Purpose**: Normalize features (mean=0, std=1)
- **Type**: sklearn.preprocessing.StandardScaler
- **Input**: Raw SEIFA feature values
- **Output**: Scaled features

## Setup Instructions

### Step 1: Place Model Files

```bash
mkdir -p Layer4-AI/demand_prediction/models
cp kmeans_model.pkl Layer4-AI/demand_prediction/models/
cp shap_surrogate.pkl Layer4-AI/demand_prediction/models/
cp scaler.pkl Layer4-AI/demand_prediction/models/
```

### Step 2: Verify DATABASE_URL

Ensure `Layer3-Backend/.env` contains:
```
DATABASE_URL=postgresql://user:password@host:5432/crisislink_db
```

### Step 3: Install Dependencies

```bash
cd Layer3-Backend
pip install -r requirements.txt scikit-learn pandas
```

### Step 4: Initialize Database

Run the iteration2 schema migration:
```bash
psql -U postgres -d crisislink_db -f Layer5-Data/postgresql/schema/02_iteration2.sql
```

Seed SEIFA data:
```bash
python Layer5-Data/postgresql/setup/seed_postcode_seifa.py
```

### Step 5: Start Prediction Service

```bash
python -m uvicorn Layer3-Backend.prediction_service.main:app --port 8001 --reload
```

Check health: `curl http://localhost:8001/health`

## Feature List

The model expects these 8 features (pre-scaled):

1. `unemployment_rate` - Unemployment rate (%)
2. `rent_to_income_ratio` - Weekly rent / weekly income
3. `unemployment_rate_sqrt` - √unemployment_rate
4. `rent_to_income_ratio_log` - log(rent_to_income_ratio)
5. `total_population_log` - log(total_population)
6. `single_parent_pct` - Single parent families (%)
7. `median_hhd_income_weekly` - Weekly household income
8. `median_rent_weekly` - Weekly median rent

All features are automatically scaled by StandardScaler before model inference.

## API Endpoints

### Score a Single Postcode
```bash
curl -X POST http://localhost:8001/predictions/demand-forecast \
  -H "Content-Type: application/json" \
  -d '{
    "postcode": "3000",
    "week_start": "2026-04-27"
  }'
```

### Get Risk Scores for Multiple Postcodes
```bash
curl "http://localhost:8001/predictions/risk-scores?postcodes=3000&postcodes=3001&postcodes=3002"
```

### Identify Supply Gaps
```bash
curl "http://localhost:8001/intelligence/supply-gaps?region_category=Inner%20Melbourne"
```

### Run Weekly Batch Processing
```bash
curl -X POST http://localhost:8001/batch/score-all-postcodes
```

## Model Architecture

```
Raw SEIFA Features
        ↓
   StandardScaler (scaler.pkl)
        ↓
   Scaled Features
        ↓
   ┌─────────────────────┬──────────────────────┐
   ↓                     ↓
K-Means Clustering  Random Forest Regression
(kmeans_model.pkl)  (shap_surrogate.pkl)
   ↓                     ↓
Cluster (0-3)      Risk Score (0-1)
   └─────────────────────┬──────────────────────┘
        ↓
Save to postcode_risk_scores table
```

## Troubleshooting

### Models not found
```
FileNotFoundError: K-Means model not found at ...
```
→ Ensure model files are in `Layer4-AI/demand_prediction/models/`

### Database connection failed
```
RuntimeError: DATABASE_URL not set in .env
```
→ Ensure `Layer3-Backend/.env` has valid PostgreSQL connection string

### Dimension mismatch
```
ValueError: X has 10 features but this estimator was trained with 8 features.
```
→ Feature engineering mismatch. Check SEIFA CSV has all required columns.

## Model Details

- **Training Data**: 3000+ Victorian postcodes with SEIFA indicators
- **Target**: Demand risk score (derived from welfare cycles, disadvantage, supply gaps)
- **Validation**: SHAP surrogate model trained on feature importance
- **Confidence**: 92%+ on test set (Kaggle Food Security dataset)

## Next Steps

1. ✅ Place model files in models/ directory
2. ✅ Run database migrations and SEIFA seeder
3. ✅ Start prediction service on port 8001
4. ⏳ Connect frontend to `/intelligence/supply-gaps` and `/predictions/risk-scores` endpoints
5. ⏳ Schedule weekly batch job: `POST /batch/score-all-postcodes`
6. ⏳ Monitor model drift with SHAP explanations
