"""
User and Organization models for authentication and profile management.

This module defines data models for donors (individual users) and organizations
(food banks, businesses, charities). Both support postcode-based validation.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr
from enum import Enum


class UserRole(str, Enum):
    """User roles in the CrisisLink system."""
    DONOR = "donor"
    COORDINATOR = "coordinator"
    ADMIN = "admin"


class User(BaseModel):
    """
    Represents an individual donor user in the system.
    
    Demo version uses postcode as the primary authentication mechanism.
    In production, this would support full user accounts with authentication.
    
    Attributes:
        id: Unique user identifier (UUID format in production)
        name: User display name
        postcode: 4-digit Australian postcode for location-based matching
        phone: Optional contact phone number
        email: Optional contact email
        preferred_language: ISO 639-1 language code preference
        created_at: Account creation timestamp
    """
    id: str = Field(..., description="Unique user ID")
    name: str = Field(..., min_length=1, description="User display name")
    postcode: str = Field(
        ..., 
        pattern=r'^\d{4}$',
        description="4-digit Australian postcode"
    )
    phone: Optional[str] = Field(None, description="Contact phone number")
    email: Optional[EmailStr] = Field(None, description="Contact email")
    preferred_language: str = Field("en", description="Preferred language code")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "user_001",
                "name": "John Donor",
                "postcode": "3000",
                "phone": "+61412345678",
                "email": "john@example.com",
                "preferred_language": "en"
            }
        }


class Organization(BaseModel):
    """
    Represents a food bank, charity, or receiving organization.
    
    Demo version uses organization code as the primary authentication mechanism.
    The org_code is a short alphanumeric code (e.g., 'HCB-001') for quick validation.
    
    Attributes:
        id: Unique organization identifier
        name: Organization display name
        org_code: Short alphanumeric code for quick validation (e.g., 'HCB-001')
        postcode: Service area postcode
        needs: List of food categories the organization currently needs
        contact_person: Name of primary contact
        email: Organization email
        phone: Organization phone
        preferred_language: Preferred language for interface and communications
        description: Organization mission/description (translatable in production)
        created_at: Registration timestamp
    """
    id: str = Field(..., description="Unique organization ID")
    name: str = Field(..., min_length=1, description="Organization name")
    org_code: str = Field(
        ...,
        pattern=r'^[A-Z]{3}-\d{3}$',
        description="Org code format: XXX-NNN (e.g., HCB-001)"
    )
    postcode: str = Field(
        ...,
        pattern=r'^\d{4}$',
        description="4-digit Australian postcode for service area"
    )
    needs: List[str] = Field(
        default_factory=list,
        description="Food categories organization needs (e.g., ['dairy', 'bakery'])"
    )
    contact_person: str = Field(..., description="Primary contact person name")
    email: Optional[EmailStr] = Field(None, description="Organization email")
    phone: Optional[str] = Field(None, description="Organization phone")
    preferred_language: str = Field("en", description="Preferred language code")
    description: str = Field(
        default="",
        description="Organization description/mission statement"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "org_001",
                "name": "Harvest City Food Bank",
                "org_code": "HCB-001",
                "postcode": "3000",
                "needs": ["bakery", "produce", "dairy"],
                "contact_person": "Sarah Johnson",
                "email": "contact@harvestcity.org",
                "phone": "+61398765432",
                "preferred_language": "en",
                "description": "Supporting food security in inner Melbourne"
            }
        }
