"""
Listing Service — FastAPI backend for outbackshare
Backed by PostgreSQL (outbackshare_db) via the `databases` async library.
"""

import os
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

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Layer4-AI/image_recognition/food_photo_recognition")))
from recognizer import get_recognizer

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env")

database = databases.Database(DATABASE_URL)
limiter = Limiter(key_func=get_remote_address)
recognizer = None

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024
EXT_MAP = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
ALLOWED_STATUSES = {"available", "claimed", "expired"}
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
    await database.execute("ALTER TABLE food_listing ADD COLUMN IF NOT EXISTS source_listing_id VARCHAR(36)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global recognizer
    await database.connect()
    await ensure_schema_extensions()
    print("✓ PostgreSQL connected")
    print("Starting food recognizer...")
    recognizer = get_recognizer()
    print("✓ Model ready")
    yield
    await database.disconnect()
    print("PostgreSQL disconnected")


app = FastAPI(
    title="CrisisLink Listing Service",
    description="API for creating and managing food listings",
    version="0.3.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3004",
        "http://127.0.0.1:3004",
        "https://donor-app-dusky.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


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

    @field_validator("dietary_tags")
    @classmethod
    def validate_tags(cls, tags):
        for tag in tags:
            if len(tag) > 50:
                raise ValueError("Each dietary tag must be 50 characters or fewer")
        return tags

    @field_validator("category")
    @classmethod
    def normalize_category_field(cls, value):
        return normalize_category(value)


class ListingCreate(ListingBase):
    pass


class ListingUpdate(ListingBase):
    pass


class Listing(ListingBase):
    id: str
    createdAt: datetime
    status: str = "available"
    claimedBy: Optional[str] = None
    claimedAt: Optional[datetime] = None
    hasClaims: bool = False
    quantity: float = Field(..., ge=0, le=10000)  # 0 is valid for fully-claimed items


class ClaimRequest(BaseModel):
    orgId: str = Field(..., min_length=1, max_length=50)
    orgName: Optional[str] = Field(default=None, max_length=100)
    quantity: float = Field(..., gt=0, le=10000)


class UnclaimRequest(BaseModel):
    orgId: str = Field(..., min_length=1, max_length=50)


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
    raw = (value or "Other").strip()
    if not raw:
        return "Other"
    return CATEGORY_MAP.get(raw.lower(), 'Other')


def encode_description(description: Optional[str], size_cue: Optional[str]) -> Optional[str]:
    parts: list[str] = []
    if description and description.strip():
        parts.append(description.strip())
    if size_cue and size_cue.strip():
        parts.append(f"{SIZE_PREFIX}{size_cue.strip()}]")
    return "\n".join(parts) if parts else None


def decode_description(raw: Optional[str]) -> tuple[Optional[str], Optional[str]]:
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
    row = await fetch_listing_row(listing_id)
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    if (row["owner_org_code"] or "") != org_code:
        raise HTTPException(status_code=403, detail="Only the original poster can modify this listing")
    return row


def row_to_listing(row) -> dict:
    tags_raw = row["dietary_tags"] or ""
    tags_list = [t.strip() for t in tags_raw.split(",") if t.strip()]
    description, size_cue = decode_description(row["description"])

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
        "sourceListingId": row["source_listing_id"],
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "listing-service", "db": "postgresql"}


@app.post("/listings", response_model=Listing)
@limiter.limit("10/minute")
async def create_listing(request: Request, listing: ListingCreate):
    listing_id = str(uuid.uuid4())
    org_id = await get_or_create_org(listing.orgCode)
    tags_str = ",".join(listing.dietary_tags)
    now = datetime.now()

    await database.execute(
        """
        INSERT INTO food_listing (
            listing_id, title, description, quantity, unit,
            food_category, dietary_tags, photo_url,
            postcode, org_code, status, created_at, org_id, expiry_date
        ) VALUES (
            :listing_id, :title, :description, :quantity, :unit,
            :food_category, :dietary_tags, :photo_url,
            :postcode, :org_code, 'available', :created_at, :org_id, :expiry_date
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
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="status must be one of: available, claimed, expired")

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
        WHERE fl.status = :status
    """
    params: dict = {"status": status}

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
    return [row_to_listing(r) for r in rows]


@app.get("/listings/{listing_id}", response_model=Listing)
@limiter.limit("30/minute")
async def get_listing(request: Request, listing_id: str):
    row = await fetch_listing_row(listing_id)
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    return row_to_listing(row)


@app.patch("/listings/{listing_id}", response_model=Listing)
@limiter.limit("10/minute")
async def update_listing(request: Request, listing_id: str, listing: ListingUpdate):
    row = await ensure_owner(listing_id, listing.orgCode)
    if row["status"] == "claimed" or bool(row["has_claims"]):
        raise HTTPException(status_code=400, detail="Listings that have already been claimed cannot be edited")

    tags_str = ",".join(listing.dietary_tags)
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
            expiry_date = :expiry_date
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
        },
    )
    updated = await fetch_listing_row(listing_id)
    return row_to_listing(updated)


