# CrisisLink - Local Development Setup Guide

This guide helps you set up and run CrisisLink locally for testing and development.

## ⚡ Quick Start (< 5 minutes)

### Terminal 1: Start Backend
```bash
cd Layer3-Backend
# Activate virtual environment if needed
..\.venv\Scripts\activate  # Windows
# source ../.venv/bin/activate  # macOS/Linux

# Install dependencies (first time only)
pip install -r requirements.txt

# Start server
python start_server.py
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:9000
```

### Terminal 2: Start Frontend
```bash
cd Layer2-Frontend/donor-app

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Expected output:
```
➜  Local:   http://localhost:3001/
```

### Step 3: Open in Browser
**http://localhost:3001**

---

## 📋 Detailed Setup

### Prerequisites Check

```bash
# Check Python version (must be 3.12+)
python --version
# Output should show: Python 3.12.x

# Check Node.js version (must be 18+)
node --version
# Output should show: v18.x.x or higher

# Check npm
npm --version
```

If versions are wrong, install the correct versions:
- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/

### Initial Setup

#### 1️⃣ Backend Setup

```bash
# Navigate to backend directory
cd Layer3-Backend

# Option A: Use existing virtual environment
..\venv\Scripts\activate

# Option B: Create new virtual environment
python -m venv ..\.venv
..\.venv\Scripts\activate

# Install dependencies - Choose one:
# Standard installation (recommended versions)
pip install -r requirements.txt

# Or exact versions (for reproducing exact environment)
pip install -r requirements-lock.txt

# Verify installation
python -c "import fastapi; print(f'FastAPI {fastapi.__version__}')"
```

#### 2️⃣ Frontend Setup

```bash
# Navigate to frontend directory
cd Layer2-Frontend/donor-app

# Install dependencies
npm install

# Verify installation
npm list react react-dom
```

---

## 🎯 Configuration Files Reference

### Backend Configuration

| File | Purpose | Notes |
|------|---------|-------|
| `pyproject.toml` | Python project metadata | Standard Python project config |
| `requirements.txt` | Main dependencies | Main + transitive deps, flexible versions |
| `requirements-lock.txt` | Exact locked versions | Pin exact versions for reproducibility |
| `start_server.py` | Startup script | Convenience wrapper around uvicorn |

**Default Backend Config:**
- **Host:** `0.0.0.0` (all interfaces)
- **Port:** `9000`
- **Mock Listings:** 15 (for fast testing)

### Frontend Configuration

| File | Purpose | Notes |
|------|---------|-------|
| `package.json` | Node.js dependencies & scripts | Main configuration |
| `package-lock.json` | Exact npm versions | Auto-generated, commit to git |
| `vite.config.js` | Vite bundler config | Minimal config, extends defaults |
| `.env.local` | Local environment variables | Not committed to git |

**Default Frontend Config:**
- **Host:** `0.0.0.0` (all interfaces)
- **Port:** `3001`
- **Backend API:** `http://localhost:9000/api/v1`

---

## 📂 What Each File Does

### Backend Files

- **`pyproject.toml`** - Defines Python project:
  ```toml
  [project]
  dependencies = [
      "fastapi==0.109.0",
      "uvicorn==0.27.0",
      ...
  ]
  ```

- **`requirements.txt`** - Pip-compatible dependency list:
  ```
  fastapi==0.109.0
  uvicorn==0.27.0
  ...
  ```

- **`requirements-lock.txt`** - All dependencies + transitive:
  ```
  # Includes all automatically installed deps
  annotated-types==0.7.0
  anyio==4.13.0
  ...
  ```

### Frontend Files

- **`package.json`** - Lists project dependencies and scripts:
  ```json
  {
    "scripts": {
      "dev": "vite --host 0.0.0.0 --port 3001",
      "build": "vite build"
    }
  }
  ```

- **`package-lock.json`** - Locks npm package versions (auto-generated)

---

## 🚀 Running the Application

### Start Sequence (Recommended)

**Window 1 - Backend:**
```bash
cd Layer3-Backend
..\.venv\Scripts\activate
python start_server.py
```

Wait for message: `✓ Application ready for requests`

**Window 2 - Frontend:**
```bash
cd Layer2-Frontend/donor-app
npm run dev
```

Wait for message: `Local: http://localhost:3001/`

**Window 3 - Browser:**
Open browser and visit: `http://localhost:3001`

### Testing the Flow

