"""
Listing Service — FastAPI backend for CrisisLink
Backed by PostgreSQL (crisislink_db) via the `databases` async library.
"""

# ── Path setup for Layer4-AI imports ──────────────────────────────────────────
import sys
import os
import shutil
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Layer4-AI/image_recognition/food_photo_recognition")))
from recognizer import get_recognizer

# ── Standard + third-party imports ────────────────────────────────────────────
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import databases
from dotenv import load_dotenv

# ── Load .env (DATABASE_URL, HOST, PORT) ──────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env")

# databases wraps asyncpg and gives us await database.execute() / fetch_all()
database = databases.Database(DATABASE_URL)

# ── ML model (loaded once at startup) ─────────────────────────────────────────
recognizer = None


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
app = FastAPI(
    title="CrisisLink Listing Service",
    description="API for creating and managing food listings",
    version="0.2.0",
    lifespan=lifespan,
)

# Serve uploaded food images at /static/<filename>
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ListingCreate(BaseModel):
    """Fields the frontend submits when posting a listing."""
    foodType: str
    quantity: float
    unit: str = "portions"
    postcode: str
    orgCode: str
    category: Optional[str] = None
    sizeCue: Optional[str] = None
    dietary_tags: list[str] = []
    description: Optional[str] = None
    photoUrl: Optional[str] = None


class Listing(ListingCreate):
    """Full listing returned by the API (input fields + server-generated fields)."""
    id: str
    createdAt: datetime
    status: str = "available"   # available | claimed | expired
    claimedBy: Optional[str] = None
    claimedAt: Optional[datetime] = None


class ClaimRequest(BaseModel):
    """Body for POST /listings/{id}/claim"""
    orgId: str
    orgName: Optional[str] = None


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

    description_raw = row["description"] or ""
    size_cue = None
    description_value = description_raw
    if description_raw.startswith("[sizeCue:"):
        prefix_end = description_raw.find("]")
        if prefix_end != -1:
            size_cue = description_raw[len("[sizeCue:"):prefix_end]
            description_value = description_raw[prefix_end + 1 :].strip() or None

    return {
        "id":           row["listing_id"],
        "foodType":     row["title"] or row["food_category"] or "",
        "quantity":     float(row["quantity"]),
        "unit":         row["unit"] or "portions",
        "postcode":     row["postcode"] or "",
        "orgCode":      row["org_code"] or "",
        "category":     row["food_category"] or "Other",
        "sizeCue":      size_cue,
        "dietary_tags": tags_list,
        "description":  description_value,
        "photoUrl":     row["photo_url"],
        "createdAt":    row["created_at"],
        "status":       row["status"],
        "claimedBy":    row["claimed_by_org_code"],   # from LEFT JOIN
        "claimedAt":    row["claimed_at"],
    }


def normalize_category(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    lower = value.strip().lower()
    mapping = {
        "bakedgoods": "bakedGoods",
        "baked goods": "bakedGoods",
        "bakery & grains": "bakedGoods",
        "bakery": "bakedGoods",
        "produce": "produce",
        "fresh produce": "produce",
        "dairy": "dairy",
        "dairy & eggs": "dairy",
        "pantry": "pantry",
        "canned goods": "pantry",
        "preparedmeals": "preparedMeals",
        "prepared meals": "preparedMeals",
        "prepared": "preparedMeals",
        "other": "other",
    }
    return mapping.get(lower, value)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "listing-service", "db": "postgresql"}


@app.post("/listings", response_model=Listing)
async def create_listing(listing: ListingCreate):
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
    now = datetime.now()

    description_value = listing.description or ""
    if listing.sizeCue:
        description_value = f"[sizeCue:{listing.sizeCue}] {description_value}".strip()

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
            "description":  description_value or None,
            "quantity":     listing.quantity,
            "unit":         listing.unit,
            "food_category": normalize_category(listing.category) or listing.foodType,
            "dietary_tags": tags_str,
            "photo_url":    listing.photoUrl,
            "postcode":     listing.postcode,
            "org_code":     listing.orgCode,
            "created_at":   now,
            "org_id":       org_id,
        },
    )

    return {
        "id":           listing_id,
        **listing.model_dump(),
        "createdAt":    now,
        "status":       "available",
        "claimedBy":    None,
        "claimedAt":    None,
    }


@app.get("/listings", response_model=list[Listing])
async def get_listings(
    postcode: Optional[str] = None,
    foodType: Optional[str] = None,
    status: str = "available",
    claimedBy: Optional[str] = None,
):
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

    if claimedBy:
        query += " AND co.org_code = :claimed_by_org_code"
        params["claimed_by_org_code"] = claimedBy

    query += " ORDER BY fl.created_at DESC"

    rows = await database.fetch_all(query, params)
    return [row_to_listing(r) for r in rows]


@app.get("/listings/{listing_id}", response_model=Listing)
async def get_listing(listing_id: str):
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
async def claim_listing(listing_id: str, claim: ClaimRequest):
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
async def expire_listing(listing_id: str):
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
async def recognize_food_from_image(image: UploadFile = File(...)):
    """
    Run the uploaded image through ConvNeXt (classification) +
    Grounding DINO (quantity counting) and return autofill data.
    """
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")

    img_bytes = await image.read()
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
async def upload_food_image(image: UploadFile = File(...)):
    """
    Save an uploaded food image to disk and return a permanent URL.
    The URL is stored in food_listing.photo_url so it can be displayed
    in the feed and on listing detail pages.
    """
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")

    # Build a unique filename preserving the original extension
    ext = os.path.splitext(image.filename or "food")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    # Stream-save to disk
    with open(filepath, "wb") as f:
        shutil.copyfileobj(image.file, f)

    return {"url": f"/static/{filename}"}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