@app.delete("/listings/{listing_id}", response_model=ListingDeleteResponse)
@limiter.limit("10/minute")
async def delete_listing(request: Request, listing_id: str, orgCode: str):
    row = await ensure_owner(listing_id, orgCode)
    if row["status"] == "claimed" or bool(row["has_claims"]):
        raise HTTPException(status_code=400, detail="Listings that have already been claimed cannot be removed")
    await database.execute(
        "DELETE FROM food_listing WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    return {"success": True, "listing_id": listing_id}


@app.post("/listings/{listing_id}/claim", response_model=dict)
@limiter.limit("5/minute")
async def claim_listing(request: Request, listing_id: str, claim: ClaimRequest):
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

    if abs(claim_quantity - available_quantity) < 0.00001:
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
                "claimed_at": claimed_at,
                "listing_id": listing_id,
            },
        )
        claimed_listing_id = listing_id
    else:
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
                    location_id, source_listing_id
                ) VALUES (
                    :listing_id, :title, :description, :quantity, :unit,
                    :food_category, :dietary_tags, :photo_url,
                    :postcode, :org_code, :expiry_date, :pickup_time,
                    'claimed', :created_at, :claimed_at, :org_id, :claimed_by_org_id,
                    :location_id, :source_listing_id
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
                },
            )

    return {
        "success": True,
        "listing_id": claimed_listing_id,
        "source_listing_id": row["source_listing_id"] or listing_id,
        "claimed_by": claim.orgId,
        "claimed_quantity": claim_quantity,
        "claimed_at": claimed_at,
    }


@app.patch("/listings/{listing_id}/unclaim", response_model=dict)
@limiter.limit("5/minute")
async def unclaim_listing(request: Request, listing_id: str, payload: UnclaimRequest):
    row = await database.fetch_one(
        """
        SELECT
            fl.status,
            fl.quantity,
            fl.source_listing_id,
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

    if source_listing_id:
        async with database.transaction():
            source_row = await database.fetch_one(
                "SELECT listing_id, quantity FROM food_listing WHERE listing_id = :listing_id",
                {"listing_id": source_listing_id},
            )
            if source_row:
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
                await database.execute(
                    """
                    UPDATE food_listing
                    SET status = 'available',
                        claimed_by_org_id = NULL,
                        claimed_at = NULL,
                        source_listing_id = NULL
                    WHERE listing_id = :listing_id
                    """,
                    {"listing_id": listing_id},
                )
    else:
        await database.execute(
            """
            UPDATE food_listing
            SET status = 'available',
                claimed_by_org_id = NULL,
                claimed_at = NULL
            WHERE listing_id = :listing_id
            """,
            {"listing_id": listing_id},
        )

    return {"success": True, "listing_id": listing_id, "status": "available"}


@app.patch("/listings/{listing_id}/expire")
@limiter.limit("10/minute")
async def expire_listing(request: Request, listing_id: str):
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


@app.post("/image-recognition/recognize", response_model=ImageRecognitionResult)
@limiter.limit("5/minute")
async def recognize_food_from_image(request: Request, image: UploadFile = File(...)):
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")
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
        dino_prompt=result.get("dino_prompt"),
    )


@app.post("/upload")
@limiter.limit("5/minute")
async def upload_food_image(request: Request, image: UploadFile = File(...)):
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Use JPEG, PNG, or WebP.")

    contents = await image.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    ext = EXT_MAP[image.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/static/{filename}"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
