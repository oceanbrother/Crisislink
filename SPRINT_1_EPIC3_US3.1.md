# Epic 3 US 3.1 - Quick Donation Form (60 Seconds)

## Overview

This feature enables food donors (bakeries, restaurants) to post surplus food listings in under 60 seconds without creating an account. Only postcode and organization code are required.

## Completed Components

### Layer 2 - Frontend (Donor App)

**Components:**
- `DonationForm.jsx` - Main form component with:
  - 📷 Camera integration for food photos
  - ⏱️ 60-second countdown timer
  - AI-auto-filled fields (editable)
  - Simple postcode + org code identification
  - Real-time form validation

**Features:**
- Amber color scheme throughout
- Mobile-first responsive design
- Field auto-fill from image recognition
- Success/error message handling
- No account required

**File Structure:**
```
Layer2-Frontend/donor-app/
├── package.json                 # Dependencies & scripts
├── vite.config.js              # Vite configuration
├── index.html                  # Entry point
├── src/
│   ├── main.jsx               # React entry
│   ├── App.jsx                # Main app component
│   ├── App.css
│   ├── index.css              # Global styles (Tailwind)
│   ├── components/
│   │   └── DonationForm.jsx    # Core donation form
│   ├── styles/
│   │   └── DonationForm.css
│   └── services/
│       └── api.js             # API client for backend
└── .gitignore
```

### Layer 3 - Backend (Listing Service)

**Endpoints:**
- `POST /listings` - Create new listing
- `GET /listings` - Get listings with filters (postcode, foodType, status)
- `GET /listings/{id}` - Get specific listing
- `POST /listings/{id}/claim` - Claim a listing
- `POST /image-recognition/recognize` - Image recognition endpoint
- `PATCH /listings/{id}/expire` - Mark as expired

**Features:**
- FastAPI with CORS enabled
- Pydantic data models for validation
- Mock database (ready for PostgreSQL integration)
- Integration points for image recognition and matching services
- RESTful API with clear documentation

**File Structure:**
```
Layer3-Backend/listing_service/
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
└── __init__.py
```

### Layer 4 - AI (Image Recognition)

**Components:**
- `recognizer.py` - Food recognition class with:
  - SegFormer model for primary detection
  - Google Cloud Vision API fallback (confidence < 70%)
  - Portion estimation

- `registry.py` - Model registry for:
  - Version management
  - Metadata tracking
  - Performance logging

**File Structure:**
```
Layer4-AI/
├── config.py           # AI engine configuration
├── requirements.txt    # ML dependencies
├── image_recognition/
│   ├── food_photo_recognition/
│   │   └── recognizer.py    # Main recognition logic
│   └── model_registry/
│       └── registry.py      # Model versioning
└── __init__.py
```

## Getting Started (Development)

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Frontend Setup

```bash
cd Layer2-Frontend/donor-app

# Install dependencies
npm install

# Start development server
npm run dev
# Opens at http://localhost:3001
```

### Backend Setup

```bash
cd Layer3-Backend/listing_service

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Or (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start server
python main.py
# Runs at http://localhost:8000
# API docs: http://localhost:8000/docs
```

### AI Engine Setup (Optional for this sprint)

```bash
cd Layer4-AI

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# TODO: Download pre-trained models
# TODO: Set up Google Cloud Vision API credentials
```

## API Integration Flow

```
User (Donor)
    ↓
DonationForm (Layer 2)
    │
    ├─→ [Camera] Takes photo
    │
    ├─→ POST /image-recognition/recognize
    │   ↓
    │   Layer 4: SegFormer model processes image
    │   Returns: { foodType, quantity, confidence }
    │
    ├─→ [User edits fields]
    │
    └─→ POST /listings
        ↓
        Layer 3: Listing Service
        Returns: { id, createdAt, status: "available" }
        
        [TODO] Trigger Matching Service
```

## Key Design Decisions

1. **Zero Account Friction**: Only postcode + org code needed
   - Reduces "barrier to entry" friction
   - Faster donation process

2. **Local-First Image Processing**: SegFormer primary, Vision API fallback
   - SegFormer for speed and privacy (no cloud needed)
   - Vision API only for edge cases (low confidence)

3. **60-Second Timer**: Visual countdown keeps donors focused
   - Gamification element
   - Encourages quick completion

4. **AI Auto-Fill with Edit**: 
   - Pre-fills foodType/quantity from photo
   - User can always override
   - Maintains "human-in-the-loop" trust

## TODO / Next Steps

### This Sprint:
- [ ] Test image recognition with real food photos
- [ ] Fine-tune timer UI/UX
- [ ] Add form validation edge cases
- [ ] Performance optimization (image compression)

### Next Sprints:
- [ ] Connect to real PostgreSQL database (Layer 5)
- [ ] Implement actual SegFormer model loading
- [ ] Google Cloud Vision API integration
- [ ] Trigger Matching Service on new listings
- [ ] Real-time WebSocket updates for organizations
- [ ] Analytics/metrics collection

## Testing

```bash
# Frontend tests (to be added)
npm run test

# Backend tests (to be added)
python -m pytest

# Manual testing
# 1. Start backend: python main.py
# 2. Start frontend: npm run dev
# 3. Open http://localhost:3001
# 4. Test the full flow
```

## Troubleshooting

**Frontend can't connect to backend?**
- Check backend is running on port 8000
- Check CORS is enabled (it is by default)
- Check API Base URL in `Layer2-Frontend/donor-app/src/services/api.js`

**Image recognition endpoint returning mock data?**
- Layer 4 models not yet trained
- Following the "skeleton first, fill in logic later" pattern
- TODO: Replace with actual model calls

**Form submission fails?**
- Verify all required fields are filled
- Check postcode is 4 characters
- Check backend is running

---

**Branch**: `feature/epic3-us3.1-quick-donation-form`  
**Status**: Initial framework complete  
**Last Updated**: April 2026
