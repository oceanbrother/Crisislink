"""
Listing Service — FastAPI backend for CrisisLink
Backed by PostgreSQL (crisislink_db) via the ⁠ databases ⁠ async library.
"""

# ── Path setup for Layer4-AI imports ──────────────────────────────────────────
import sys
import os
import shutil
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Layer4-AI/image_recognition/food_photo_recognition")))
from recognizer import get_recognizer

# ── Standard + third-party imports ────────────────────────────────────────────
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, timezone
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uuid
import re
import io
import databases
from dotenv import load_dotenv
from PIL import Image

# ── Load .env (DATABASE_URL, HOST, PORT) ──────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env")

# databases wraps asyncpg and gives us await database.execute() / fetch_all()
database = databases.Database(DATABASE_URL)

limiter = Limiter(key_func=get_remote_address)

# ── ML model (loaded once at startup) ─────────────────────────────────────────
recognizer = None

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB
EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
CORS_ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "https://donor-app-dusky.vercel.app").split(",")
    if origin.strip()
]


def utcnow_naive() -> datetime:
    """Store UTC timestamps as naive datetimes for DB columns without timezone."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def build_public_url(request: Request, path: str) -> str:
    """Return absolute URL for uploaded assets in cloud/local deployments."""
    if BACKEND_PUBLIC_URL:
        return f"{BACKEND_PUBLIC_URL}{path}"
    return f"{str(request.base_url).rstrip('/')}{path}"


# ── Lifespan: startup + shutdown ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    global recognizer

    # Connect to PostgreSQL
    await database.connect()
    print("✓ PostgreSQL connected")

    # Load ML model
    print("Starting food recognizer...")
    recognizer = get_recognizer()
    print("✓ Model ready")

    yield  # server is running

    # ── Shutdown ──
    await database.disconnect()
    print("PostgreSQL disconnected")


# ── App ───────────────────────────────────────────────────────────────────────
_is_prod = os.getenv("ENVIRONMENT", "production").lower() == "production"
app = FastAPI(
    title="CrisisLink Listing Service",
    description="API for creating and managing food listings",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Serve uploaded food images at /static/<filename>
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ListingCreate(BaseModel):
    """Fields the frontend submits when posting a listing."""
    foodType:     str            = Field(..., min_length=2, max_length=100)
    quantity:     float          = Field(..., gt=0, le=10000)
    unit:         str            = Field(default="portions", pattern=r"^(portions|boxes|kg|litres|items)$")
    postcode:     str            = Field(..., pattern=r"^\d{4}$")
    orgCode:      str            = Field(..., min_length=3, max_length=20)
    dietary_tags: list[str]      = Field(default=[], max_length=10)
    description:  Optional[str]  = Field(default=None, max_length=500)
    photoUrl:     Optional[str]  = Field(default=None)

    @field_validator("dietary_tags")
    @classmethod
    def validate_tags(cls, tags):
        for tag in tags:
            if len(tag) > 50:
                raise ValueError("Each dietary tag must be 50 characters or fewer")
        return tags

    @field_validator("description")
    @classmethod
    def strip_html(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"<[^>]+>", "", v)
        if re.search(r"javascript:", cleaned, re.IGNORECASE):
            raise ValueError("Description contains disallowed content")
        return cleaned.strip()

    @field_validator("photoUrl")
    @classmethod
    def validate_photo_url(cls, v):
        if v is None:
            return v
        allowed_prefix = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
        if v.startswith("/static/"):
            return v
        if allowed_prefix and v.startswith(f"{allowed_prefix}/static/"):
            return v
        raise ValueError("photoUrl must point to this service's /static/ path")



class Listing(ListingCreate):
    """Full listing returned by the API (input fields + server-generated fields)."""
    id: str
    createdAt: datetime
    status: str = "available"   # available | claimed | expired
    claimedBy: Optional[str] = None
    claimedAt: Optional[datetime] = None


class ClaimRequest(BaseModel):
    """Body for POST /listings/{id}/claim"""
    orgId:   str           = Field(..., min_length=1, max_length=50)
    orgName: Optional[str] = Field(default=None, max_length=100)


class ImageRecognitionResult(BaseModel):
    """Shape of the AI autofill response."""
    name: str
    name_suggestions: list[str] = []
    quantity: Optional[float] = None
    dietary_tags: list[str] = []
    confidence: float
    raw_class: str
    dino_prompt: Optional[str] = None
    description: Optional[str] = None


# ── DB helpers ────────────────────────────────────────────────────────────────

async def get_or_create_org(org_code: str) -> int:
    """
    Lookup an organisation by its short code. If it doesn't exist yet,
    insert a minimal record and return the new org_id.

    """
    row = await database.fetch_one(
        "SELECT org_id FROM organization WHERE org_code = :org_code",
        {"org_code": org_code},
    )
    if row:
        return row["org_id"]

    # Minimal insert — org_name defaults to the code until staff fills it in
    result = await database.fetch_one(
        """
        INSERT INTO organization (org_name, org_code, org_type)
        VALUES (:org_name, :org_code, 'donor')
        RETURNING org_id
        """,
        {"org_name": org_code, "org_code": org_code},
    )
    return result["org_id"]


def row_to_listing(row) -> dict:
    """
    Convert a DB row (asyncpg Record) -> dict matching the Listing model.

    The DB uses snake_case column names; the API contract (and frontend)
    uses camelCase field names — this function maps between them.
    dietary_tags is stored in the DB as a comma-separated string
    (e.g. "non-vegetarian,vegan"). We split it back into a list here.
    """
    tags_raw = row["dietary_tags"] or ""
    tags_list = [t.strip() for t in tags_raw.split(",") if t.strip()]

    created_at = row["created_at"]
    claimed_at = row["claimed_at"]
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if claimed_at and claimed_at.tzinfo is None:
        claimed_at = claimed_at.replace(tzinfo=timezone.utc)

    return {
        "id":           row["listing_id"],
        "foodType":     row["food_category"] or "",
        "quantity":     float(row["quantity"]),
        "unit":         row["unit"] or "portions",
        "postcode":     row["postcode"] or "",
        "orgCode":      row["org_code"] or "",
        "dietary_tags": tags_list,
        "description":  row["description"],
        "photoUrl":     row["photo_url"],
        "createdAt":    row["created_at"],
        "status":       row["status"],
        "claimedBy":    row["claimed_by_org_code"],   # from LEFT JOIN
        "claimedAt":    row["claimed_at"],
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "listing-service",
        "db": "postgresql",
        "ai_ready": recognizer is not None,
    }


@app.post("/listings", response_model=Listing)
@limiter.limit("10/minute")
async def create_listing(request: Request, listing: ListingCreate):
    """
    Create a new food listing and persist it to PostgreSQL.

    Flow:
      1. Generate a UUID for the listing.
      2. Resolve (or auto-create) the org by its org_code -> org_id.
      3. INSERT into food_listing.
      4. Return the created listing.

    dietary_tags (a list) is stored as a comma-separated string in the DB.
    """
    listing_id = str(uuid.uuid4())
    org_id = await get_or_create_org(listing.orgCode)
    tags_str = ",".join(listing.dietary_tags)
    now_db = utcnow_naive()

    await database.execute(
        """
        INSERT INTO food_listing (
            listing_id, title, description, quantity, unit,
            food_category, dietary_tags, photo_url,
            postcode, org_code, status, created_at, org_id
        ) VALUES (
            :listing_id, :title, :description, :quantity, :unit,
            :food_category, :dietary_tags, :photo_url,
            :postcode, :org_code, 'available', :created_at, :org_id
        )
        """,
        {
            "listing_id":   listing_id,
            "title":        listing.foodType,
            "description":  listing.description,
            "quantity":     listing.quantity,
            "unit":         listing.unit,
            "food_category": listing.foodType,
            "dietary_tags": tags_str,
            "photo_url":    listing.photoUrl,
            "postcode":     listing.postcode,
            "org_code":     listing.orgCode,
            "created_at":   now_db,
            "org_id":       org_id,
        },
    )

    return {
        "id":           listing_id,
        **listing.model_dump(),
        "createdAt":    now_db.replace(tzinfo=timezone.utc),
        "status":       "available",
        "claimedBy":    None,
        "claimedAt":    None,
    }

ALLOWED_STATUSES = {"available", "claimed", "expired"}

@app.patch("/listings/{listing_id}", response_model=Listing)
@limiter.limit("10/minute")
async def update_listing(request: Request, listing_id: str, listing: ListingCreate):
    """Update an existing available listing in place."""
    row = await database.fetch_one(
        "SELECT status FROM food_listing WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    if row["status"] != "available":
        raise HTTPException(status_code=400, detail="Only available listings can be edited")

    org_id = await get_or_create_org(listing.orgCode)
    tags_str = ",".join(listing.dietary_tags)

    await database.execute(
        """
        UPDATE food_listing
        SET
            title = :title,
            description = :description,
            quantity = :quantity,
            unit = :unit,
            food_category = :food_category,
            dietary_tags = :dietary_tags,
            photo_url = :photo_url,
            postcode = :postcode,
            org_code = :org_code,
            org_id = :org_id
        WHERE listing_id = :listing_id
        """,
        {
            "listing_id": listing_id,
            "title": listing.foodType,
            "description": listing.description,
            "quantity": listing.quantity,
            "unit": listing.unit,
            "food_category": listing.foodType,
            "dietary_tags": tags_str,
            "photo_url": listing.photoUrl,
            "postcode": listing.postcode,
            "org_code": listing.orgCode,
            "org_id": org_id,
        },
    )

    updated = await database.fetch_one(
        """
        SELECT
            fl.*,
            o.org_code,
            co.org_code AS claimed_by_org_code
        FROM food_listing fl
        LEFT JOIN organization o  ON fl.org_id            = o.org_id
        LEFT JOIN organization co ON fl.claimed_by_org_id = co.org_id
        WHERE fl.listing_id = :listing_id
        """,
        {"listing_id": listing_id},
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Listing not found after update")
    return row_to_listing(updated)

ALLOWED_STATUSES = {"available", "claimed", "expired"}

@app.get("/listings", response_model=list[Listing])
@limiter.limit("30/minute")
async def get_listings(
    request: Request,
    postcode: Optional[str] = None,
    foodType: Optional[str] = None,
    status: str = "available",
):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of: available, claimed, expired")
    """
    Fetch listings from PostgreSQL with optional filters.

    The LEFT JOIN on organization (twice) lets us return:
      - orgCode  -> who posted the listing  (joined as 'o')
      - claimedBy -> who claimed it          (joined as 'co')
    """
    query = """
        SELECT
            fl.*,
            o.org_code,
            co.org_code AS claimed_by_org_code
        FROM food_listing fl
        LEFT JOIN organization o  ON fl.org_id            = o.org_id
        LEFT JOIN organization co ON fl.claimed_by_org_id = co.org_id
        WHERE fl.status = :status
    """
    params: dict = {"status": status}

    if postcode:
        query += " AND fl.postcode = :postcode"
        params["postcode"] = postcode

    if foodType:
        query += " AND LOWER(fl.food_category) LIKE :food_type"
        params["food_type"] = f"%{foodType.lower()}%"

    query += " ORDER BY fl.created_at DESC"

    rows = await database.fetch_all(query, params)
    return [row_to_listing(r) for r in rows]


@app.get("/listings/{listing_id}", response_model=Listing)
@limiter.limit("30/minute")
async def get_listing(request: Request, listing_id: str):
    """Get a single listing by its UUID."""
    row = await database.fetch_one(
        """
        SELECT
            fl.*,
            o.org_code,
            co.org_code AS claimed_by_org_code
        FROM food_listing fl
        LEFT JOIN organization o  ON fl.org_id            = o.org_id
        LEFT JOIN organization co ON fl.claimed_by_org_id = co.org_id
        WHERE fl.listing_id = :listing_id
        """,
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    return row_to_listing(row)


@app.post("/listings/{listing_id}/claim", response_model=dict)
@limiter.limit("5/minute")
async def claim_listing(request: Request, listing_id: str, claim: ClaimRequest):
    """
    Claim a listing — marks it taken and records which org claimed it.

    Flow:
      1. Check the listing exists and is still 'available'.
      2. Resolve (or create) the claiming org -> claimed_by_org_id.
      3. UPDATE the row: status='claimed', claimed_by_org_id, claimed_at.
    """
    row = await database.fetch_one(
        "SELECT status FROM food_listing WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    if row["status"] != "available":
        raise HTTPException(
            status_code=400,
            detail=f"Listing is already {row['status']}",
        )

    claimer_org_id = await get_or_create_org(claim.orgId)
    claimed_at = datetime.now()

    await database.execute(
        """
        UPDATE food_listing
        SET status = 'claimed',
            claimed_by_org_id = :claimer_org_id,
            claimed_at = :claimed_at
        WHERE listing_id = :listing_id
        """,
        {
            "claimer_org_id": claimer_org_id,
            "claimed_at":     claimed_at,
            "listing_id":     listing_id,
        },
    )

    return {
        "success":    True,
        "listing_id": listing_id,
        "claimed_by": claim.orgId,
        "claimed_at": claimed_at,
    }


@app.patch("/listings/{listing_id}/expire")
@limiter.limit("10/minute")
async def expire_listing(request: Request, listing_id: str):
    """Mark a listing as expired."""
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


# ── Image Recognition ─────────────────────────────────────────────────────────

@app.post("/image-recognition/recognize", response_model=ImageRecognitionResult)
@limiter.limit("5/minute")
async def recognize_food_from_image(request: Request, image: UploadFile = File(...)):
    """
    Run the uploaded image through ConvNeXt (classification) +
    Grounding DINO (quantity counting) and return autofill data.
    """
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")

    if recognizer is None:
        raise HTTPException(status_code=503, detail="AI recognizer not available")

    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use JPEG, PNG, or WebP.")

    img_bytes = await image.read()
    if len(img_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    result = recognizer.predict(img_bytes)

    return ImageRecognitionResult(
        name=result["name"],
        name_suggestions=result["name_suggestions"],
        quantity=result["quantity"],
        dietary_tags=result["tags"],
        confidence=result["confidence"],
        raw_class=result["raw_class"],
        dino_prompt=result["dino_prompt"],
    )


# ── Image Upload ──────────────────────────────────────────────────────────────

@app.post("/upload")
@limiter.limit("5/minute")
async def upload_food_image(request: Request, image: UploadFile = File(...)):
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")

    # 1. Check MIME type
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use JPEG, PNG, or WebP.")

    # 2. Read and size-check
    contents = await image.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    # 3. Validate the bytes are actually a valid image (not just a spoofed MIME type)
    try:
        Image.open(io.BytesIO(contents)).verify()
    except Exception:
        raise HTTPException(status_code=415, detail="File content is not a valid image.")

    # 4. Derive extension from MIME type, not from client filename
    ext = EXT_MAP[image.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/static/{filename}"}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
