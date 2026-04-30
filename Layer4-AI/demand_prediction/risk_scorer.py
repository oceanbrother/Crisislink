"""
Risk Scorer: End-to-end demand risk scoring pipeline.

Coordinates feature scaling, K-Means clustering, and Random Forest risk prediction.
Input: Raw SEIFA features from postcode_seifa table
Output: Demand risk scores (0-1) for postcode_risk_scores table
"""

import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .k_means_clustering import KMeansClustering
from .random_forest_forecaster import RandomForestForecaster


class RiskScorer:
    """
    End-to-end risk scoring system.
    
    Pipeline:
      1. Load pre-trained StandardScaler
      2. Scale raw SEIFA features
      3. K-Means clustering assignment
      4. Random Forest risk prediction
    """
    
    # Feature names expected by the model (must match training data)
    FEATURE_NAMES = [
        "unemployment_rate",
        "rent_to_income_ratio",
        "unemployment_rate_sqrt",
        "rent_to_income_ratio_log",
        "total_population_log",
        "single_parent_pct",
        "median_hhd_income_weekly",
        "median_rent_weekly",
    ]
    
    def __init__(
        self,
        scaler_path: Optional[str] = None,
        kmeans_path: Optional[str] = None,
        rf_path: Optional[str] = None,
    ):
        """
        Initialize the risk scorer with pre-trained models.
        
        Args:
            scaler_path: Path to scaler.pkl. If None, uses default.
            kmeans_path: Path to kmeans_model.pkl. If None, uses default.
            rf_path: Path to shap_surrogate.pkl. If None, uses default.
        """
        self.scaler = self._load_scaler(scaler_path)
        self.kmeans = KMeansClustering(kmeans_path)
        self.rf = RandomForestForecaster(rf_path)
    
    @staticmethod
    def _default_scaler_path() -> str:
        """Get default scaler path."""
        current_dir = Path(__file__).parent
        return str(current_dir / "models" / "scaler.pkl")
    
    def _load_scaler(self, scaler_path: Optional[str]) -> object:
        """Load the StandardScaler object."""
        if scaler_path is None:
            scaler_path = self._default_scaler_path()
        
        scaler_path = Path(scaler_path)
        if not scaler_path.exists():
            raise FileNotFoundError(
                f"StandardScaler not found at {scaler_path}. "
                f"Please place scaler.pkl in the models/ directory."
            )
        
        try:
            with open(scaler_path, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            raise RuntimeError(f"Failed to load StandardScaler: {e}")
    
    def score(self, seifa_records: pd.DataFrame) -> pd.DataFrame:
        """
        Score a batch of SEIFA records for demand risk.
        
        Args:
            seifa_records: DataFrame with columns matching FEATURE_NAMES.
                Expected to have 'postcode' column.
        
        Returns:
            DataFrame with columns: postcode, demand_risk_score, cluster_assignment
        """
        if seifa_records.empty:
            return pd.DataFrame(
                columns=["postcode", "demand_risk_score", "cluster_assignment"]
            )
        
        # Validate required features
        missing_features = set(self.FEATURE_NAMES) - set(seifa_records.columns)
        if missing_features:
            raise ValueError(
                f"Missing required features: {missing_features}. "
                f"Input DataFrame must have columns: {self.FEATURE_NAMES}"
            )
        
        # Extract features in correct order
        X = seifa_records[self.FEATURE_NAMES].values
        X = np.asarray(X, dtype=np.float64)
        
        # Handle NaN values - fill with median
        col_medians = np.nanmedian(X, axis=0)
        for i in range(X.shape[1]):
            mask = np.isnan(X[:, i])
            X[mask, i] = col_medians[i]
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        # Get cluster assignments
        clusters = self.kmeans.predict(X_scaled)
        
        # Get risk scores
        risk_scores = self.rf.predict(X_scaled)
        
        # Compile results
        results = pd.DataFrame({
            "postcode": seifa_records["postcode"].values,
            "demand_risk_score": risk_scores,
            "cluster_assignment": clusters,
        })
        
        return results
    
    def score_single(self, postcode: str, features_dict: dict) -> dict:
        """
        Score a single postcode.
        
        Args:
            postcode: Postcode string (e.g., "3000")
            features_dict: Dict with feature names as keys, feature values as values.
        
        Returns:
            Dict with keys: postcode, demand_risk_score, cluster_assignment
        """
        df = pd.DataFrame([{**features_dict, "postcode": postcode}])
        result = self.score(df)
        
        if result.empty:
            return None
        
        return result.iloc[0].to_dict()
