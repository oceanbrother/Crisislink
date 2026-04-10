"""
API routes for authentication and validation.

This module provides endpoints for:
- Validating donor postcodes
- Validating organization codes
- User and organization authentication (demo version)

In the demo version, authentication is simplified to basic postcode/org code
validation. In production, this would include proper JWT token management,
user accounts, and security measures.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict

# Create router for authentication-related endpoints
router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

# Reference to global database (will be injected from main.py)
db = None


def set_database(database):
    """
    Set the database instance for this router.
    
    Args:
        database: MockDatabase instance from main.py
    """
    global db
    db = database


# ============================================================================
# Request/Response Models
# ============================================================================

class PostcodeValidationRequest(BaseModel):
    """
    Request to validate and authenticate a donor user by postcode.
    
    Attributes:
        postcode: 4-digit Australian postcode (e.g., '3000')
        language: Optional preferred language code (e.g., 'en', 'zh-CN', 'vi')
    """
    postcode: str = Field(
        ...,
        pattern=r'^\d{4}$',
        description="4-digit Australian postcode"
    )
    language: str = Field(
        default="en",
        description="Preferred language code (en, zh-CN, vi)"
    )


class PostcodeValidationResponse(BaseModel):
    """
    Response confirming successful postcode validation.
    
    Attributes:
        valid: Whether the postcode is valid
        postcode: The validated postcode
        location: A user-friendly location description (demo only)
        message: Status message
    """
    valid: bool = Field(..., description="Whether validation was successful")
    postcode: str = Field(..., description="The validated postcode")
    location: str = Field(..., description="Location description")
    message: str = Field(..., description="Human-readable status message")


class OrgCodeValidationRequest(BaseModel):
    """
    Request to validate and authenticate an organization by code.
    
    Attributes:
        org_code: Organization code in format XXX-NNN (e.g., 'HCB-001')
        language: Optional preferred language code
    """
    org_code: str = Field(
        ...,
        pattern=r'^[A-Z]{3}-\d{3}$',
        description="Organization code (format: XXX-NNN)"
    )
    language: str = Field(
        default="en",
        description="Preferred language code (en, zh-CN, vi)"
    )


class OrgCodeValidationResponse(BaseModel):
    """
    Response confirming successful organization code validation.
    
    Attributes:
        valid: Whether the code is valid
        org_code: The validated organization code
        org_name: Name of the organization
        contact_person: Name of the contact person
        message: Status message
    """
    valid: bool = Field(..., description="Whether validation was successful")
    org_code: str = Field(..., description="The validated organization code")
    org_name: str = Field(..., description="Name of the organization")
    contact_person: str = Field(..., description="Contact person's name")
    message: str = Field(..., description="Human-readable status message")


# ============================================================================
# Authentication Endpoints
# ============================================================================

@router.post("/validate-postcode", response_model=PostcodeValidationResponse)
async def validate_postcode(request: PostcodeValidationRequest) -> PostcodeValidationResponse:
    """
    Validate a donor's postcode for access to the platform.
    
    This endpoint authenticates donors by verifying they are in a postcode
    covered by the CrisisLink service. In the demo, all valid Australian
    postcodes are accepted.
    
    **Demo Implementation:**
    - Accepts any valid 4-digit Australian postcode
    - Returns location description (hardcoded for demo)
    - Sets user's language preference for future interactions
    
    **Production Implementation (Future):**
    - Check postcode against service area database
    - Create/retrieve user account in PostgreSQL
    - Return JWT token for authenticated requests
    - Log authentication attempt for analytics
    
    Args:
        request: PostcodeValidationRequest with postcode and language
    
    Returns:
        PostcodeValidationResponse confirming validation success
    
    Raises:
        HTTPException: 400 if postcode format is invalid
        HTTPException: 403 if postcode not in service area
    
    Example:
        ```
        POST /api/v1/auth/validate-postcode
        {
            "postcode": "3000",
            "language": "en"
        }
        ```
        
        Response:
        ```
        {
            "valid": true,
            "postcode": "3000",
            "location": "Melbourne CBD",
            "message": "Postcode validated successfully"
        }
        ```
    """
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not initialized"
        )
    
    postcode = request.postcode
    language = request.language
    
    # Validate language parameter
    valid_languages = ['en', 'zh-CN', 'vi']
    if language not in valid_languages:
        language = 'en'  # Default to English
    
    # In demo, accept any valid 4-digit postcode
    # In production, check against service area database
    if not postcode or len(postcode) != 4 or not postcode.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid postcode format. Must be 4 digits."
        )
    
    # Map postcodes to locations (demo data)
    postcode_to_location = {
        '3000': 'Melbourne CBD',
        '3001': 'Docklands',
        '3002': 'Southbank',
        '3003': 'St Kilda Road',
        '3004': 'Southbank/Docklands',
        '3005': 'Docklands',
        '3006': 'Docklands',
        '3008': 'Southbank',
        '3011': 'West Melbourne',
        '3051': 'Carlton',
        '3053': 'Fitzroy',
        '3065': 'Collingwood',
        '3121': 'Richmond',
    }
    
    # For demo: accept any postcode, but provide location if available
    location = postcode_to_location.get(postcode, f"Postcode {postcode}")
    
    # Store language preference (in production: update user account)
    # db.users[postcode] = {'language': language}  # Simplified storage
    
    return PostcodeValidationResponse(
        valid=True,
        postcode=postcode,
        location=location,
        message="Postcode validated successfully. Welcome to CrisisLink!"
    )


@router.post("/validate-orgcode", response_model=OrgCodeValidationResponse)
async def validate_orgcode(request: OrgCodeValidationRequest) -> OrgCodeValidationResponse:
    """
    Validate an organization's code for coordinator access.
    
    This endpoint authenticates food coordinator users by verifying their
    organization code. Organizations are issued unique codes (e.g., 'HCB-001')
    to access the coordinator dashboard.
    
    **Demo Implementation:**
    - Validates against hardcoded demo organization codes
    - Returns organization details on successful validation
    - Sets organization's language preference
    
    **Production Implementation (Future):**
    - Look up org code in PostgreSQL organizations table
    - Create/verify organization account
    - Return JWT token for authenticated requests
    - Log coordinator login for audit trail
    
    Args:
        request: OrgCodeValidationRequest with org_code and language
    
    Returns:
        OrgCodeValidationResponse with organization details
    
    Raises:
        HTTPException: 400 if code format is invalid
        HTTPException: 403 if code is not found or invalid
    
    Example:
        ```
        POST /api/v1/auth/validate-orgcode
        {
            "org_code": "HCB-001",
            "language": "zh-CN"
        }
        ```
        
        Response:
        ```
        {
            "valid": true,
            "org_code": "HCB-001",
            "org_name": "Harvest City Food Bank",
            "contact_person": "Sarah Johnson",
            "message": "Organization validated. Welcome back!"
        }
        ```
    """
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not initialized"
        )
    
    org_code = request.org_code
    language = request.language
    
    # Validate language parameter
    valid_languages = ['en', 'zh-CN', 'vi']
    if language not in valid_languages:
        language = 'en'
    
    # Validate code format
    if not isinstance(org_code, str) or not len(org_code) == 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization code format. Expected: XXX-NNN (e.g., HCB-001)"
        )
    
    # Look up organization code in cache
    if org_code not in db.valid_org_codes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organization code '{org_code}' not found or invalid. Please verify with your coordinator."
        )
    
    # Retrieve organization details
    org = db.valid_org_codes[org_code]
    
    # Update organization's language preference (in production: update account)
    # org.preferred_language = language  # Would persist to database
    
    return OrgCodeValidationResponse(
        valid=True,
        org_code=org_code,
        org_name=org.name,
        contact_person=org.contact_person,
        message=f"Welcome back, {org.contact_person}! Your organization has been authenticated."
    )


@router.get("/status")
async def auth_status() -> Dict[str, str]:
    """
    Get current authentication status and available features.
    
    This endpoint provides information about authentication mechanisms
    and supported features (useful for frontend UI configuration).
    
    Returns:
        Dictionary with authentication status and supported methods
    """
    return {
        "status": "operational",
        "auth_methods": ["postcode", "organization_code"],
        "demo_mode": True,
        "message": "Demo version: Simplified authentication for testing"
    }


# ============================================================================
# Route Registration Helper
# ============================================================================

def get_router(database=None):
    """
    Get the authentication router with database dependency injected.
    
    Args:
        database: MockDatabase instance from main.py
    
    Returns:
        Configured APIRouter for authentication
    """
    if database:
        set_database(database)
    return router
