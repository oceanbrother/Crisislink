"""
Listing data models for food donations and organizational needs.

This module defines models for food listings that donors post and organizations
search for. Each listing supports multi-language translations with fallback
to English. The model includes rich metadata for smart matching.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .translation import TranslationSet


class FoodMetadata(BaseModel):
    """
    Detailed food information for a listing.
    
    This groups food-specific attributes to keep the main Listing model clean.
    Includes category, quantity, tags, allergen information, and emoji identifier.
    
    Attributes:
        emoji: Food/category emoji (e.g., '🍞' for bakery)
        category: Primary food category (must be one of supported categories)
        quantity: Description of quantity (e.g., "18 loaves", "~30 kg")
        tags: List of descriptors (e.g., ['Vegan', 'Fresh baked', 'Organic'])
        allergens: Allergen information (e.g., "Contains gluten, sesame")
    """
    emoji: str = Field(
        ...,
        min_length=1,
        max_length=2,
        description="Unicode emoji representing food category"
    )
    category: str = Field(
        ...,
        description="Food category: 'bakery', 'produce', 'prepared', 'grocery', 'dairy'"
    )
    quantity: str = Field(
        ...,
        min_length=1,
        description="Human-readable quantity description"
    )
    tags: List[str] = Field(
        default_factory=list,
        description="Array of descriptive tags (e.g., ['Vegan', 'Fresh', 'Organic'])"
    )
    allergens: str = Field(
        default="None",
        description="Allergen information and warnings"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "emoji": "🍞",
                "category": "bakery",
                "quantity": "18 loaves",
                "tags": ["Vegan", "Fresh baked"],
                "allergens": "May contain gluten, sesame"
            }
        }


class Location(BaseModel):
    """
    Geographic location information for a listing.
    
    Uses postcode as primary identifier with optional GPS coordinates.
    Distance is calculated dynamically based on requester's location.
    
    Attributes:
        postcode: 4-digit Australian postcode
        latitude: Optional GPS latitude
        longitude: Optional GPS longitude
    """
    postcode: str = Field(
        ...,
        pattern=r'^\d{4}$',
        description="4-digit Australian postcode"
    )
    latitude: Optional[float] = Field(None, description="GPS latitude coordinate")
    longitude: Optional[float] = Field(None, description="GPS longitude coordinate")
    
    class Config:
        json_schema_extra = {
            "example": {
                "postcode": "3000",
                "latitude": -37.814,
                "longitude": 144.963
            }
        }


class MatchingMetrics(BaseModel):
    """
    Metadata used for smart matching algorithm.
    
    These fields are calculated/populated by the matching engine to determine
    how well a listing matches an organization's needs.
    
    Attributes:
        match_score: 0-100 score indicating relevance (higher is better)
        distance_km: Calculated distance from organization
        matched_tags: Tags that matched organization's search
    """
    match_score: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Smart match score (0-100)"
    )
    distance_km: Optional[float] = Field(
        None,
        ge=0,
        description="Distance in kilometers from organization"
    )
    matched_tags: List[str] = Field(
        default_factory=list,
        description="Tags that matched search criteria"
    )


class Listing(BaseModel):
    """
    Core listing model representing a food donation or organizational need.
    
    This is the primary data model for food listings in CrisisLink. It supports:
    - Multi-language translations (EN, Chinese, Vietnamese)
    - Rich metadata for smart matching
    - Postcode-based location filtering
    - Inventory/lifecycle tracking
    
    The model is designed to be flexible enough for both donor postings
    (surplus food) and organization requests (food needs).
    
    Attributes:
        id: Unique listing identifier (UUID in production)
        source_name: Name of donor/organization posting the listing
        description: Translatable description of the food/need
        food: FoodMetadata containing category, quantity, tags, allergens
        location: Geographic location information
        matching_metrics: Smart matching scores and metadata
        translations: Full multi-language content (pre-translated by backend)
        status: Current status of listing ('active', 'claimed', 'expired')
        posted_at: Timestamp when listing was created
        expires_at: Timestamp when listing becomes unavailable
        claimed_by: ID of organization that claimed this listing
        claimed_at: Timestamp when listing was claimed
        
    Example:
        A donor posts: "Fresh sourdough loaves from morning batch"
        Backend stores with automatic translations (EN/ZH/VI)
        Org app displays in coordinator's language using smart matching
    """
    id: str = Field(..., description="Unique listing ID (UUID format)")
    source_name: str = Field(
        ...,
        min_length=1,
        description="Name of business/donor posting the listing"
    )
    description: TranslationSet = Field(
        ...,
        description="Listing description with multi-language translations"
    )
    food: FoodMetadata = Field(
        ...,
        description="Detailed food information (category, quantity, tags, allergens)"
    )
    location: Location = Field(
        ...,
        description="Geographic location for the listing"
    )
    matching_metrics: MatchingMetrics = Field(
        default_factory=MatchingMetrics,
        description="Metrics used for smart matching algorithm"
    )
    translations: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict,
        description="Complete multi-language translations (auto-populated by backend)"
    )
    status: str = Field(
        default="active",
        description="Listing status: 'active', 'claimed', 'expired'"
    )
    posted_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(
        ...,
        description="Timestamp when listing expires (typically 4-8 hours after creation)"
    )
    claimed_by: Optional[str] = Field(None, description="ID of claiming organization")
    claimed_at: Optional[datetime] = Field(None, description="Timestamp when claimed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "listing_001",
                "source_name": "Bourke St Bakehouse",
                "description": {
                    "en": "High-quality sourdough loaves from this morning's batch.",
                    "zh_CN": "今天早晨新鲜出炉的高品质酸面包。",
                    "vi": "Ổ bánh mì chua chất lượng cao vừa ra lò sáng nay."
                },
                "food": {
                    "emoji": "🍞",
                    "category": "bakery",
                    "quantity": "18 loaves",
                    "tags": ["Vegan", "Fresh baked"],
                    "allergens": "May contain gluten, sesame"
                },
                "location": {
                    "postcode": "3000",
                    "latitude": -37.814,
                    "longitude": 144.963
                },
                "matching_metrics": {
                    "match_score": 94,
                    "distance_km": 0.4,
                    "matched_tags": ["bakery", "fresh"]
                },
                "status": "active",
                "expires_at": "2026-04-10T20:00:00"
            }
        }


class ListingCreate(BaseModel):
    """
    Request model for creating a new listing.
    
    This is the schema that frontend sends when creating a new listing.
    The backend will automatically:
    1. Generate translations from the English description
    2. Calculate location-based matching metrics
    3. Set expiration time
    4. Assign unique ID
    
    Attributes:
        source_name: Name of donor/organization
        description_en: English description (required)
        description_zh_CN: Chinese description (optional, will be auto-translated if missing)
        description_vi: Vietnamese description (optional, will be auto-translated if missing)
        food: FoodMetadata with all food details
        location: Geographic location
    """
    source_name: str = Field(..., min_length=1, description="Donor/organization name")
    description_en: str = Field(..., min_length=10, description="English description")
    description_zh_CN: Optional[str] = Field(None, description="Chinese translation (auto-generated if none)")
    description_vi: Optional[str] = Field(None, description="Vietnamese translation (auto-generated if none)")
    food: FoodMetadata = Field(..., description="Food metadata")
    location: Location = Field(..., description="Location information")
    
    class Config:
        json_schema_extra = {
            "example": {
                "source_name": "Bourke St Bakehouse",
                "description_en": "High-quality sourdough loaves from this morning's batch.",
                "food": {
                    "emoji": "🍞",
                    "category": "bakery",
                    "quantity": "18 loaves",
                    "tags": ["Vegan", "Fresh baked"],
                    "allergens": "May contain gluten, sesame"
                },
                "location": {
                    "postcode": "3000"
                }
            }
        }


class ListingResponse(BaseModel):
    """
    Response model returned by API endpoints.
    
    This contains the complete listing with calculated metrics.
    The frontend consumes this to display listings with relevant information
    like distance, smart match score, and multi-language content.
    
    Extends Listing with API-specific fields.
    """
    listing: Listing = Field(..., description="The listing object")
    distance_km: Optional[float] = Field(
        None,
        description="Distance from requester to listing location"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "listing": {
                    "id": "listing_001",
                    "source_name": "Bourke St Bakehouse",
                    "status": "active",
                    "match_score": 94
                },
                "distance_km": 0.4
            }
        }
