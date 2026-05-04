# Demand Prediction Module

This module handles demand forecasting and risk scoring for food supply management.

## Models

Three pre-trained scikit-learn models are used:

### 1. **kmeans_model.pkl** (2.7 KB)
- **Type**: K-Means Clustering (4 clusters)
- **Purpose**: Group postcodes into risk clusters based on SEIFA features
- **Input**: Scaled socioeconomic features (unemployment, rent/income ratio, etc.)
- **Output**: Cluster assignment (0-3)
- **Location**: `models/kmeans_model.pkl`

### 2. **shap_surrogate.pkl** (940 KB)
- **Type**: Random Forest Regressor (surrogate model)
- **Purpose**: Predict demand risk score (0-1) for each postcode
- **Input**: SEIFA features + current supply data
- **Output**: Risk score (0.0 = low demand, 1.0 = high demand risk)
- **Location**: `models/shap_surrogate.pkl`

### 3. **scaler.pkl** (570 B)
- **Type**: StandardScaler (feature normalization)
- **Purpose**: Normalize input features to mean=0, std=1
- **Input**: Raw feature values
- **Output**: Scaled features [-3, 3] range
- **Location**: `models/scaler.pkl`

## Data Flow

```
postcode_seifa table (SEIFA features)
          ↓
    [StandardScaler]  (normalize)
          ↓
scaler.pkl scales features
          ↓
    [K-Means clustering]
          ↓
kmeans_model.pkl → cluster assignment (0-3)
          ↓
    [Random Forest regression]
          ↓
shap_surrogate.pkl → demand_risk_score (0-1)
          ↓
Save to postcode_risk_scores table
          ↓
API returns risk scores to frontend
```

## Setup

1. Place model files in `models/` directory:
   ```
   Layer4-AI/demand_prediction/
   ├── models/
   │   ├── kmeans_model.pkl
   │   ├── shap_surrogate.pkl
   │   └── scaler.pkl
   ├── k_means_clustering/
   ├── random_forest_forecaster/
   └── ...
   ```

2. Install dependencies:
   ```bash
   pip install scikit-learn pandas numpy
   ```

3. Run inference via `risk_scorer.py`

## Module Structure

- `models/` - Serialized scikit-learn objects
- `k_means_clustering/` - K-Means wrapper
- `random_forest_forecaster/` - Random Forest wrapper
- `risk_scorer.py` - End-to-end risk scoring pipeline
