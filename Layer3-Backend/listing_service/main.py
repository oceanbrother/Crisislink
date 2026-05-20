"""
Listing Service — FastAPI backend for outbackshare
Backed by PostgreSQL (outbackshare_db) via the `databases` async library.
"""

import os
import re
import shutil
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Optional

import databases
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Load environment variables from the .env file next to this module
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Add the AI image recognition module to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Layer4-AI/image_recognition/food_photo_recognition")))

# Conditionally import the AI recognizer based on the environment flag
_enable_ai_recognizer = os.getenv("ENABLE_AI_RECOGNIZER", "true").lower() in ("true", "1", "yes")
if _enable_ai_recognizer:
    from recognizer import get_recognizer
else:
    def get_recognizer():
        """Returns None because the AI recognizer is disabled via environment config."""
        return None

# Read the database connection string from environment and fail fast if missing
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env")

# Create the async database connection and rate limiter instances
database = databases.Database(DATABASE_URL)
limiter = Limiter(key_func=get_remote_address)
recognizer = None

# Allowed image MIME types, max upload size, extension mapping, and valid listing statuses
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024
EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
ALLOWED_STATUSES = {"available", "claimed", "expired", "picked_up", "collected"}
CATEGORY_MAP = {
    "baked goods": "Baked goods",
    "bakery": "Baked goods",
    "bakery & grains": "Baked goods",
    "fruit & veg": "Fruit & veg",
    "fresh produce": "Fruit & veg",
    "produce": "Fruit & veg",
    "dairy": "Dairy",
    "dairy & eggs": "Dairy",
    "pantry": "Pantry",
    "grocery": "Pantry",
    "canned goods": "Pantry",
    "prepared meals": "Prepared meals",
    "prepared": "Prepared meals",
    "other": "Other",
}
SIZE_PREFIX = "[sizeCue:"


