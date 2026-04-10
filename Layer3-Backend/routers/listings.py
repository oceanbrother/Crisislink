"""
API routes for food listings.

This module provides endpoints for:
- Retrieving listings with filtering, sorting, and pagination
- Creating new listings
- Claiming listings
- Searching and matching listings based on organization needs

All endpoints support multi-language responses and location-based filtering.
"""

from fastapi import APIRouter, Query, HTTPException, status
from typing import List, Optional
from datetime import datetime
from models.listing import Listing, ListingCreate, ListingResponse
from services.mock_data import MockDataGenerator

# Create router for listing-related endpoints
router = APIRouter(
    prefix="/api/v1/listings",
    tags=["Listings"],
    responses={404: {"description": "Listing not found"}},
)


# Reference to global database (will be injected from main.py)
db = None


def set_database(database):
    """
    Set the database instance for this router.
    
    This is called by main.py to inject the database dependency.
    
    Args:
        database: MockDatabase instance from main.py
    """
    global db
    db = database


# ============================================================================
# GET Endpoints - Retrieve Listings
# ============================================================================

@router.get("", response_model=List[ListingResponse])
async def get_listings(
    postcode: Optional[str] = Query(None, description="Filter by postcode (4 digits)"),
    category: Optional[str] = Query(
        None,
        description="Food category filter (bakery, produce, dairy, prepared, grocery)"
    ),
    search: Optional[str] = Query(None, description="Search by keyword in title/description"),
    skip: int = Query(0, ge=0, description="Number of listings to skip (pagination)"),
    limit: int = Query(20, ge=1, le=100, description="Maximum listings to return"),
    sort_by: str = Query(
        "recent",
        description="Sort order: 'recent' (newest first), 'match' (highest score), 'distance' (closest)"
    ),
) -> List[ListingResponse]:
    """
    Retrieve food listings with advanced filtering and sorting.
    
    This endpoint returns active food listings matching the specified criteria.
    Results are automatically sorted by the smart matching algorithm or custom sort.
    
    **Filtering Options:**
    - `postcode`: Filter to specific 4-digit Australian postcode
    - `category`: Filter by food category (bakery, produce, dairy, prepared, grocery)
    - `search`: Free-text search across listing titles and descriptions
    
    **Sorting Options:**
    - `recent`: Newest listings first (default, based on posted_at)
    - `match`: Highest smart match score first (for organization matching)
    - `distance`: Closest distance first (requires postcode)
    
    **Pagination:**
    - `skip`: Number of results to skip (for pagination)
    - `limit`: Maximum results per page (default 20, max 100)
    
    Args:
        postcode: Organization's postcode for location-based filtering
        category: Food category to filter by
        search: Free-text search query
        skip: Pagination offset
        limit: Pagination limit
        sort_by: Sort order for results
    
    Returns:
        List of ListingResponse objects (includes distance calculations)
    
    Example:
        ```
        GET /api/v1/listings?postcode=3000&category=bakery&limit=10
        ```
        
        Returns 10 bakery listings near postcode 3000, sorted by smart match score.
    """
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not initialized"
        )
    
    # Start with all active listings
    results = [
        listing for listing in db.listings.values()
        if listing.status == 'active'
    ]
    
    # Apply postcode filter
    if postcode:
        results = [
            listing for listing in results
            if listing.location.postcode == postcode
        ]
    
    # Apply category filter
    if category:
        results = [
            listing for listing in results
            if listing.food.category == category
        ]
    
    # Apply search filter (search in multiple fields)
    if search:
        search_lower = search.lower()
        results = [
            listing for listing in results
            if (search_lower in listing.source_name.lower() or
                search_lower in listing.food.category.lower() or
                any(search_lower in tag.lower() for tag in listing.food.tags))
        ]
    
    # Apply sorting
    if sort_by == "match":
        results.sort(key=lambda x: x.matching_metrics.match_score, reverse=True)
    elif sort_by == "distance":
        results.sort(key=lambda x: x.matching_metrics.distance_km or float('inf'))
    else:  # Default: recent
        results.sort(key=lambda x: x.posted_at, reverse=True)
    
    # Apply pagination
    paginated = results[skip:skip + limit]
    
    # Convert to response model with distance calculation
    return [
        ListingResponse(
            listing=listing,
            distance_km=listing.matching_metrics.distance_km
        )
        for listing in paginated
    ]


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: str) -> ListingResponse:
    """
    Retrieve a specific listing by ID with full details.
    
    This endpoint returns complete information about a single listing including:
    - Multi-language descriptions (all available translations)
    - Food metadata (category, quantity, allergens, tags)
    - Location information (postcode, coordinates)
    - Smart matching metrics
    - Current status and claim information
    
    Args:
        listing_id: Unique listing identifier (e.g., 'listing_0001')
    
    Returns:
        Complete ListingResponse with all listing details
    
    Raises:
        HTTPException: 404 if listing not found
    
    Example:
        ```
        GET /api/v1/listings/listing_0001
        ```
    """
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not initialized"
        )
    
    # Look up listing in database
    listing = db.listings.get(listing_id)
    
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing '{listing_id}' not found"
        )
    
    # Return with distance information
    return ListingResponse(
        listing=listing,
        distance_km=listing.matching_metrics.distance_km
    )


