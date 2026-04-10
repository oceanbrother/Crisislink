"""
API routers package for CrisisLink backend.

This package contains all API route definitions organized by feature:
- listings: Food listing CRUD and search operations
- auth: User and organization authentication and validation

Each router is independently configurable and can be mounted to the FastAPI
application with dependency injection for database access.
"""

from .listings import router as listings_router, set_database as set_listings_db
from .auth import router as auth_router, set_database as set_auth_db

__all__ = [
    'listings_router',
    'auth_router',
    'set_listings_db',
    'set_auth_db',
]