async def ensure_schema_extensions():
    """Runs idempotent ALTER TABLE and CREATE TABLE statements to keep the database schema
    up to date without requiring a separate migration step on startup."""
    # Keep local/dev environments forward-compatible without requiring a manual
    # migration step before startup. This is intentionally idempotent.
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS source_listing_id VARCHAR(36)")
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS pickup_window VARCHAR(100)")
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS contact_name VARCHAR(100)")
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS pickup_notes TEXT")
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP")
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS claim_id VARCHAR(36)")
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS allergen_tags VARCHAR(500)")
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(100)")
    await database.execute(
        """
        CREATE TABLE IF NOT EXISTS claim_thread (
            claim_id VARCHAR(36) PRIMARY KEY,
            listing_id VARCHAR(36) NOT NULL,
            source_listing_id VARCHAR(36),
            donor_org_code VARCHAR(20) NOT NULL,
            claiming_org_code VARCHAR(20) NOT NULL,
            is_closed BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL,
            closed_at TIMESTAMP
        )
        """
    )
    # Backfill columns for older claim_thread schemas created before these fields existed.
    await database.execute("ALTER TABLE claim_thread ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE")
    await database.execute("ALTER TABLE claim_thread ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP")
    await database.execute("CREATE INDEX IF NOT EXISTS idx_claim_thread_listing_id ON claim_thread(listing_id)")
    await database.execute(
        """
        CREATE TABLE IF NOT EXISTS claim_message (
            message_id VARCHAR(36) PRIMARY KEY,
            claim_id VARCHAR(36) NOT NULL REFERENCES claim_thread(claim_id) ON DELETE CASCADE,
            sender_type VARCHAR(20) NOT NULL,
            sender_org_code VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            sent_at TIMESTAMP NOT NULL,
            read_at TIMESTAMP
        )
        """
    )
    await database.execute("CREATE INDEX IF NOT EXISTS idx_claim_message_claim_id ON claim_message(claim_id)")
    await database.execute("UPDATE food_listing SET status = 'collected' WHERE status = 'picked_up'")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application startup and shutdown. Connects to the database, runs schema
    migrations, and optionally loads the food image recognition model."""
    global recognizer
    await database.connect()
    await ensure_schema_extensions()
    print("[OK] PostgreSQL connected")
    enable_ai = os.getenv("ENABLE_AI_RECOGNIZER", "true").lower() in ("true", "1", "yes")
    if enable_ai:
        print("Starting food recognizer...")
        try:
            recognizer = get_recognizer()
            print("[OK] Model ready")
        except Exception as exc:
            print(f"[WARN] Food recognizer failed to load ({exc}); image recognition disabled")
            recognizer = None
    else:
        print("[INFO] AI recognizer disabled via ENABLE_AI_RECOGNIZER=false")
        recognizer = None
    yield
    await database.disconnect()
    print("PostgreSQL disconnected")


app = FastAPI(
    title="CrisisLink Listing Service",
    description="API for creating and managing food listings",
    version="0.3.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Attach rate limiter and its error handler to the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Set up the uploads directory and serve it as a static file path
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")

# Build the CORS allowed origins list from environment or fall back to defaults
default_cors_origins = [
    "http://localhost:3004",
    "http://127.0.0.1:3004",
    "https://donor-app-dusky.vercel.app",
]
cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
cors_origins = (
    [origin.strip() for origin in cors_env.split(",") if origin.strip()]
    if cors_env
    else default_cors_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        """Adds basic security headers to every HTTP response."""
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Regex for validating organisation codes — uppercase letters, digits, and hyphens only
SAFE_CODE_RE = re.compile(r'^[A-Z0-9\-]{3,20}$')

# Magic byte signatures used to verify uploaded image file content matches declared type
MAGIC_BYTES = {
    "image/jpeg": b'\xff\xd8\xff',
    "image/png":  b'\x89PNG',
    "image/webp": b'RIFF',
}

# Allowed values for allergen tags and storage condition fields
ALLERGEN_OPTIONS = {"nuts", "dairy", "gluten", "eggs", "soy", "sesame", "shellfish", "no known allergens"}
STORAGE_OPTIONS = {"room_temp", "refrigerated", "frozen", "keep_dry"}


class ListingBase(BaseModel):
    foodType: str = Field(..., min_length=2, max_length=100)
    category: str = Field(default="Other", min_length=2, max_length=50)
    quantity: float = Field(..., gt=0, le=10000)
    unit: str = Field(default="portions", pattern=r"^(portions|boxes|kg|litres|items|meals)$")
    postcode: str = Field(..., pattern=r"^\d{4}$")
    orgCode: str = Field(..., min_length=1, max_length=20)
    dietary_tags: list[str] = Field(default_factory=list, max_length=10)
    description: Optional[str] = Field(default=None, max_length=500)
    photoUrl: Optional[str] = Field(default=None)
    sizeCue: Optional[str] = Field(default=None, max_length=100)
    expiryDate: Optional[date] = None
    allergenTags: list[str] = Field(default_factory=list)
    storageCondition: Optional[str] = Field(default=None, max_length=50)
    pickupWindow: Optional[str] = Field(default=None, max_length=100)

    @field_validator("dietary_tags")
    @classmethod
    def validate_tags(cls, tags):
        """Checks that each dietary tag is no longer than 50 characters."""
        for tag in tags:
            if len(tag) > 50:
                raise ValueError("Each dietary tag must be 50 characters or fewer")
        return tags

    @field_validator("allergenTags")
    @classmethod
    def validate_allergen_tags(cls, tags):
        """Checks that each allergen tag is one of the known allowed values."""
        for tag in tags:
            if tag.lower() not in ALLERGEN_OPTIONS:
                raise ValueError(f"Unknown allergen tag: {tag}")
        return tags

    @field_validator("storageCondition")
    @classmethod
    def validate_storage_condition(cls, value):
        """Checks that the storage condition is one of the allowed option values."""
        if value and value not in STORAGE_OPTIONS:
            raise ValueError(f"storageCondition must be one of: {', '.join(STORAGE_OPTIONS)}")
        return value

    @field_validator("category")
    @classmethod
    def normalize_category_field(cls, value):
        """Normalizes the category string to a standard display value."""
        return normalize_category(value)


class ListingCreate(ListingBase):
    expiryDate: date  # required for new listings
    allergenTags: list[str] = Field(..., min_length=1)
    storageCondition: str = Field(..., min_length=1)

    @field_validator("expiryDate")
    @classmethod
    def expiry_not_past(cls, value):
        """Rejects an expiry date that is already in the past."""
        if value < date.today():
            raise ValueError("expiryDate must not be in the past")
        return value


class ListingUpdate(ListingBase):
    expiryDate: date
    allergenTags: list[str] = Field(..., min_length=1)
    storageCondition: str = Field(..., min_length=1)

    @field_validator("expiryDate")
    @classmethod
    def expiry_not_past(cls, value):
        """Rejects an expiry date that is already in the past."""
        if value < date.today():
            raise ValueError("expiryDate must not be in the past")
        return value


class Listing(ListingBase):
    id: str
    createdAt: datetime
    status: str = "available"
    claimedBy: Optional[str] = None
    claimedAt: Optional[datetime] = None
    hasClaims: bool = False
    claimId: Optional[str] = None
    collectedAt: Optional[datetime] = None
    quantity: float = Field(..., ge=0, le=10000)  # 0 is valid for fully-claimed items


class ClaimRequest(BaseModel):
    orgId: str = Field(..., min_length=1, max_length=50)
    orgName: Optional[str] = Field(default=None, max_length=100)
    quantity: float = Field(..., gt=0, le=10000)


class UnclaimRequest(BaseModel):
    orgId: str = Field(..., min_length=1, max_length=50)


class PickupRequest(BaseModel):
    orgId: str = Field(..., min_length=1, max_length=50)


class MessageCreateRequest(BaseModel):
    senderOrgCode: str = Field(..., min_length=1, max_length=20)
    content: str = Field(..., min_length=1, max_length=2000)


class ImageRecognitionResult(BaseModel):
    name: str
    name_suggestions: list[str] = []
    quantity: Optional[float] = None
    dietary_tags: list[str] = []
    confidence: float
    raw_class: str
    dino_prompt: Optional[str] = None
    description: Optional[str] = None


class ListingDeleteResponse(BaseModel):
    success: bool
    listing_id: str


def normalize_category(value: Optional[str]) -> str:
    """Maps a raw category string to a standard display value. Returns 'Other' if not recognized."""
    raw = (value or "Other").strip()
    if not raw:
        return "Other"
    return CATEGORY_MAP.get(raw.lower(), 'Other')


def encode_description(description: Optional[str], size_cue: Optional[str]) -> Optional[str]:
    """Combines the user description and sizeCue into a single string for storage.
    Persists sizeCue inside description using a hidden marker so older schema
    deployments can round-trip the extra field without adding a dedicated column."""
    parts: list[str] = []
    if description and description.strip():
        parts.append(description.strip())
    if size_cue and size_cue.strip():
        parts.append(f"{SIZE_PREFIX}{size_cue.strip()}]")
    return "\n".join(parts) if parts else None


def decode_description(raw: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Splits a stored description back into the visible text and the hidden sizeCue marker.
    Reverse of encode_description — extracts the hidden size cue marker and returns the
    user-visible notes separately."""
    if not raw:
        return None, None
    size_cue = None
    visible_lines: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith(SIZE_PREFIX) and stripped.endswith("]"):
            size_cue = stripped[len(SIZE_PREFIX):-1].strip() or None
            continue
        if stripped:
            visible_lines.append(stripped)
    description = "\n".join(visible_lines) if visible_lines else None
    return description, size_cue


