# CrisisLink - Food Relief and Surplus Resource Coordination Platform

> Real-time Food Relief and Surplus Resource Coordination Platform Powered by AI

## 📋 Project Overview

CrisisLink eliminates information barriers by seamlessly connecting surplus food providers (bakeries, restaurants) with community food relief organizations in need.

### Core Users

- **Donors**: Bakeries, restaurants, and businesses with food surplus
- **Organizations**: Food banks, food pantries, and community relief organizations

### Core Value Propositions

- ✨ **Lightning-Fast Posting**: Donors can list surplus food in just 60 seconds
- 🤖 **AI-Powered Recognition**: Snap a photo, and AI automatically identifies food type and quantity
- 🗺️ **Intelligent Matching**: NLP-driven matching between surplus food and organizational needs
- 🚨 **Smart Alerts**: ML-powered demand forecasting and coverage gap visualization
- 🌍 **Multi-Language Support**: Automatic translation breaking down language barriers

---

## 🏗️ System Architecture

The project is organized into 5 layers:

```
Layer 1: Users (Donors & Organizations)
           ↓
Layer 2: Frontend (React - Mobile-First)
           ↓
Layer 3: Backend Microservices (Python FastAPI)
           ├── Listing Service
           ├── Matching Service
           └── Prediction Service
           ↓
Layer 4: AI Engine (Python)
           ├── Image Recognition (SegFormer)
           ├── NLP Matching (Sentence Transformer)
           └── Demand Forecasting (K-Means + Random Forest)
           ↓
Layer 5: Data (PostgreSQL + SEIFA Data + Datasets)
```

See [Architecture Documentation](docs/ARCHITECTURE.md) for details

---

## 📁 Project Structure

```
CrisisLink/
├── Layer5-Data/                    # Data Layer
│   ├── postgresql/                 # Database schema & migrations
│   ├── abs-seifa-data/             # ABS SEIFA 2021 data
│   └── datasets/                   # Training datasets (Food-101, etc.)
│
├── Layer4-AI/                      # AI/ML Engine
│   ├── image_recognition/          # Image recognition models
│   ├── nlp_matching/               # NLP matching engine
│   └── demand_prediction/          # Demand forecasting models
│
├── Layer3-Backend/                 # Backend Microservices
│   ├── api_router/                 # API router
│   ├── listing_service/            # Listing management service
│   ├── matching_service/           # Matching service
│   ├── prediction_service/         # Prediction service
│   └── shared/                     # Shared libraries
│
├── Layer2-Frontend/                # Frontend Applications
│   ├── donor-app/                  # Donor app (Amber theme)
│   ├── org-app/                    # Organization app (Teal theme)
│   └── shared-components/          # Shared components
│
└── docs/                           # Documentation
    ├── ARCHITECTURE.md
    ├── DATABASE_SCHEMA.md
    └── AI_MODELS.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.12+** (required for the backend)
- **Node.js 18+** (for the frontend)
- **Git**

### Quick Start - Local Development (5 minutes)

Follow these steps to get the application running locally:

#### Step 1: Clone and Navigate
```bash
git clone https://github.com/oceanbrother/Crisislink.git
cd CrisisLink
```

#### Step 2: Setup Backend (Python)

```bash
# Navigate to backend directory
cd Layer3-Backend

# Create and activate Python virtual environment (if not already created)
python -m venv ..\.venv
..\.venv\Scripts\activate  # On macOS/Linux: source ../.venv/bin/activate

# Install dependencies
# Option A: Install from requirements.txt (latest working versions)
pip install -r requirements.txt

# Option B: Install from requirements-lock.txt (exact reproduced environment)
pip install -r requirements-lock.txt

# Start the backend API server
python start_server.py
# Or directly with uvicorn:
# uvicorn --host 0.0.0.0 --port 9000 listing_service.main:app --reload
```

**Backend will be available at:** `http://localhost:9000`
- **API Docs:** `http://localhost:9000/docs` (Swagger UI)
- **API Endpoints:**
  - `GET/POST /api/v1/listings` - Food listing operations
  - `POST /api/v1/auth/validate-postcode` - Donor authentication
  - `POST /api/v1/auth/validate-orgcode` - Organization authentication

#### Step 3: Setup Frontend (Node.js/React)

Open a **new terminal** and:

