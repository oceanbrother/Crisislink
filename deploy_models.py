#!/usr/bin/env python3
"""
Model Deployment Script - Setup prediction service models and initialize database.

Usage:
    python deploy_models.py
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

# Define paths relative to project root
PROJECT_ROOT = Path(__file__).parent
MODELS_DIR = PROJECT_ROOT / "Layer4-AI" / "demand_prediction" / "models"
BACKEND_DIR = PROJECT_ROOT / "Layer3-Backend"
DATA_DIR = PROJECT_ROOT / "Layer5-Data"

def create_models_dir():
    """Create models directory if not exists."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✓ Models directory created: {MODELS_DIR}")

def check_model_files():
    """Check if model files exist."""
    required_files = [
        "kmeans_model.pkl",
        "shap_surrogate.pkl",
        "scaler.pkl",
    ]
    
    missing_files = []
    for filename in required_files:
        model_path = MODELS_DIR / filename
        if not model_path.exists():
            missing_files.append(filename)
        else:
            size_kb = model_path.stat().st_size / 1024
            print(f"✓ Found {filename} ({size_kb:.1f} KB)")
    
    if missing_files:
        print(f"\n⚠ Missing model files: {', '.join(missing_files)}")
        print(f"  Please place them in: {MODELS_DIR}")
        return False
    
    return True

def check_database_url():
    """Check if DATABASE_URL is configured."""
    env_file = BACKEND_DIR / "listing_service" / ".env"
    
    if not env_file.exists():
        print(f"⚠ No .env file found at {env_file}")
        return False
    
    # Robust check: allow whitespace, exported vars, and commented lines
    with open(env_file, 'r', encoding='utf-8', errors='ignore') as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            # support formats like 'DATABASE_URL=...' or 'export DATABASE_URL=...'
            if 'DATABASE_URL' in line and '=' in line:
                print(f"✓ DATABASE_URL is configured")
                return True

    print(f"⚠ DATABASE_URL not found in {env_file}")
    return False

def install_dependencies():
    """Install required Python packages."""
    print("\nInstalling ML dependencies...")
    
    requirements = [
        "scikit-learn==1.3.2",
        "pandas==2.1.3",
        "numpy==1.26.2",
    ]
    
    for package in requirements:
        print(f"  Installing {package}...")
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", package],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to install {package}")
            return False
    
    print("✓ All dependencies installed")
    return True

def run_schema_migration():
    """Run database schema migration."""
    schema_file = DATA_DIR / "postgresql" / "schema" / "02_iteration2.sql"
    
    if not schema_file.exists():
        print(f"⚠ Schema file not found: {schema_file}")
        return False
    
    print(f"\nRunning schema migration...")
    print(f"  File: {schema_file}")
    print("  Run manually: psql -U postgres -d crisislink_db -f {schema_file}")
    return True

def run_seifa_seeder():
    """Run SEIFA data seeder."""
    seeder_file = DATA_DIR / "postgresql" / "setup" / "seed_postcode_seifa.py"
    
    if not seeder_file.exists():
        print(f"⚠ Seeder file not found: {seeder_file}")
        return False
    
    print(f"\nRunning SEIFA seeder...")
    print(f"  File: {seeder_file}")
    
    try:
        subprocess.run(
            [sys.executable, str(seeder_file)],
            check=True,
            cwd=PROJECT_ROOT,
        )
        print("✓ SEIFA data seeded successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ SEIFA seeding failed: {e}")
        return False

def main():
    """Main deployment flow."""
    print("=" * 60)
    print("CrisisLink ML Models Deployment")
    print("=" * 60)
    
    steps = [
        ("Creating models directory", create_models_dir),
        ("Checking model files", check_model_files),
        ("Checking database configuration", check_database_url),
        ("Installing ML dependencies", install_dependencies),
    ]
    
    for step_name, step_func in steps:
        print(f"\n{step_name}...")
        try:
            result = step_func()
            if result is False:
                print(f"\n⚠ Setup incomplete due to: {step_name}")
                return 1
        except Exception as e:
            print(f"✗ Error in {step_name}: {e}")
            return 1
    
    print("\n" + "=" * 60)
    print("✓ Model deployment setup complete!")
    print("=" * 60)
    
    print("\nNext steps:")
    print("1. Ensure model files are in:", MODELS_DIR)
    print("2. Run database migrations:")
    print(f"   psql -U postgres -d crisislink_db -f {DATA_DIR}/postgresql/schema/02_iteration2.sql")
    print("3. Seed SEIFA data:")
    print(f"   python {DATA_DIR}/postgresql/setup/seed_postcode_seifa.py")
    print("4. Start prediction service:")
    print("   python -m uvicorn Layer3-Backend.prediction_service.main:app --port 8001")
    print("5. Check health:")
    print("   curl http://localhost:8001/health")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
