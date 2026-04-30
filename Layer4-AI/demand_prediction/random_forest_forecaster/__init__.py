"""
Random Forest demand risk forecaster.
Predicts demand risk score (0-1) for postcodes based on SEIFA features and current supply.

Risk Score Interpretation:
  0.0 - 0.2: Low demand risk (good supply coverage)
  0.2 - 0.5: Medium demand risk (adequate supply)
  0.5 - 0.8: High demand risk (supply shortage)
  0.8 - 1.0: Critical demand risk (severe shortage expected)
"""

import pickle
from pathlib import Path
from typing import Optional

import numpy as np


class RandomForestForecaster:
	"""Wrapper for pre-trained Random Forest risk prediction model."""
    
	def __init__(self, model_path: Optional[str] = None):
		"""
		Initialize Random Forest forecaster model.
        
		Args:
			model_path: Path to shap_surrogate.pkl. If None, uses default location.
		"""
		if model_path is None:
			model_path = self._default_model_path()
        
		self.model_path = Path(model_path)
		self.model = None
		self._load_model()
    
	@staticmethod
	def _default_model_path() -> str:
		"""Get default model path relative to this file."""
		current_dir = Path(__file__).parent
		return str(current_dir / ".." / "models" / "shap_surrogate.pkl")
    
	def _load_model(self) -> None:
		"""Load the serialized Random Forest model."""
		if not self.model_path.exists():
			raise FileNotFoundError(
				f"Random Forest model not found at {self.model_path}. "
				f"Please place shap_surrogate.pkl in the models/ directory."
			)
        
		try:
			with open(self.model_path, "rb") as f:
				self.model = pickle.load(f)
		except Exception as e:
			raise RuntimeError(f"Failed to load Random Forest model: {e}")
    
	def predict(self, scaled_features: np.ndarray) -> np.ndarray:
		"""
		Predict demand risk scores for scaled features.
        
		Args:
			scaled_features: Shape (n_samples, n_features). Must be pre-scaled with StandardScaler.
        
		Returns:
			Risk scores: Shape (n_samples,). Values in [0.0, 1.0].
				0.0 = low risk, 1.0 = high risk
		"""
		if self.model is None:
			raise RuntimeError("Model not loaded.")
        
		predictions = self.model.predict(scaled_features)
		# Clip to [0, 1] range in case of extrapolation
		return np.clip(predictions, 0.0, 1.0)
    
	def predict_proba(self, scaled_features: np.ndarray) -> np.ndarray:
		"""
		Predict risk probabilities (if available from model).
		Falls back to predict() for regression models.
        
		Args:
			scaled_features: Shape (n_samples, n_features). Must be pre-scaled.
        
		Returns:
			Risk scores: Shape (n_samples,).
		"""
		if self.model is None:
			raise RuntimeError("Model not loaded.")
        
		# RandomForestRegressor doesn't have predict_proba, use predict
		return self.predict(scaled_features)
    
	def get_feature_importance(self) -> np.ndarray:
		"""Return feature importance scores from the model."""
		if self.model is None:
			raise RuntimeError("Model not loaded.")
        
		if hasattr(self.model, "feature_importances_"):
			return self.model.feature_importances_
		return None
