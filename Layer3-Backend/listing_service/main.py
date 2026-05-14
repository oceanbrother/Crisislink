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
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uuid
import databases
from dotenv import load_dotenv
import re
import json

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


# ── Lifespan: startup + shutdown ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    global recognizer

    # Connect to PostgreSQL
    await database.connect()
    print("✓ PostgreSQL connected")

    # Load ML model (optional — server starts even if .pth weights are absent)
    try:
        print("Starting food recognizer...")
        recognizer = get_recognizer()
        print("✓ Model ready")
    except FileNotFoundError as e:
        print(f"⚠ Model weights not found ({e}). Image recognition disabled.")
        recognizer = None

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

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Serve uploaded food images at /static/<filename>
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=UPLOADS_DIR), name="static")

_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "https://donor-app-dusky.vercel.app,http://localhost:3000,http://localhost:3004,http://localhost:5173",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── WebSocket connection manager ──────────────────────────────────────────────

class ConnectionManager:
    """
    Tracks active WebSocket connections grouped by listing_id.
    Each room (listing_id) can have at most 2 connections: donor + claimer.
    """

    def __init__(self):
        self._rooms: dict[str, list[tuple[WebSocket, str]]] = {}

    async def connect(self, listing_id: str, ws: WebSocket, org_code: str):
        await ws.accept()
        self._rooms.setdefault(listing_id, []).append((ws, org_code))

    def disconnect(self, listing_id: str, ws: WebSocket):
        if listing_id in self._rooms:
            self._rooms[listing_id] = [
                (w, c) for w, c in self._rooms[listing_id] if w is not ws
            ]
            if not self._rooms[listing_id]:
                del self._rooms[listing_id]

    async def broadcast(self, listing_id: str, payload: dict):
        for ws, _ in list(self._rooms.get(listing_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                pass


manager = ConnectionManager()

# ── Pydantic models (chat) ─────────────────────────────────────────────────────

_SAFE_CODE_RE = re.compile(r"^[A-Z0-9-]{3,50}$")


def _validate_org_code(code: str) -> str:
    if not _SAFE_CODE_RE.match(code):
        raise ValueError("Invalid org code format")
    return code


class PublicKeyUpload(BaseModel):
    senderOrgCode: str = Field(..., min_length=3, max_length=50)
    publicKey: str = Field(..., min_length=10, max_length=8000)

    @field_validator("senderOrgCode")
    @classmethod
    def validate_sender(cls, v):
        return _validate_org_code(v)


class WsChatMessage(BaseModel):
    senderOrgCode: str = Field(..., min_length=3, max_length=50)
    ciphertext: str = Field(..., min_length=1, max_length=50000)
    iv: str = Field(..., min_length=1, max_length=200)


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


# Codes starting with DNR- are donors; CBO- are community organisations.
# Anything else is a legacy code and defaults to 'donor'.

class RegisterRequest(BaseModel):
    """Body for POST /register — creates or upserts an org identity.

    Field order matters: orgType must come before orgCode so that the
    cross-field validator can read the already-validated orgType value
    from info.data (Pydantic v2 validates fields in declaration order).
    """
    orgType:             str           = Field(..., pattern=r"^(donor|community_org)$")
    orgCode:             str           = Field(..., min_length=3, max_length=20,
                                               pattern=r"^[A-Z0-9-]+$")
    orgName:             str           = Field(..., min_length=1, max_length=255)
    businessAddress:     Optional[str] = Field(default=None, max_length=500)
    preferredLocation:   Optional[str] = Field(default=None, max_length=500)
    maxPickupDistanceKm: Optional[int] = Field(default=None, ge=1, le=500)

    @field_validator("orgName")
    @classmethod
    def clean_org_name(cls, v):
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Organisation name cannot be blank")
        return cleaned

    @field_validator("orgCode")
    @classmethod
    def code_matches_type(cls, v, info):
        # info.data already contains orgType because it is declared first
        org_type = info.data.get("orgType")
        if org_type == "donor" and not v.startswith("DNR-"):
            raise ValueError("Donor codes must begin with DNR-")
        if org_type == "community_org" and not v.startswith("CBO-"):
            raise ValueError("Organisation codes must begin with CBO-")
        return v


# ── DB helpers ────────────────────────────────────────────────────────────────

def _infer_org_type(org_code: str) -> str:
    """Derive org_type from code prefix; legacy codes default to 'donor'."""
    if org_code.startswith("DNR-"):
        return "donor"
    if org_code.startswith("CBO-"):
        return "community_org"
    return "donor"


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

    org_type = _infer_org_type(org_code)
    result = await database.fetch_one(
        """
        INSERT INTO organization (org_name, org_code, org_type)
        VALUES (:org_name, :org_code, :org_type)
        RETURNING org_id
        """,
        {"org_name": org_code, "org_code": org_code, "org_type": org_type},
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
    return {"status": "ok", "service": "listing-service", "db": "postgresql"}


@app.post("/register", status_code=201)
@limiter.limit("5/minute")
async def register_identity(request: Request, body: RegisterRequest):
    """
    Create or update an organisation identity (donor or community org).

    Called once from the frontend registration page immediately after a
    code is generated. Subsequent interactions use get_or_create_org().

    Uses INSERT … ON CONFLICT so re-registering with the same code is safe
    and idempotent — it only updates the org_name if one is provided.
    Returns only the code and type; internal IDs are never exposed.
    """
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
                org_name             = EXCLUDED.org_name,
                business_address     = COALESCE(EXCLUDED.business_address,     organization.business_address),
                preferred_location   = COALESCE(EXCLUDED.preferred_location,   organization.preferred_location),
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
    now = datetime.now()

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

ALLOWED_STATUSES = {"available", "claimed", "expired", "collected"}

@app.get("/listings", response_model=list[Listing])
@limiter.limit("30/minute")
async def get_listings(
    request: Request,
    postcode: Optional[str] = None,
    foodType: Optional[str] = None,
    status: str = "available",
    claimedByOrgCode: Optional[str] = None,
    postedByOrgCode: Optional[str] = None,
):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="status must be one of: available, claimed, expired, collected")
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

    if claimedByOrgCode:
        query += " AND co.org_code = :claimed_by_org_code"
        params["claimed_by_org_code"] = claimedByOrgCode

    if postedByOrgCode:
        query += " AND o.org_code = :posted_by_org_code"
        params["posted_by_org_code"] = postedByOrgCode

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

    # Auto-create a chat session so both parties can exchange keys.
    donor_row = await database.fetch_one(
        """
        SELECT o.org_code FROM food_listing fl
        JOIN organization o ON fl.org_id = o.org_id
        WHERE fl.listing_id = :listing_id
        """,
        {"listing_id": listing_id},
    )
    donor_org_code = donor_row["org_code"] if donor_row else ""

    await database.execute(
        """
        INSERT INTO chat_session (listing_id, donor_org_code, claimer_org_code)
        VALUES (:listing_id, :donor_org_code, :claimer_org_code)
        ON CONFLICT (listing_id) DO NOTHING
        """,
        {
            "listing_id":       listing_id,
            "donor_org_code":   donor_org_code,
            "claimer_org_code": claim.orgId,
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
    if recognizer is None:
        raise HTTPException(status_code=503, detail="Image recognition model not loaded. Add the .pth weights file.")
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

    # 3. Derive extension from MIME type, not from client filename
    ext = EXT_MAP[image.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/static/{filename}"}


# ── Chat Routes ───────────────────────────────────────────────────────────────

@app.get("/chat/sessions/{listing_id}")
@limiter.limit("30/minute")
async def get_chat_session(request: Request, listing_id: str, orgCode: str):
    """
    Return session metadata + both parties' public keys.
    Only participants may call this.
    """
    row = await database.fetch_one(
        "SELECT * FROM chat_session WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")

    if orgCode not in (row["donor_org_code"], row["claimer_org_code"]):
        raise HTTPException(status_code=403, detail="Not a participant of this chat")

    return {
        "listingId":         row["listing_id"],
        "donorOrgCode":      row["donor_org_code"],
        "claimerOrgCode":    row["claimer_org_code"],
        "donorPublicKey":    row["donor_public_key"],
        "claimerPublicKey":  row["claimer_public_key"],
    }


@app.post("/chat/sessions/{listing_id}/keys")
@limiter.limit("10/minute")
async def upload_public_key(request: Request, listing_id: str, body: PublicKeyUpload):
    """
    Upload the caller's ephemeral EC P-256 public key (JWK JSON).
    The server stores it so the other party can fetch it to derive the shared secret.
    Private keys never leave the browser.
    """
    row = await database.fetch_one(
        "SELECT donor_org_code, claimer_org_code FROM chat_session WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")

    if body.senderOrgCode == row["donor_org_code"]:
        await database.execute(
            "UPDATE chat_session SET donor_public_key = :key WHERE listing_id = :lid",
            {"key": body.publicKey, "lid": listing_id},
        )
    elif body.senderOrgCode == row["claimer_org_code"]:
        await database.execute(
            "UPDATE chat_session SET claimer_public_key = :key WHERE listing_id = :lid",
            {"key": body.publicKey, "lid": listing_id},
        )
    else:
        raise HTTPException(status_code=403, detail="Not a participant of this chat")

    # Notify other party (if connected via WebSocket) that a key is now available
    await manager.broadcast(listing_id, {"type": "key_ready", "from": body.senderOrgCode})
    return {"success": True}


@app.get("/chat/messages/{listing_id}")
@limiter.limit("60/minute")
async def get_chat_messages(request: Request, listing_id: str, orgCode: str):
    """
    Return encrypted message history for a session.
    Ciphertexts are returned as-is; decryption happens client-side.
    """
    row = await database.fetch_one(
        "SELECT donor_org_code, claimer_org_code FROM chat_session WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")

    if orgCode not in (row["donor_org_code"], row["claimer_org_code"]):
        raise HTTPException(status_code=403, detail="Not a participant")

    messages = await database.fetch_all(
        """
        SELECT sender_org_code, ciphertext, iv, created_at
        FROM chat_message
        WHERE listing_id = :listing_id
        ORDER BY created_at ASC
        """,
        {"listing_id": listing_id},
    )
    return [
        {
            "senderOrgCode": m["sender_org_code"],
            "ciphertext":    m["ciphertext"],
            "iv":            m["iv"],
            "createdAt":     m["created_at"],
        }
        for m in messages
    ]


@app.delete("/chat/sessions/{listing_id}")
@limiter.limit("5/minute")
async def terminate_chat(request: Request, listing_id: str, orgCode: str):
    """
    Mark food as physically collected, delete the chat session + all messages,
    and broadcast a termination notice to any connected WebSocket clients.

    Only the claiming org may call this endpoint (they are the one collecting).
    """
    row = await database.fetch_one(
        "SELECT claimer_org_code FROM chat_session WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chat session not found")

    if row["claimer_org_code"] != orgCode:
        raise HTTPException(status_code=403, detail="Only the claiming org can mark food as collected")

    # Notify connected clients before wiping data
    await manager.broadcast(listing_id, {"type": "chat_terminated", "reason": "food_collected"})

    # Cascade delete removes chat_message rows automatically
    await database.execute(
        "DELETE FROM chat_session WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )

    # Mark listing as physically collected (beyond 'claimed')
    await database.execute(
        "UPDATE food_listing SET status = 'collected' WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )

    return {"success": True, "listing_id": listing_id}


@app.websocket("/chat/ws/{listing_id}/{org_code}")
async def chat_websocket(websocket: WebSocket, listing_id: str, org_code: str):
    """
    Real-time encrypted chat channel for a food listing.

    Protocol:
      client → server  { "type": "message", "senderOrgCode": "...", "ciphertext": "...", "iv": "..." }
      server → clients { "type": "message", "senderOrgCode": "...", "ciphertext": "...", "iv": "...", "createdAt": "..." }
      server → clients { "type": "key_ready", "from": "..." }
      server → clients { "type": "chat_terminated", "reason": "food_collected" }

    Ciphertexts are AES-256-GCM; the server only relays and persists them.
    """
    # Validate participant before accepting connection
    row = await database.fetch_one(
        "SELECT donor_org_code, claimer_org_code FROM chat_session WHERE listing_id = :listing_id",
        {"listing_id": listing_id},
    )
    if not row or org_code not in (row["donor_org_code"], row["claimer_org_code"]):
        await websocket.close(code=4003)
        return

    await manager.connect(listing_id, websocket, org_code)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") != "message":
                continue

            sender     = str(data.get("senderOrgCode", ""))
            ciphertext = str(data.get("ciphertext", ""))
            iv         = str(data.get("iv", ""))

            # Basic integrity checks — sender must match the authenticated org_code
            if sender != org_code or not ciphertext or not iv:
                continue

            # Impose a reasonable size cap to prevent abuse
            if len(ciphertext) > 50000 or len(iv) > 200:
                continue

            now = datetime.now()
            await database.execute(
                """
                INSERT INTO chat_message (listing_id, sender_org_code, ciphertext, iv, created_at)
                VALUES (:lid, :sender, :ciphertext, :iv, :created_at)
                """,
                {
                    "lid":        listing_id,
                    "sender":     sender,
                    "ciphertext": ciphertext,
                    "iv":         iv,
                    "created_at": now,
                },
            )

            await manager.broadcast(
                listing_id,
                {
                    "type":          "message",
                    "senderOrgCode": sender,
                    "ciphertext":    ciphertext,
                    "iv":            iv,
                    "createdAt":     now.isoformat(),
                },
            )

    except WebSocketDisconnect:
        manager.disconnect(listing_id, websocket)
    except Exception:
        manager.disconnect(listing_id, websocket)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