```bash
# From the project root directory
cd Layer2-Frontend/donor-app

# Install dependencies
npm install

# Start development server
npm run dev
```

**Frontend will be available at:** `http://localhost:3001`
- **Donor App (为捐献者):** `http://localhost:3001`

#### Step 4: Test the Application

1. **Open Browser:** `http://localhost:3001`
2. **Donor Mode (捐献):**
   - Click on "Donate Food" button
   - Take a photo or select an image of food
   - Fill in food details (category, quantity, etc.)
   - Submit the donation
3. **View Listings (查看列表):**
   - Click "View Food Listings" to see all available donations
   - Donations should appear in real-time (updates every 5 seconds)
   - Each listing shows food type, quantity, location, and match score

---

### Project Configuration Files

#### Backend Configuration
- **`Layer3-Backend/pyproject.toml`** - Python project metadata and dependencies
- **`Layer3-Backend/requirements.txt`** - Main dependencies (flexible versions)
- **`Layer3-Backend/requirements-lock.txt`** - Exact locked dependencies (for reproduction)

#### Frontend Configuration
- **`Layer2-Frontend/donor-app/package.json`** - Node.js dependencies
- **`Layer2-Frontend/donor-app/package-lock.json`** - Locked Node.js dependencies

---

### Troubleshooting

#### Backend Issues

**Error: "Port 9000 already in use"**
```bash
# Find and kill process using port 9000
netstat -ano | findstr :9000
taskkill /F /PID <PID>
```

**Error: "Module not found"**
```bash
# Ensure you're in the virtual environment
..\.venv\Scripts\activate
# Reinstall dependencies
pip install -r requirements.txt
```

**Error: "Pydantic validation error"**
```bash
# This usually means your Python version is wrong
python --version  # Should be 3.12+
# Use Python 3.12 specifically if available
python3.12 -m venv ..\.venv
```

#### Frontend Issues

**Error: "npm: command not found"**
- Ensure Node.js 18+ is installed: `node --version`

**Error: "Port 3001 already in use"**
```bash
# Kill the port or use a different port
# For Windows:
netstat -ano | findstr :3001
taskkill /F /PID <PID>

# Or start on different port:
npm run dev -- --port 3002
```

**Listings not showing:**
- Ensure backend is running on `http://localhost:9000`
- Check browser console for API errors
- Try refreshing the page

---

### Development Tips

**Auto-Reload Changes:**
- Backend: Already enabled with `--reload` flag
- Frontend: React Hot Module Replacement (HMR) enabled by default

**View Backend Logs:**
- API documentation: `http://localhost:9000/docs` (interactive Swagger UI)
- Backend console shows incoming requests

**Debug Donation Submission:**
1. Open browser DevTools (F12) → Network tab
2. Submit a donation and watch the API calls
3. Check response payload to see if data is correctly formatted

---

### Next Steps

For detailed setup instructions for individual components:
- Backend: See [Layer3-Backend/README.md](Layer3-Backend/README.md)
- Frontend: See [Layer2-Frontend/donor-app/README.md](Layer2-Frontend/donor-app/README.md)
- Architecture: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
```

---

## 📚 Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [AI Models Documentation](docs/AI_MODELS.md)

---

## 👥 Development Team Structure

- **Frontend & Backend Engineers**: Responsible for Layer 2 & 3
- **Data Engineers**: Responsible for Layer 4 & 5

---

## 📝 Development Roadmap

### Phase 1: Data Preparation & AI Engine (Layer 4 & 5)
- [ ] PostgreSQL schema design
- [ ] SEIFA data import
- [ ] Image recognition model fine-tuning
- [ ] NLP matching engine training
- [ ] Demand forecasting model development

### Phase 2: Backend Microservices (Layer 3)
- [ ] Listing Service development
- [ ] Matching Service development
- [ ] Prediction Service development
- [ ] API Router integration

### Phase 3: Frontend Applications (Layer 2)
- [ ] Donor app form development
- [ ] Organization dashboard development
- [ ] Real-time update integration (WebSocket)

### Phase 4: Testing & Deployment
- [ ] Unit tests
- [ ] Integration tests
- [ ] Production deployment

---

## 📄 License

MIT License

---

## 🤝 Contributing

We welcome issues and pull requests!

---

**Last Updated**: April 2026