async def get_or_create_org(org_code: str) -> int:
    """Looks up an organization by its code and returns the org_id.
    If the organization does not exist yet, it is inserted and the new org_id is returned."""
    row = await database.fetch_one(
        "SELECT org_id FROM organization WHERE org_code = :org_code",
        {"org_code": org_code},
    )
    if row:
        return row["org_id"]

    result = await database.fetch_one(
        """
        INSERT INTO organization (org_name, org_code, org_type)
        VALUES (:org_name, :org_code, 'donor')
        RETURNING org_id
        """,
        {"org_name": org_code, "org_code": org_code},
    )
    return result["org_id"]


async def fetch_listing_row(listing_id: str):
    """Fetches a single food listing row by its ID, including owner and claimer org codes
    and a flag indicating whether any child claim rows exist."""
    return await database.fetch_one(
        """
        SELECT
            fl.*,
            COALESCE(fl.org_code, o.org_code) AS owner_org_code,
            co.org_code AS claimed_by_org_code,
            fl.source_listing_id,
            EXISTS (
                SELECT 1 FROM food_listing claimed_child
                WHERE claimed_child.source_listing_id = fl.listing_id
                  AND claimed_child.status = 'claimed'
            ) AS has_claims
        FROM food_listing fl
        LEFT JOIN organization o  ON fl.org_id = o.org_id
        LEFT JOIN organization co ON fl.claimed_by_org_id = co.org_id
        WHERE fl.listing_id = :listing_id
        """,
        {"listing_id": listing_id},
    )


async def ensure_owner(listing_id: str, org_code: str):
    """Checks that the given org_code is the owner of the listing.
    Raises 404 if listing not found, or 403 if the org does not own it."""
    row = await fetch_listing_row(listing_id)
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    if (row["owner_org_code"] or "") != org_code:
        raise HTTPException(status_code=403, detail="Only the original poster can modify this listing")
    return row


def row_to_listing(row) -> dict:
    """Converts a database row into a dictionary matching the API response shape.
    Handles DB-to-frontend naming, decodes the description field, and fills in
    compatibility fields used by both old and new clients."""
    tags_raw = row["dietary_tags"] or ""
    tags_list = [t.strip() for t in tags_raw.split(",") if t.strip()]
    description, size_cue = decode_description(row["description"])
    allergen_raw = row["allergen_tags"] if "allergen_tags" in row._mapping else None
    allergen_list = [t.strip() for t in (allergen_raw or "").split(",") if t.strip()]

    # API response adapter: convert DB naming to frontend naming and include
    # compatibility fields used by both old and new clients.
    return {
        "id": row["listing_id"],
        "foodType": row["title"] or row["food_category"] or "",
        "category": normalize_category(row["food_category"]),
        "quantity": float(row["quantity"]),
        "unit": row["unit"] or "portions",
        "postcode": row["postcode"] or "",
        "orgCode": row["owner_org_code"] or "",
        "dietary_tags": tags_list,
        "description": description,
        "photoUrl": row["photo_url"],
        "sizeCue": size_cue,
        "expiryDate": row["expiry_date"],
        "createdAt": row["created_at"],
        "status": row["status"],
        "claimedBy": row["claimed_by_org_code"],
        "claimedAt": row["claimed_at"],
        "hasClaims": bool(row["has_claims"]) if "has_claims" in row._mapping else False,
        "claimId": row["claim_id"] if "claim_id" in row._mapping else None,
        "collectedAt": row["picked_up_at"] if "picked_up_at" in row._mapping else None,
        "sourceListingId": row["source_listing_id"],
        "allergenTags": allergen_list,
        "storageCondition": row["storage_condition"] if "storage_condition" in row._mapping else None,
        "pickupWindow": row["pickup_window"] if "pickup_window" in row._mapping else None,
        "contactName": row["contact_name"] if "contact_name" in row._mapping else None,
        "pickupNotes": row["pickup_notes"] if "pickup_notes" in row._mapping else None,
        "pickedUpAt": row["picked_up_at"] if "picked_up_at" in row._mapping else None,
    }


def normalize_status_for_response(status: str) -> str:
    """Returns the normalized status string for API responses.
    Backward compatibility: old records may still contain 'picked_up'."""
    return "collected" if status == "picked_up" else status


