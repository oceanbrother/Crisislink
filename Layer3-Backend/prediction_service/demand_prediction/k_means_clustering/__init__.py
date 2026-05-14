"""
K-Means clustering module for postcode risk grouping.
Groups postcodes into 4 clusters based on SEIFA socioeconomic features.

Clusters:
  0: High-risk postcodes (low SEIFA, high disadvantage)
  1: Medium-high risk
  2: Medium-low risk
  3: Low-risk postcodes (high SEIFA, low disadvantage)
"""

import os
import pickle
from pathlib import Path
from typing import Optional

import numpy as np


class KMeansClustering:
	"""Wrapper for pre-trained K-Means model."""
    
	def __init__(self, model_path: Optional[str] = None):
		"""
		Initialize K-Means clustering model.
        
		Args:
			model_path: Path to kmeans_model.pkl. If None, uses default location.
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
		return str(current_dir / ".." / "models" / "kmeans_model.pkl")
    
	def _load_model(self) -> None:
		"""Load the serialized K-Means model."""
		if not self.model_path.exists():
			raise FileNotFoundError(
				f"K-Means model not found at {self.model_path}. "
				f"Please place kmeans_model.pkl in the models/ directory."
			)
        
		try:
			with open(self.model_path, "rb") as f:
				self.model = pickle.load(f)
		except Exception as e:
			raise RuntimeError(f"Failed to load K-Means model: {e}")
    
	def predict(self, scaled_features: np.ndarray) -> np.ndarray:
		"""
		Predict cluster assignments for scaled features.
        
		Args:
			scaled_features: Shape (n_samples, n_features). Must be pre-scaled.
        
		Returns:
			Cluster assignments: Shape (n_samples,). Values in {0, 1, 2, 3}.
		"""
		if self.model is None:
			raise RuntimeError("Model not loaded. Call _load_model() first.")
        
		return self.model.predict(scaled_features)
    
	def get_cluster_centers(self) -> np.ndarray:
		"""Return the cluster centers (centroids)."""
		if self.model is None:
			raise RuntimeError("Model not loaded.")
		return self.model.cluster_centers_
    
	def get_n_clusters(self) -> int:
		"""Return the number of clusters."""
		if self.model is None:
			raise RuntimeError("Model not loaded.")
		return self.model.n_clusters
# K-Means clustering for postcode risk grouping
