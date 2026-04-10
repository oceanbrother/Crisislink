"""
CrisisLink Backend API - Main Application Entry Point.

This module initializes and configures the FastAPI application for the demo version.
It sets up:
- CORS middleware for frontend communication
- Mock database with 50+ pre-generated listings
- API routes for all backend services
- WebSocket connections for real-time updates (extensible)

The demo version uses in-memory storage. In production, this would
connect to PostgreSQL with proper session management and caching.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Dict, List
import logging

# Import models and services
from models.listing import Listing
from models.user import User, Organization
from services.mock_data import MockDataGenerator

# Configure logging for debugging and monitoring
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# Global In-Memory Database
# ============================================================================
# In the demo version, we use simple Python dictionaries as a database.
# In production, these would be replaced with PostgreSQL queries.

class MockDatabase:
    """
    Simple in-memory database for demo purposes.
    
    This class simulates database functionality using Python dictionaries.
    Each attribute represents a database table:
    - listings: All food listings (key: listing_id)
    - users: All donor users (key: user_id)
    - organizations: All receiving organizations (key: org_id)
    - postcode_cache: Valid postgcodes for performance (cached validation)
    
    In production, this would be replaced with actual database queries
    through SQLAlchemy ORM.
    """
    
    def __init__(self):
        """Initialize empty database storage."""
        self.listings: Dict[str, Listing] = {}
        self.users: Dict[str, User] = {}
        self.organizations: Dict[str, Organization] = {}
        # Cache for valid postcode validation (demo uses hardcoded list)
        self.valid_postcodes: set = set()
        self.valid_org_codes: Dict[str, Organization] = {}
    
    def initialize_demo_data(self):
        """
        Populate the in-memory database with mock data.
        
        This is called once at application startup to create realistic
        demo listings and users for testing and demonstration.
        """
        logger.info("Initializing mock database with demo data...")
        
        # Generate and store listings (50+ items)
        listings, user, org = MockDataGenerator.generate_all_demo_data()
        
        for listing in listings:
            self.listings[listing.id] = listing
        
        # Store demo user and organization
        self.users[user.id] = user
        self.organizations[org.id] = org
        
        # Cache valid postcodes (from generated listings)
        self.valid_postcodes = set(
            listing.location.postcode for listing in listings
        )
        self.valid_postcodes.add(user.postcode)
        self.valid_postcodes.add(org.postcode)
        
        # Cache org codes
        self.valid_org_codes[org.org_code] = org
        
        logger.info(f"✓ Loaded {len(listings)} listings")
        logger.info(f"✓ Loaded {len(self.users)} users")
        logger.info(f"✓ Loaded {len(self.organizations)} organizations")
        logger.info(f"✓ Cached {len(self.valid_postcodes)} valid postcodes")


# Create global database instance
db = MockDatabase()


# ============================================================================
# FastAPI Application Lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager for startup and shutdown events.
    
    Startup:
    - Initialize mock database with demo data
    - Log application configuration
    
    Shutdown:
    - Log shutdown event
    - Clean up resources (none in demo, but structure exists for production)
    
    Args:
        app: FastAPI application instance
    """
    # Startup event
    logger.info("=" * 60)
    logger.info("CrisisLink Backend API - Starting Up")
    logger.info("=" * 60)
    db.initialize_demo_data()
    logger.info("✓ Application ready for requests")
    logger.info(f"✓ API docs available at: http://localhost:8000/docs")
    
    yield  # Application runs here
    
    # Shutdown event
    logger.info("=" * 60)
    logger.info("CrisisLink Backend API - Shutting Down")
    logger.info("=" * 60)


# ============================================================================
# FastAPI Application Configuration
# ============================================================================

app = FastAPI(
    title="CrisisLink Backend API",
    description="""
    A food redistribution platform connecting donors with surplus food
    to organizations in need. This is the demo version using mock data
    and in-memory storage.
    
    **Key Features:**
    - Multi-language support (English, Chinese, Vietnamese)
    - Smart matching algorithm for food-organization pairing
    - Real-time listing updates via WebSocket
    - Postcode-based location filtering
    - Organization code authentication
    
    **Base URL:** http://localhost:8000
    **API Docs:** http://localhost:8000/docs
    **Alternative Docs:** http://localhost:8000/redoc
    """,
    version="0.1.0-demo",
    lifespan=lifespan,
)


