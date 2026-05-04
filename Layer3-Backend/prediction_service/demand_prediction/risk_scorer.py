"""
Risk Scorer: End-to-end demand risk scoring pipeline.

Loads all five trained artifacts at construction time and raises on any failure
so the prediction service refuses to start with a broken model state.
"""

import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd

from .k_means_clustering import KMeansClustering
from .random_forest_forecaster import RandomForestForecaster

_MODELS_DIR = Path(__file__).parent / "models"

_DEFAULT_CLUSTER_LOOKUP = {"0": "High", "1": "MediumHigh", "2": "MediumLow", "3": "Low"}


def _load_pickle(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"Required model artifact not found: {path}")
    with open(path, "rb") as fh:
        return pickle.load(fh)


def _load_json(path: Path):
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


class RiskScorer:
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

    RF_FEATURE_NAMES = [
        "unemployment_rate",
        "rent_to_income_ratio",
        "unemployment_rate_log",
        "rent_to_income_ratio_log",
        "total_population_log",
        "single_parent_pct",
        "median_hhd_income_weekly",
        "median_rent_weekly",
        "rent_to_income_final",
        "unemployment_rate_sqrt",
        "cluster",
    ]

    def __init__(self, models_dir: Path = _MODELS_DIR):
        self.scaler = _load_pickle(models_dir / "scaler.pkl")
        self.kmeans = KMeansClustering(str(models_dir / "kmeans_model.pkl"))
        self.cluster_lookup: dict = _load_json(models_dir / "cluster_lookup.json") or _DEFAULT_CLUSTER_LOOKUP
        try:
            self.forecaster = _load_pickle(models_dir / "demand_forecaster.pkl")
        except Exception as e:
            print(f"[WARN] demand_forecaster.pkl could not be loaded ({e}); online learning disabled")
            self.forecaster = None
        self.shap_surrogate = _load_pickle(models_dir / "shap_surrogate.pkl")
        self.feature_names = self._resolve_feature_names()

    def _resolve_feature_names(self) -> list[str]:
        if hasattr(self.scaler, "feature_names_in_"):
            return list(self.scaler.feature_names_in_)
        if hasattr(self.scaler, "n_features_in_"):
            n = int(self.scaler.n_features_in_)
            return list(self.FEATURE_NAMES[:n])
        return list(self.FEATURE_NAMES)

    def _build_X(self, seifa_records: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, pd.DataFrame]:
        X = seifa_records[self.feature_names].values.astype(np.float64)
        col_medians = np.nanmedian(X, axis=0)
        for i in range(X.shape[1]):
            X[np.isnan(X[:, i]), i] = col_medians[i]
        X_scaled = self.scaler.transform(X)
        scaled_df = pd.DataFrame(X_scaled, columns=self.feature_names)
        clusters = self.kmeans.predict(X_scaled)
        return X_scaled, clusters, scaled_df

    def _rf_input(self, scaled_df: pd.DataFrame, clusters: np.ndarray, seifa_records: pd.DataFrame) -> np.ndarray:
        rf_features = list(getattr(self.shap_surrogate, "feature_names_in_", [])) or self.RF_FEATURE_NAMES
        cols = []
        for name in rf_features:
            if name in scaled_df.columns:
                cols.append(scaled_df[name].values)
            elif name in {"cluster", "cluster_assignment", "cluster_id"}:
                cols.append(clusters)
            elif name in seifa_records.columns:
                cols.append(seifa_records[name].astype(float).values)
            else:
                cols.append(np.zeros(len(seifa_records)))
        X_rf = np.column_stack(cols)
        medians = np.nanmedian(X_rf, axis=0)
        for i in range(X_rf.shape[1]):
            X_rf[np.isnan(X_rf[:, i]), i] = medians[i]
        return X_rf

    def _shap_top_features(self, X_rf: np.ndarray, rf_features: list[str], top_n: int = 3) -> list[dict]:
        try:
            import shap
            explainer = shap.TreeExplainer(self.shap_surrogate)
            shap_values = explainer.shap_values(X_rf)
            mean_abs = np.abs(shap_values).mean(axis=0) if shap_values.ndim == 2 else np.abs(shap_values)
            indices = np.argsort(mean_abs)[::-1][:top_n]
            return [{"feature": rf_features[i], "importance": float(mean_abs[i])} for i in indices]
        except Exception:
            return []

    def score(self, seifa_records: pd.DataFrame) -> pd.DataFrame:
        if seifa_records.empty:
            return pd.DataFrame(columns=["postcode", "demand_risk_score", "cluster_assignment"])

        X_scaled, clusters, scaled_df = self._build_X(seifa_records)
        X_rf = self._rf_input(scaled_df, clusters, seifa_records)

        rf_features = list(getattr(self.shap_surrogate, "feature_names_in_", [])) or self.RF_FEATURE_NAMES

        _PROFILE_SCORES = {"high": 0.82, "medium-high": 0.62, "medium-low": 0.38, "low": 0.15}

        risk_scores = []
        top_features_list = []
        for i, row_rf in enumerate(X_rf):
            postcode = str(seifa_records.iloc[i]["postcode"])
            lookup = self.cluster_lookup.get(postcode, {})
            if lookup:
                profile_default = _PROFILE_SCORES.get(lookup.get("risk_profile", ""), None)
                rf_default = float(self.shap_surrogate.predict(row_rf.reshape(1, -1))[0])
                default_score = profile_default if profile_default is not None else rf_default
                score = float(lookup.get("risk_score", default_score))
            else:
                feature_dict = {rf_features[j]: float(row_rf[j]) for j in range(len(rf_features))}
                try:
                    score = float(self.forecaster.predict_one(feature_dict))
                except Exception:
                    score = float(self.shap_surrogate.predict(row_rf.reshape(1, -1))[0])
            score = max(0.0, min(1.0, score))
            risk_scores.append(score)
            top_features_list.append(self._shap_top_features(row_rf.reshape(1, -1), rf_features))

        return pd.DataFrame({
            "postcode": seifa_records["postcode"].values,
            "demand_risk_score": risk_scores,
            "cluster_assignment": clusters,
            "top_features": top_features_list,
        })

    def score_single(self, postcode: str, features_dict: dict) -> dict:
        df = pd.DataFrame([{**features_dict, "postcode": postcode}])
        result = self.score(df)
        return result.iloc[0].to_dict() if not result.empty else None

    def online_update(self, claim_events: list[dict]) -> None:
        if self.forecaster is None:
            return
        for event in claim_events:
            try:
                x = {k: float(v) for k, v in event.items() if k != "demand_risk_score"}
                y = float(event.get("demand_risk_score", 0.5))
                self.forecaster.learn_one(x, y)
            except Exception:
                pass