1. **Donate Food:**
   - Click "Donate Food" button
   - Take/upload photo of food
   - Fill in details (quantity, location)
   - Click Submit
   - Should see: "✓ Donation submitted successfully"

2. **View Listings:**
   - Click "View Food Listings"
   - Should see list of all donations
   - Should see your newly submitted donation within 5 seconds
   - Try filtering by category or searching

3. **Check Backend:**
   - Visit `http://localhost:9000/docs`
   - Test API endpoints directly in Swagger UI
   - Try: `GET /api/v1/listings` to see all data

---

## 🔧 Common Issues & Solutions

### Backend Issues

#### ❌ "Port 9000 already in use"
```bash
# Find what's using port 9000
netstat -ano | findstr :9000

# Kill the process (replace XXXX with PID)
taskkill /F /PID XXXX
```

#### ❌ "Module not found" errors
```bash
# Verify virtual environment is activated
pip list | grep fastapi  # Should show fastapi==0.109.0

# Reinstall if needed
pip install -r requirements.txt
```

#### ❌ "Python 3.12 not found"
```bash
# Check current Python version
python --version

# Install Python 3.12 from: https://www.python.org/downloads/
# Or use pyenv for version management
```

#### ❌ Pydantic validation errors
```bash
# These usually mean Python version mismatch
python --version  # Must be 3.12+

# Sometimes helps:
pip install --upgrade pydantic
```

### Frontend Issues

#### ❌ "npm command not found"
```bash
# Install Node.js from: https://nodejs.org/
# Or verify it's installed:
npm --version
```

#### ❌ "Port 3001 already in use"
```bash
# Find and kill process
netstat -ano | findstr :3001
taskkill /F /PID XXXX

# Or use different port
npm run dev -- --port 3002
```

#### ❌ "Cannot find module"
```bash
# Delete node_modules and reinstall
rm -r node_modules
npm install

# Or just clean cache
npm cache clean --force
npm install
```

#### ❌ API is not connecting
Check `Layer2-Frontend/donor-app/src/api.js`:
```javascript
const API_URL = 'http://localhost:9000/api/v1'  // Must match backend
```

---

## 📊 Quick Reference

### Ports Used

| Service | Port | URL | Notes |
|---------|------|-----|-------|
| Backend API | 9000 | http://localhost:9000 | REST API |
| API Docs | 9000 | http://localhost:9000/docs | Swagger UI |
| Frontend | 3001 | http://localhost:3001 | React app |
| Database | 5432 | (Local only) | PostgreSQL (not used in demo) |

### Dependency Versions

**Python:** `3.12`
- fastapi==0.109.0
- uvicorn==0.27.0
- pydantic==2.6.1

**Node.js:** `18+`
- react: ^18.2.0
- vite: ^5.0.8
- axios: ^1.6.0

---

## 🧪 Testing Checklist

- [ ] Backend server starts without errors
- [ ] Frontend dev server starts without errors
- [ ] Can access `http://localhost:3001` in browser
- [ ] Can submit a donation
- [ ] Can see listings page
- [ ] Newly submitted donation appears in list
- [ ] API docs accessible at `http://localhost:9000/docs`
- [ ] Language switcher works (EN/ZH/VI)

---

## 📚 Further Documentation

- **Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Backend Details**: See [Layer3-Backend/README.md](Layer3-Backend/README.md)
- **Frontend Details**: See [Layer2-Frontend/donor-app/README.md](Layer2-Frontend/donor-app/README.md)
- **Main README**: See [README.md](README.md)

---

## 💡 Tips for Faster Development

### Auto-reload enabled by default:
- **Backend**: Changes to Python files auto-reload with `--reload` flag
- **Frontend**: React Hot Module Replacement (HMR) enables instant reload

### Monitor API requests:
- Open browser DevTools (F12)
- Go to Network tab
- Submit donation and watch requests
- Check Response tab to see API response

### Check Mock Data:
- Mock listings are generated at backend startup
- Change count in `Layer3-Backend/services/mock_data.py` line ~322
- Default: 15 listings (good for testing)

### Debugging Tips:
1. Backend logs show all HTTP requests
2. Frontend console (F12) shows JavaScript errors
3. Backend API docs at `http://localhost:9000/docs` is interactive
4. Try all API endpoints directly in Swagger UI

---

## ✅ You're Ready!

Follow the "Quick Start" section above and you'll have:
- ✅ Backend API running on `http://localhost:9000`
- ✅ Frontend running on `http://localhost:3001`
- ✅ Real-time food donation coordination system
- ✅ Full testing environment ready

Happy developing! 🚀