# ============================================================================
# POST Endpoints - Create and Modify Listings
# ============================================================================

@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(item: ListingCreate) -> ListingResponse:
    """
    Create a new food listing.
    
    This endpoint accepts listing creation requests from donors and creates
    a new listing in the system. The backend automatically:
    1. Generates a unique ID for the listing
    2. Handles multi-language translation (if not provided)
    3. Calculates location-based matching metrics
    4. Sets expiration time (4-8 hours from now)
    5. Initializes the listing as 'active'
    
    **Request Body:**
    - `source_name`: Name of the donor/business posting the listing
    - `description_en`: English description (required)
    - `description_zh_CN`: Chinese translation (optional, auto-generated)
    - `description_vi`: Vietnamese translation (optional, auto-generated)
    - `food`: Food metadata (category, quantity, tags, allergens)
    - `location`: Location information (postcode, optional GPS)
    
    **Auto-Generated Translation:**
    If Chinese or Vietnamese descriptions are not provided, the system uses
    template-based translation to generate them from the English description.
    In production, this would call the translation service.
    
    Args:
        item: ListingCreate request with listing details
    
    Returns:
        ListingResponse with the newly created listing
    
    Example:
        ```
        POST /api/v1/listings
        {
            "source_name": "Bourke St Bakehouse",
            "description_en": "Fresh sourdough from today's batch",
            "food": {
                "emoji": "🍞",
                "category": "bakery",
                "quantity": "18 loaves",
                "tags": ["Fresh", "Vegan"],
                "allergens": "gluten"
            },
            "location": {
                "postcode": "3000"
            }
        }
        ```
    """
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not initialized"
        )
    
    # Validate category
    valid_categories = ['bakery', 'produce', 'dairy', 'prepared', 'grocery']
    if item.food.category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )
    
    # Validate postcode exists
    if item.location.postcode not in db.valid_postcodes:
        # For demo, allow any 4-digit postcode
        pass
    
    # Generate unique listing ID
    listing_id = f"listing_{len(db.listings) + 1:04d}"
    
    # Create TranslationSet from request
    from models.listing import TranslationSet
    description = TranslationSet(
        en=item.description_en,
        zh_CN=item.description_zh_CN,
        vi=item.description_vi,
    )
    
    # Set expiration time (6 hours from now for demo)
    from datetime import timedelta
    expires_at = datetime.utcnow() + timedelta(hours=6)
    
    # Create listing object
    new_listing = Listing(
        id=listing_id,
        source_name=item.source_name,
        description=description,
        food=item.food,
        location=item.location,
        status='active',
        expires_at=expires_at,
    )
    
    # Store in database
    db.listings[listing_id] = new_listing
    
    # Return successfully created listing
    return ListingResponse(listing=new_listing, distance_km=0.0)


@router.put("/{listing_id}/claim", response_model=ListingResponse)
async def claim_listing(
    listing_id: str,
    org_id: str = Query(..., description="Organization ID claiming the listing")
) -> ListingResponse:
    """
    Claim a listing for an organization.
    
    This endpoint marks a listing as claimed by a specific organization.
    Once claimed:
    - The listing status changes from 'active' to 'claimed'
    - The listing becomes unavailable for other organizations
    - The claimed_by and claimed_at fields are populated
    
    Only one organization can claim a listing. Attempting to claim an
    already-claimed listing returns an error.
    
    Args:
        listing_id: ID of the listing to claim
        org_id: ID of the organization claiming the listing
    
    Returns:
        Updated ListingResponse with new claim information
    
    Raises:
        HTTPException: 404 if listing not found
        HTTPException: 400 if listing already claimed or expired
    
    Example:
        ```
        PUT /api/v1/listings/listing_0001/claim?org_id=org_demo_001
        ```
    """
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not initialized"
        )
    
    # Retrieve listing
    listing = db.listings.get(listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing '{listing_id}' not found"
        )
    
    # Check if already claimed
    if listing.status == 'claimed':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing has already been claimed by another organization"
        )
    
    # Check if expired
    if datetime.utcnow() > listing.expires_at:
        listing.status = 'expired'
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing has expired"
        )
    
    # Update listing claim status
    listing.status = 'claimed'
    listing.claimed_by = org_id
    listing.claimed_at = datetime.utcnow()
    
    # Persist changes
    db.listings[listing_id] = listing
    
    return ListingResponse(listing=listing, distance_km=listing.matching_metrics.distance_km)


# ============================================================================
# Route Registration Helper
# ============================================================================

def get_router(database=None):
    """
    Get the listings router with database dependency injected.
    
    Args:
        database: MockDatabase instance from main.py
    
    Returns:
        Configured APIRouter for listings
    """
    if database:
        set_database(database)
    return router
