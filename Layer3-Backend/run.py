#!/usr/bin/env python3
"""
CrisisLink Backend Application Launcher.

This script properly sets up the Python path and launches the FastAPI
development server with auto-reload enabled.

Usage:
    python run.py              # Run with default settings
    python run.py --port 8001  # Run on different port
    python run.py --prod       # Run in production mode (no reload)

Requirements:
    - Python 3.8+
    - All dependencies in requirements.txt installed

Installation:
    pip install -r requirements.txt
    python run.py
"""

import sys
import os
import argparse
from pathlib import Path

# Add Layer3-Backend directory to Python path
# This allows imports like: from models.listing import Listing
backend_dir = Path(__file__).parent.absolute()
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import after path setup
from listing_service.main import app
import uvicorn


def main():
    """Parse arguments and start server."""
    parser = argparse.ArgumentParser(description="CrisisLink Backend Server")
    parser.add_argument("--port", type=int, default=8000, help="Port to run on (default: 8000)")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)")
    parser.add_argument("--prod", action="store_true", help="Run in production mode (no reload)")
    parser.add_argument("--reload", action="store_true", default=True, help="Enable auto-reload (default: True)")
    
    args = parser.parse_args()
    
    # Determine reload setting
    reload = not args.prod and args.reload
    
    print(f"🚀 Starting CrisisLink Backend")
    print(f"   Host: {args.host}:{args.port}")
    print(f"   Reload: {reload}")
    print(f"   Mode: {'Development' if reload else 'Production'}")
    print()
    
    # Load environment
    from dotenv import load_dotenv
    load_dotenv(os.path.join(backend_dir, ".env"))
    
    # Start server
    uvicorn.run(
        "listing_service.main:app",  # Explicit module path
        host=args.host,
        port=args.port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    main()
