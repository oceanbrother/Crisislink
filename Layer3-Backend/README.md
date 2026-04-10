# Layer 3 - Backend Microservices

## Overview

This layer contains the core business logic microservices that coordinate between the frontend, AI engine, and database.

## Microservices

### 1. Listing Service (`listing_service/`)
- **Purpose**: Handle creation, retrieval, and lifecycle of food listings
- **Key Operations**:
  - Create new listing (POST)
  - Get available listings (GET with filters)
  - Claim a listing (PATCH status)
  - Mark as expired (PATCH)
- **Database**: Direct PostgreSQL access for CRUD operations

### 2. Matching Service (`matching_service/`)
- **Purpose**: Match surplus food with organizational needs
- **Key Operations**:
  - Trigger when new listing is posted
  - Call NLP matcher from Layer 4
  - Rank matches by similarity score
  - Push notifications to top-matched organizations
  - Log accepted/rejected matches for model training

### 3. Prediction Service (`prediction_service/`)
- **Purpose**: Generate demand forecasts and alert organizations about coverage gaps
- **Key Operations**:
  - Run weekly (scheduled task)
  - Generate postcode-level risk scores
  - Compare against current supply
  - Surface high-priority alerts

### 4. API Router (`api_router/`)
- Single entry point for frontend requests
- Routes requests to appropriate microservices
- Future evolution path: Can be upgraded to a full API Gateway if needed

## Architecture

```
Frontend
   ↓
API Router (FastAPI)
   ├── /listings → Listing Service
   ├── /matches → Matching Service
   └── /predictions → Prediction Service
   ↓
Shared connectors to AI Engine & Database
```

## Technology Stack

- **Framework**: Python FastAPI
- **Server**: Uvicorn
- **Database**: PostgreSQL (with async driver, currently using mock in-memory storage)
- **AI Integration**: Direct imports from Layer 4
- **Language**: Python 3.12+

## Quick Start

### Prerequisites
- Python 3.12+ installed on your system
- Virtual environment (recommended)

### Installation & Running

#### 1. Create and Activate Virtual Environment
```bash
# From the project root
cd Layer3-Backend

# Create virtual environment (if not exists)
python -m venv ..\.venv

# Activate it
# Windows:
..\.venv\Scripts\activate

# macOS/Linux:
source ../.venv/bin/activate
```

#### 2. Install Dependencies
```bash
# Option A: Install from requirements.txt (latest compatible versions)
pip install -r requirements.txt

# Option B: Install from requirements-lock.txt (exact versions for reproduction)
pip install -r requirements-lock.txt
```

#### 3. Start the Server
```bash
# Method 1: Using provided startup script
python start_server.py

# Method 2: Direct uvicorn command (with auto-reload)
uvicorn listing_service.main:app --host 0.0.0.0 --port 9000 --reload

# Method 3: Production mode (no auto-reload)
uvicorn listing_service.main:app --host 0.0.0.0 --port 9000
```

**Server will start at:** `http://0.0.0.0:9000`

### API Documentation

Once the server is running, access the interactive API documentation:
- **Swagger UI:** `http://localhost:9000/docs`
- **ReDoc:** `http://localhost:9000/redoc`

### Testing the API

**Create a new food listing:**
```bash
curl -X POST http://localhost:9000/api/v1/listings \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "Test Bakery",
    "description_en": "Fresh bread",
    "description_zh_CN": "新鲜面包",
    "description_vi": "Bánh tươi",
    "food": {
      "emoji": "🍞",
      "category": "bakery",
      "quantity": "10 units",
      "tags": ["fresh", "organic"],
      "allergens": "None"
    },
    "location": {
      "postcode": "3000"
    }
  }'
```

**Get all listings:**
```bash
curl http://localhost:9000/api/v1/listings
```

### Project Structure

```
Layer3-Backend/
├── listing_service/           # Main FastAPI application
│   ├── main.py               # FastAPI app initialization and routes
│   ├── database.py           # Database connection & mock data loading
│   └── utils.py              # Helper functions
│
├── routers/                   # API route handlers
│   ├── listings.py           # Listing CRUD endpoints
│   ├── auth.py               # Authentication endpoints
│   └── __init__.py
│
├── models/                    # Pydantic data models
│   ├── listing.py            # Listing & related models
│   ├── user.py               # User & organization models
│   └── __init__.py
│
├── services/                  # Business logic services
│   ├── mock_data.py          # Mock data generator (15 listings by default)
│   ├── listing_service.py    # Listing operations
│   └── matching_service.py   # Matching logic
│
├── api_router/               # API routing
│   └── routes.py             # Route definitions
│
├── requirements.txt           # Main dependencies (flexible versions)
├── requirements-lock.txt      # Exact locked versions
├── pyproject.toml            # Python project configuration
├── start_server.py           # Startup script
└── README.md                 # This file
```

### Configuration

#### Change Number of Mock Listings
Edit `services/mock_data.py` line that calls `generate_listings()`:
```python
listings = MockDataGenerator.generate_listings(count=15)  # Change 15 to desired count
```

Default: **15 listings** (sufficient for testing)

#### Environment Variables (Future)
```bash
DATABASE_URL=postgresql://user:password@localhost/crisislink
DEBUG=False
LOG_LEVEL=info
```

### Troubleshooting

**Port 9000 already in use:**
```bash
# Windows
netstat -ano | findstr :9000
taskkill /F /PID <PID>

# macOS/Linux
lsof -i :9000
kill -9 <PID>
```

**Pydantic validation errors:**
- Ensure Python 3.12+ is being used
- Check that all required fields are provided in API requests
- Validate JSON structure matches Pydantic models

**Module import errors:**
- Ensure you're in the virtual environment: `pip list | grep fastapi`
- Reinstall dependencies: `pip install -r requirements.txt`

## Getting Started

Detailed setup and running instructions are provided above.

---

**Status**: Beta - Ready for Local Testing