async def create_claim_thread_if_missing(
    claim_id: str,
    listing_id: str,
    source_listing_id: Optional[str],
    donor_org_code: str,
    claiming_org_code: str,
    created_at: datetime,
):
    """Inserts a new claim thread row if one does not already exist for the given claim_id.
    Uses ON CONFLICT DO NOTHING so it is safe to call more than once."""
    await database.execute(
        """
        INSERT INTO claim_thread (
            claim_id, listing_id, source_listing_id, donor_org_code, claiming_org_code, created_at
        )
        VALUES (
            :claim_id, :listing_id, :source_listing_id, :donor_org_code, :claiming_org_code, :created_at
        )
        ON CONFLICT (claim_id) DO NOTHING
        """,
        {
            "claim_id": claim_id,
            "listing_id": listing_id,
            "source_listing_id": source_listing_id,
            "donor_org_code": donor_org_code,
            "claiming_org_code": claiming_org_code,
            "created_at": created_at,
        },
    )


async def close_claim_thread(claim_id: str, closed_at: datetime):
    """Marks a claim thread as closed and records the time it was closed."""
    await database.execute(
        """
        UPDATE claim_thread
        SET is_closed = TRUE, closed_at = :closed_at
        WHERE claim_id = :claim_id
        """,
        {"claim_id": claim_id, "closed_at": closed_at},
    )