# ============================================================================
# CORS Configuration
# ============================================================================
# Allow the frontend (React app running on localhost:5173) to communicate
# with this backend API. This is essential for development.

app.add_middleware(
    CORSMiddleware,
    # Allow requests from these origins
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",     # Vite dev server default port
        "http://127.0.0.1:5173",
        "*",  # Allow all origins in demo (restrict in production!)
    ],
    # Allow these HTTP methods
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    # Allow these HTTP headers
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "User-Agent",
        "Accept-Language",
    ],
    # Allow credentials (cookies, auth headers)
    allow_credentials=True,
    # How long to cache CORS preflight responses (in seconds)
    max_age=3600,
)


# ============================================================================
# Health Check Endpoint
# ============================================================================

@app.get("/health", tags=["System"])
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint for monitoring.
    
    Returns basic status information about the API.
    
    Returns:
        Dictionary with status and basic stats
    
    Example Response:
        {
            "status": "healthy",
            "listings_count": 50,
            "database": "in-memory-mock"
        }
    """
    return {
        "status": "healthy",
        "version": "0.1.0-demo",
        "database": "in-memory-mock",
        "listings_count": len(db.listings),
    }


@app.get("/", tags=["System"])
async def root() -> Dict[str, str]:
    """
    Root endpoint providing API information.
    
    Returns:
        Welcome message and documentation links
    """
    return {
        "message": "Welcome to CrisisLink API (Demo Version)",
        "docs": "http://localhost:8000/docs",
        "redoc": "http://localhost:8000/redoc",
        "health": "http://localhost:8000/health",
    }


# ============================================================================
# Register API Routes
# ============================================================================
# Import and mount the API routers for different feature domains.
# Each router handles a specific feature area and is independently testable.

try:
    # Import routers from the routers package
    # Note: If import fails, routers will be missing but API will remain functional
    from routers.listings import router as listings_router, set_database as set_listings_db
    from routers.auth import router as auth_router, set_database as set_auth_db
    
    # Inject database instance into routers  
    set_listings_db(db)
    set_auth_db(db)
    
    # Mount routers to the FastAPI app
    # Each router has its own prefix (e.g., /api/v1/listings)
    app.include_router(listings_router)
    app.include_router(auth_router)
    
    logger.info("✓ All API routes registered successfully")
    logger.info("  - GET/POST /api/v1/listings - Food listing operations")
    logger.info("  - POST /api/v1/auth/validate-postcode - Donor authentication")
    logger.info("  - POST /api/v1/auth/validate-orgcode - Organization authentication")

except ImportError as e:
    logger.warning(f"⚠ Failed to import routers: {e}")
    logger.warning("  API routes unavailable. Check PYTHONPATH and imports.")


# ============================================================================
# Future API Routes (to be implemented in subsequent phases)
# ============================================================================
# The following routers will be added as development progresses:
#
# 3. User API (future)
#    - GET /api/v1/users/{id} - Get user profile
#    - PUT /api/v1/users/{id} - Update user preferences
#    - GET /api/v1/users/{id}/history - Get user transaction history
#
# 4. Translation API (future)
#    - POST /api/v1/translate - Translate content between languages
#    - GET /api/v1/translate/languages - Supported language codes
#
# 5. Matching API (future)
#    - POST /api/v1/match - Calculate match scores for listings
#    - GET /api/v1/match/stats - Matching algorithm statistics
#
# 6. WebSocket Routes (future - real-time updates)
#    - WS /api/v1/ws/listings - Subscribe to listing updates
#    - WS /api/v1/ws/organizations - Organization-specific updates


if __name__ == "__main__":
    """
    Entry point for running the application locally.
    
    Usage:
        python main.py
        # or for development with auto-reload:
        uvicorn main:app --reload
    """
    import uvicorn
    
    uvicorn.run(
        app,
        host="0.0.0.0",     # Listen on all network interfaces
        port=8000,          # API port
        reload=True,        # Auto-reload on code changes
        log_level="info",   # Logging level
    )
