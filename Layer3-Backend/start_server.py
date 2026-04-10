#!/usr/bin/env python3
import sys
import os
from pathlib import Path

# Add current directory to Python path
backend_dir = Path(__file__).parent.absolute()
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import and run
if __name__ == "__main__":
    import uvicorn
    from listing_service.main import app
    
    print("\n" + "=" * 70)
    print("CrisisLink Backend API - Testing Server")
    print("=" * 70)
    print("API Docs:    http://localhost:9000/docs")
    print("Health:      http://localhost:9000/health")
    print("=" * 70 + "\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=9000,
        reload=False,
        log_level="info"
    )