async def fetch_claim_thread_or_404(claim_id: str):
    """Fetches a claim thread row by claim_id. Raises a 404 error if it does not exist."""
    row = await database.fetch_one(
        "SELECT * FROM claim_thread WHERE claim_id = :claim_id",
        {"claim_id": claim_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Claim thread not found")
    return row


def ensure_thread_member(thread_row, org_code: str):
    """Checks that the given org_code is either the donor or the claiming org for this thread.
    Raises 403 if the org is not part of the claim."""
    code = (org_code or "").strip()
    if code not in {thread_row["donor_org_code"], thread_row["claiming_org_code"]}:
        raise HTTPException(status_code=403, detail="Access denied for this claim thread")


def classify_sender(thread_row, sender_org_code: str) -> str:
    """Returns 'organisation' if the sender is the claiming org, or 'donor' if they are the donor.
    Raises 403 if the sender is neither party in the thread."""
    if sender_org_code == thread_row["claiming_org_code"]:
        return "organisation"
    if sender_org_code == thread_row["donor_org_code"]:
        return "donor"
    raise HTTPException(status_code=403, detail="Sender is not part of this claim thread")


@app.get("/health")
def health_check():
    """Returns a simple status response to confirm the service is running."""
    return {"status": "ok", "service": "listing-service", "db": "postgresql"}


@app.post("/listings", response_model=Listing)
@limiter.limit("10/minute")
async def create_listing(request: Request, listing: ListingCreate):
    """Creates a new food listing and saves it to the database. Returns the created listing."""
    listing_id = str(uuid.uuid4())
    org_id = await get_or_create_org(listing.orgCode)
    tags_str = ",".join(listing.dietary_tags)
    now = datetime.now()

    allergen_str = ",".join(listing.allergenTags)
    await database.execute(
        """
        INSERT INTO food_listing (
            listing_id, title, description, quantity, unit,
            food_category, dietary_tags, photo_url,
            postcode, org_code, status, created_at, org_id, expiry_date,
            allergen_tags, storage_condition, pickup_window
        ) VALUES (
            :listing_id, :title, :description, :quantity, :unit,
            :food_category, :dietary_tags, :photo_url,
            :postcode, :org_code, 'available', :created_at, :org_id, :expiry_date,
            :allergen_tags, :storage_condition, :pickup_window
        )
        """,
        {
            "listing_id": listing_id,
            "title": listing.foodType,
            "description": encode_description(listing.description, listing.sizeCue),
            "quantity": listing.quantity,
            "unit": listing.unit,
            "food_category": listing.category,
            "dietary_tags": tags_str,
            "photo_url": listing.photoUrl,
            "postcode": listing.postcode,
            "org_code": listing.orgCode,
            "created_at": now,
            "org_id": org_id,
            "expiry_date": listing.expiryDate,
            "allergen_tags": allergen_str,
            "storage_condition": listing.storageCondition,
            "pickup_window": listing.pickupWindow,
        },
    )

    row = await fetch_listing_row(listing_id)
    return row_to_listing(row)


@app.get("/listings", response_model=list[Listing])
@limiter.limit("30/minute")
async def get_listings(
    request: Request,
    postcode: Optional[str] = None,
    foodType: Optional[str] = None,
    category: Optional[str] = None,
    status: str = "available",
):
    """Returns a list of food listings filtered by status, postcode, food type, and category.
    Raises 400 if an invalid status value is provided."""
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="status must be one of: available, claimed, expired, collected")

    query = """
        SELECT
            fl.*,
            COALESCE(fl.org_code, o.org_code) AS owner_org_code,
            co.org_code AS claimed_by_org_code,
            fl.source_listing_id,
            EXISTS (
                SELECT 1 FROM food_listing claimed_child
                WHERE claimed_child.source_listing_id = fl.listing_id
                  AND claimed_child.status = 'claimed'
            ) AS has_claims
        FROM food_listing fl
        LEFT JOIN organization o  ON fl.org_id = o.org_id
        LEFT JOIN organization co ON fl.claimed_by_org_id = co.org_id
        WHERE 1=1
    """
    params: dict = {}

    if status == "collected" or status == "picked_up":
        query += " AND fl.status IN ('collected', 'picked_up')"
    else:
        query += " AND fl.status = :status"
        params["status"] = status

    if postcode:
        query += " AND fl.postcode = :postcode"
        params["postcode"] = postcode

    if foodType:
        query += " AND LOWER(fl.title) LIKE :food_type"
        params["food_type"] = f"%{foodType.lower()}%"

    if category:
        query += " AND LOWER(fl.food_category) = :category"
        params["category"] = normalize_category(category).lower()

    query += " ORDER BY fl.created_at DESC"
    rows = await database.fetch_all(query, params)
    data = [row_to_listing(r) for r in rows]
    for item in data:
        item["status"] = normalize_status_for_response(item["status"])
    return data


@app.get("/listings/{listing_id}", response_model=Listing)
@limiter.limit("30/minute")
async def get_listing(request: Request, listing_id: str):
    """Fetches a single listing by its ID. Raises 404 if the listing does not exist."""
    row = await fetch_listing_row(listing_id)
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    data = row_to_listing(row)
    data["status"] = normalize_status_for_response(data["status"])
    return data


@app.patch("/listings/{listing_id}", response_model=Listing)
@limiter.limit("10/minute")
async def update_listing(request: Request, listing_id: str, listing: ListingUpdate):
    """Updates an existing listing. Only the original poster can edit it, and it must
    not already be claimed or collected."""
    row = await ensure_owner(listing_id, listing.orgCode)
    normalized_status = normalize_status_for_response(str(row["status"] or ""))
    if normalized_status in {"claimed", "collected"} or bool(row["has_claims"]):
        raise HTTPException(
            status_code=400,
            detail="Listings that are already claimed or collected cannot be edited",
        )

    tags_str = ",".join(listing.dietary_tags)
    allergen_str = ",".join(listing.allergenTags)
    await database.execute(
        """
        UPDATE food_listing
        SET title = :title,
            description = :description,
            quantity = :quantity,
            unit = :unit,
            food_category = :food_category,
            dietary_tags = :dietary_tags,
            photo_url = :photo_url,
            postcode = :postcode,
            expiry_date = :expiry_date,
            allergen_tags = :allergen_tags,
            storage_condition = :storage_condition,
            pickup_window = :pickup_window
        WHERE listing_id = :listing_id
        """,
        {
            "listing_id": listing_id,
            "title": listing.foodType,
            "description": encode_description(listing.description, listing.sizeCue),
            "quantity": listing.quantity,
            "unit": listing.unit,
            "food_category": listing.category,
            "dietary_tags": tags_str,
            "photo_url": listing.photoUrl,
            "postcode": listing.postcode,
            "expiry_date": listing.expiryDate,
            "allergen_tags": allergen_str,
            "storage_condition": listing.storageCondition,
            "pickup_window": listing.pickupWindow,
        },
    )
    updated = await fetch_listing_row(listing_id)
    return row_to_listing(updated)


@app.delete("/listings/{listing_id}", response_model=ListingDeleteResponse)
@limiter.limit("10/minute")
async def delete_listing(request: Request, listing_id: str, orgCode: str):
    """Deletes a listing permanently. Only the original poster can delete it, and it must
    not already be claimed or collected."""
    row = await ensure_owner(listing_id, orgCode)
    normalized_status = normalize_status_for_response(str(row["status"] or ""))
    if normalized_status in {"claimed", "collected"} or bool(row["has_claims"]):
        raise HTTPException(
            status_code=400,
            detail="Listings that are already claimed or collected cannot be removed",
        )
    await database.execute(
        "DELETE FROM food_listing WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    return {"success": True, "listing_id": listing_id}


@app.post("/listings/{listing_id}/claim", response_model=dict)
@limiter.limit("5/minute")
async def claim_listing(request: Request, listing_id: str, claim: ClaimRequest):
    """Claims a food listing for a given organization. If the claimed quantity is less
    than the full available amount, a new child listing row is created for the claimed portion
    and the original listing quantity is reduced. Returns claim details including the claim_id."""
    row = await fetch_listing_row(listing_id)
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    if row["status"] != "available":
        raise HTTPException(status_code=400, detail=f"Listing is already {row['status']}")

    available_quantity = float(row["quantity"])
    claim_quantity = round(float(claim.quantity), 2)
    if claim_quantity <= 0:
        raise HTTPException(status_code=400, detail="Claim quantity must be greater than 0")
    if claim_quantity > available_quantity:
        raise HTTPException(status_code=400, detail="Claim quantity exceeds available quantity")

    claimer_org_id = await get_or_create_org(claim.orgId)
    claimed_at = datetime.now()
    claim_id = str(uuid.uuid4())

    if abs(claim_quantity - available_quantity) < 0.00001:
        # Full quantity claimed — update the existing listing in place
        await database.execute(
            """
            UPDATE food_listing
            SET status = 'claimed',
                claimed_by_org_id = :claimer_org_id,
                claimed_at = :claimed_at,
                claim_id = :claim_id
            WHERE listing_id = :listing_id
            """,
            {
                "claimer_org_id": claimer_org_id,
                "claimed_at": claimed_at,
                "claim_id": claim_id,
                "listing_id": listing_id,
            },
        )
        claimed_listing_id = listing_id
    else:
        # Partial claim — reduce the source listing and create a child row for the claimed portion
        remaining_quantity = round(available_quantity - claim_quantity, 2)
        claimed_listing_id = str(uuid.uuid4())

        async with database.transaction():
            await database.execute(
                "UPDATE food_listing SET quantity = :quantity WHERE listing_id = :listing_id",
                {"quantity": remaining_quantity, "listing_id": listing_id},
            )
            await database.execute(
                """
                INSERT INTO food_listing (
                    listing_id, title, description, quantity, unit,
                    food_category, dietary_tags, photo_url,
                    postcode, org_code, expiry_date, pickup_time,
                    status, created_at, claimed_at, org_id, claimed_by_org_id,
                    location_id, source_listing_id, allergen_tags, storage_condition, pickup_window, claim_id
                ) VALUES (
                    :listing_id, :title, :description, :quantity, :unit,
                    :food_category, :dietary_tags, :photo_url,
                    :postcode, :org_code, :expiry_date, :pickup_time,
                    'claimed', :created_at, :claimed_at, :org_id, :claimed_by_org_id,
                    :location_id, :source_listing_id, :allergen_tags, :storage_condition, :pickup_window, :claim_id
                )
                """,
                {
                    "listing_id": claimed_listing_id,
                    "title": row["title"],
                    "description": row["description"],
                    "quantity": claim_quantity,
                    "unit": row["unit"],
                    "food_category": row["food_category"],
                    "dietary_tags": row["dietary_tags"],
                    "photo_url": row["photo_url"],
                    "postcode": row["postcode"],
                    "org_code": row["owner_org_code"],
                    "expiry_date": row["expiry_date"],
                    "pickup_time": row["pickup_time"],
                    "created_at": row["created_at"],
                    "claimed_at": claimed_at,
                    "org_id": row["org_id"],
                    "claimed_by_org_id": claimer_org_id,
                    "location_id": row["location_id"],
                    "source_listing_id": listing_id,
                    "allergen_tags": row["allergen_tags"],
                    "storage_condition": row["storage_condition"],
                    "pickup_window": row["pickup_window"],
                    "claim_id": claim_id,
                },
            )

    await create_claim_thread_if_missing(
        claim_id=claim_id,
        listing_id=claimed_listing_id,
        source_listing_id=row["source_listing_id"] or listing_id,
        donor_org_code=row["owner_org_code"] or "",
        claiming_org_code=claim.orgId,
        created_at=claimed_at,
    )

    return {
        "success": True,
        "listing_id": claimed_listing_id,
        "claim_id": claim_id,
        "source_listing_id": row["source_listing_id"] or listing_id,
        "claimed_by": claim.orgId,
        "claimed_quantity": claim_quantity,
        "claimed_at": claimed_at,
    }


@app.patch("/listings/{listing_id}/unclaim", response_model=dict)
@limiter.limit("5/minute")
async def unclaim_listing(request: Request, listing_id: str, payload: UnclaimRequest):
    """Removes a claim from a listing. If the listing was a partial-claim child row, it is
    deleted and the quantity is restored to the source listing. Closes the associated claim thread."""
    row = await database.fetch_one(
        """
        SELECT
            fl.status,
            fl.quantity,
            fl.source_listing_id,
            fl.claim_id,
            co.org_code AS claimed_by_org_code
        FROM food_listing fl
        LEFT JOIN organization co ON fl.claimed_by_org_id = co.org_id
        WHERE fl.listing_id = :listing_id
        """,
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    if row["status"] != "claimed":
        raise HTTPException(status_code=400, detail="Listing is not currently claimed")
    if (row["claimed_by_org_code"] or "") != payload.orgId:
        raise HTTPException(status_code=403, detail="Only the claiming organization can remove this claim")

    source_listing_id = row["source_listing_id"]
    claim_id = row["claim_id"]

    if source_listing_id:
        async with database.transaction():
            source_row = await database.fetch_one(
                "SELECT listing_id, quantity FROM food_listing WHERE listing_id = :listing_id",
                {"listing_id": source_listing_id},
            )
            if source_row:
                # Restore quantity to the source listing and delete the child claim row
                restored_quantity = round(float(source_row["quantity"]) + float(row["quantity"]), 2)
                await database.execute(
                    "UPDATE food_listing SET quantity = :quantity WHERE listing_id = :listing_id",
                    {"quantity": restored_quantity, "listing_id": source_listing_id},
                )
                await database.execute(
                    "DELETE FROM food_listing WHERE listing_id = :listing_id",
                    {"listing_id": listing_id},
                )
            else:
                # Source listing is gone — just reset this row back to available
                await database.execute(
                    """
                    UPDATE food_listing
                    SET status = 'available',
                        claimed_by_org_id = NULL,
                        claimed_at = NULL,
                        claim_id = NULL,
                        source_listing_id = NULL
                    WHERE listing_id = :listing_id
                    """,
                    {"listing_id": listing_id},
                )
    else:
        # No source listing — reset this listing directly to available
        await database.execute(
            """
            UPDATE food_listing
            SET status = 'available',
                claimed_by_org_id = NULL,
                claimed_at = NULL,
                claim_id = NULL
            WHERE listing_id = :listing_id
            """,
            {"listing_id": listing_id},
        )

    if claim_id:
        await close_claim_thread(claim_id, datetime.now())

    return {"success": True, "listing_id": listing_id, "status": "available"}


@app.patch("/listings/{listing_id}/pickup")
@limiter.limit("10/minute")
async def pickup_listing(request: Request, listing_id: str, payload: PickupRequest):
    """Marks a claimed listing as collected. Only the claiming organisation can confirm pickup.
    Also closes the associated claim thread."""
    row = await database.fetch_one(
        """
        SELECT fl.status, fl.claim_id, co.org_code AS claimed_by_org_code
        FROM food_listing fl
        LEFT JOIN organization co ON fl.claimed_by_org_id = co.org_id
        WHERE fl.listing_id = :listing_id
        """,
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    if row["status"] != "claimed":
        raise HTTPException(status_code=400, detail="Only claimed listings can be marked as collected")
    if (row["claimed_by_org_code"] or "") != payload.orgId:
        raise HTTPException(status_code=403, detail="Only the claiming organisation can confirm pickup")

    picked_up_at = datetime.now()
    await database.execute(
        """
        UPDATE food_listing
        SET status = 'collected', picked_up_at = :picked_up_at
        WHERE listing_id = :listing_id
        """,
        {"listing_id": listing_id, "picked_up_at": picked_up_at},
    )
    if row["claim_id"]:
        await close_claim_thread(row["claim_id"], picked_up_at)
    return {
        "success": True,
        "listing_id": listing_id,
        "status": "collected",
        "collected_at": picked_up_at,
        "picked_up_at": picked_up_at,  # legacy compatibility
    }


@app.patch("/listings/{listing_id}/expire")
@limiter.limit("10/minute")
async def expire_listing(request: Request, listing_id: str):
    """Sets a listing status to expired. Raises 404 if the listing does not exist."""
    row = await database.fetch_one(
        "SELECT listing_id FROM food_listing WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")

    await database.execute(
        "UPDATE food_listing SET status = 'expired' WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    return {"success": True, "listing_id": listing_id, "status": "expired"}


@app.get("/claims/{claim_id}", response_model=dict)
@limiter.limit("30/minute")
async def get_claim_thread(request: Request, claim_id: str, orgCode: str):
    """Returns the details of a claim thread. The requesting org must be either the donor
    or the claiming organisation for this thread."""
    thread_row = await fetch_claim_thread_or_404(claim_id)
    ensure_thread_member(thread_row, orgCode)
    return {
        "claim_id": thread_row["claim_id"],
        "listing_id": thread_row["listing_id"],
        "source_listing_id": thread_row["source_listing_id"],
        "donor_org_code": thread_row["donor_org_code"],
        "claiming_org_code": thread_row["claiming_org_code"],
        "is_closed": bool(thread_row["is_closed"]),
        "created_at": thread_row["created_at"],
        "closed_at": thread_row["closed_at"],
    }


@app.get("/claims/{claim_id}/messages", response_model=list[dict])
@limiter.limit("30/minute")
async def list_claim_messages(request: Request, claim_id: str, orgCode: str):
    """Returns all messages in a claim thread in chronological order.
    The requesting org must be a member of the thread."""
    thread_row = await fetch_claim_thread_or_404(claim_id)
    ensure_thread_member(thread_row, orgCode)
    rows = await database.fetch_all(
        """
        SELECT message_id, claim_id, sender_type, sender_org_code, content, sent_at, read_at
        FROM claim_message
        WHERE claim_id = :claim_id
        ORDER BY sent_at ASC
        """,
        {"claim_id": claim_id},
    )
    return [dict(r) for r in rows]


@app.post("/claims/{claim_id}/messages", response_model=dict)
@limiter.limit("20/minute")
async def send_claim_message(request: Request, claim_id: str, payload: MessageCreateRequest):
    """Sends a message in a claim thread. Raises 400 if the thread is already closed,
    and 403 if the sender is not a member of the thread."""
    thread_row = await fetch_claim_thread_or_404(claim_id)
    sender_org_code = payload.senderOrgCode.strip()
    sender_type = classify_sender(thread_row, sender_org_code)
    if thread_row["is_closed"]:
        raise HTTPException(status_code=400, detail="Thread is closed")

    message_id = str(uuid.uuid4())
    sent_at = datetime.now()
    await database.execute(
        """
        INSERT INTO claim_message (message_id, claim_id, sender_type, sender_org_code, content, sent_at)
        VALUES (:message_id, :claim_id, :sender_type, :sender_org_code, :content, :sent_at)
        """,
        {
            "message_id": message_id,
            "claim_id": claim_id,
            "sender_type": sender_type,
            "sender_org_code": sender_org_code,
            "content": payload.content.strip(),
            "sent_at": sent_at,
        },
    )
    return {
        "message_id": message_id,
        "claim_id": claim_id,
        "sender_type": sender_type,
        "sender_org_code": sender_org_code,
        "content": payload.content.strip(),
        "sent_at": sent_at,
        "read_at": None,
    }


@app.patch("/claims/{claim_id}/messages/read", response_model=dict)
@limiter.limit("30/minute")
async def mark_claim_messages_read(request: Request, claim_id: str, orgCode: str):
    """Marks all unread messages in a thread as read for the requesting org.
    Only messages sent by the other party are marked — not the reader's own messages."""
    thread_row = await fetch_claim_thread_or_404(claim_id)
    reader_org_code = (orgCode or "").strip()
    ensure_thread_member(thread_row, reader_org_code)

    reader_sender_type = classify_sender(thread_row, reader_org_code)
    now = datetime.now()
    await database.execute(
        """
        UPDATE claim_message
        SET read_at = :read_at
        WHERE claim_id = :claim_id
          AND read_at IS NULL
          AND sender_type <> :reader_sender_type
        """,
        {"read_at": now, "claim_id": claim_id, "reader_sender_type": reader_sender_type},
    )
    return {"success": True, "claim_id": claim_id, "read_at": now}


@app.post("/image-recognition/recognize", response_model=ImageRecognitionResult)
@limiter.limit("5/minute")
async def recognize_food_from_image(request: Request, image: UploadFile = File(...)):
    """Runs the AI food recognition model on an uploaded image and returns a prediction.
    Raises 503 if the model is not loaded, 415 for unsupported file types, and 413 if the file is too large."""
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use JPEG, PNG, or WebP.")

    img_bytes = await image.read()
    if len(img_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    if recognizer is None:
        raise HTTPException(status_code=503, detail="Image recognition model is not available")
    result = recognizer.predict(img_bytes)
    return ImageRecognitionResult(
        name=result["name"],
        name_suggestions=result["name_suggestions"],
        quantity=result["quantity"],
        dietary_tags=result["tags"],
        confidence=result["confidence"],
        raw_class=result["raw_class"],
        dino_prompt=result.get("dino_prompt"),
    )


@app.post("/upload")
@limiter.limit("5/minute")
async def upload_food_image(request: Request, image: UploadFile = File(...)):
    """Saves an uploaded food image to disk and returns the static URL path.
    Validates file type via MIME type and magic bytes, and enforces a 5 MB size limit."""
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use JPEG, PNG, or WebP.")

    contents = await image.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    expected_magic = MAGIC_BYTES.get(image.content_type, b'')
    if expected_magic and not contents[:4].startswith(expected_magic):
        raise HTTPException(status_code=415, detail="File content does not match declared type")

    # Generate a unique filename and write the image to the uploads directory
    ext = EXT_MAP[image.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/static/{filename}"}


class RegisterRequest(BaseModel):
    orgType:             str           = Field(..., pattern=r"^(donor|community_org)$")
    orgCode:             str           = Field(..., min_length=3, max_length=20, pattern=r"^[A-Z0-9-]+$")
    orgName:             str           = Field(..., min_length=1, max_length=255)
    businessAddress:     Optional[str] = Field(default=None, max_length=500)
    preferredLocation:   Optional[str] = Field(default=None, max_length=500)
    maxPickupDistanceKm: Optional[int] = Field(default=None, ge=1, le=500)

    @field_validator("orgName")
    @classmethod
    def clean_org_name(cls, v):
        """Strips whitespace from the org name and rejects blank values."""
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Organisation name cannot be blank")
        return cleaned

    @field_validator("orgCode")
    @classmethod
    def code_matches_type(cls, v, info):
        """Checks that the org code prefix matches the org type — DNR- for donors, CBO- for community orgs."""
        org_type = info.data.get("orgType")
        if org_type == "donor" and not v.startswith("DNR-"):
            raise ValueError("Donor codes must begin with DNR-")
        if org_type == "community_org" and not v.startswith("CBO-"):
            raise ValueError("Organisation codes must begin with CBO-")
        return v


@app.get("/check-code")
@limiter.limit("10/minute")
async def check_code_availability(request: Request, code: str):
    """Checks if an organisation code is available for registration.
    Returns available: true if no existing org uses that code."""
    if not SAFE_CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Invalid code format")
    row = await database.fetch_one(
        "SELECT org_id FROM organization WHERE UPPER(org_code) = UPPER(:code)",
        {"code": code},
    )
    return {"available": row is None}


@app.post("/register", status_code=201)
async def register_identity(request: Request, body: RegisterRequest):
    """Registers a new organisation or updates an existing one if the code already exists.
    Returns the org code and type on success, or raises 500 if the database insert fails."""
    try:
        result = await database.fetch_one(
            """
            INSERT INTO organization (
                org_name, org_code, org_type,
                business_address, preferred_location, max_pickup_distance_km
            )
            VALUES (
                :org_name, :org_code, :org_type,
                :business_address, :preferred_location, :max_pickup_distance_km
            )
            ON CONFLICT (org_code) DO UPDATE SET
                org_name               = EXCLUDED.org_name,
                business_address       = COALESCE(EXCLUDED.business_address,       organization.business_address),
                preferred_location     = COALESCE(EXCLUDED.preferred_location,     organization.preferred_location),
                max_pickup_distance_km = COALESCE(EXCLUDED.max_pickup_distance_km, organization.max_pickup_distance_km)
            RETURNING org_code, org_type
            """,
            {
                "org_name":               body.orgName,
                "org_code":               body.orgCode,
                "org_type":               body.orgType,
                "business_address":       body.businessAddress,
                "preferred_location":     body.preferredLocation,
                "max_pickup_distance_km": body.maxPickupDistanceKm,
            },
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")
    return {"orgCode": result["org_code"], "orgType": result["org_type"]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
