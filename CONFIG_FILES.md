# Configuration Files Manifest

This document summarizes all configuration files in the CrisisLink project and their purposes.

## 📋 Overview

| Category | File | Location | Purpose |
|----------|------|----------|---------|
| **Backend** | `pyproject.toml` | `Layer3-Backend/` | Python project configuration and metadata |
| **Backend** | `requirements.txt` | `Layer3-Backend/` | Core dependencies (flexible versions) |
| **Backend** | `requirements-lock.txt` | `Layer3-Backend/` | Exact locked versions (for reproducibility) |
| **Frontend** | `package.json` | `Layer2-Frontend/donor-app/` | Node.js dependencies and scripts |
| **Frontend** | `package-lock.json` | `Layer2-Frontend/donor-app/` | npm exact version locking |
| **Frontend** | `vite.config.js` | `Layer2-Frontend/donor-app/` | Vite build configuration |
| **Project** | `README.md` | `./` | Project overview |
| **Project** | `SETUP.md` | `./` | Local development setup guide |

---

## 🔧 Backend Configuration Files

### 1. `Layer3-Backend/pyproject.toml`

**Standard Python project configuration file** (PEP 517/518 standard)

**Key content:**
```toml
[project]
name = "crisislink-backend"
version = "0.1.0"
description = "CrisisLink Backend - Food Relief..."
requires-python = ">=3.12"

[project.dependencies]
fastapi = "0.109.0"
uvicorn = "0.27.0"
pydantic = "2.6.1"
# ... other dependencies

[tool.black]
line-length = 100
target-version = ["py312"]
```

**When to modify:**
- Upgrade minimum Python version requirement
- Add new dependency packages
- Update project metadata (version, description, etc.)

**Install dependencies:**
```bash
pip install -e .  # Development mode
pip install .[dev]  # Include development tools
```

---

### 2. `Layer3-Backend/requirements.txt`

**Flexible version dependency list** - for daily development

**Format:**
```
# Core Web Framework
fastapi==0.109.0
uvicorn==0.27.0
starlette==0.35.0

# Data Validation
pydantic==2.6.1
email-validator==2.1.0

# JSON/HTTP utilities
python-multipart==0.0.6
httpx==0.25.2
```

**Characteristics:**
- Contains exact versions of core dependencies
- Does not include transitive dependencies (auto-installed)
- Lower update frequency

**Usage:**
```bash
pip install -r requirements.txt
```

**When to modify:**
- Upgrade or add new libraries
- Fix security vulnerabilities
- Improve compatibility

---

### 3. `Layer3-Backend/requirements-lock.txt`

**Complete dependency lockfile** - for exact environment reproduction

**Contains:**
- All direct dependencies
- All transitive dependencies (auto-installed)
- Exact version numbers

**Example format:**
```
# Core dependencies
fastapi==0.109.0
uvicorn==0.27.0

# Transitive dependencies
annotated-types==0.7.0
anyio==4.13.0
certifi==2026.2.25
charset-normalizer==3.4.7
...
```

**How to generate:**
```bash
# After activating virtual environment
pip freeze > requirements-lock.txt
```

**When to use:**
- Production deployments in Docker/CI
- Need to ensure all developers use identical environment
- Archive specific working version state

**When to update:**
- Regular updates (monthly/quarterly)
- After upgrading dependencies
- After fixing security issues

---

## 🌐 Frontend Configuration Files

### 1. `Layer2-Frontend/donor-app/package.json`

**Node.js project configuration file**

**Key sections:**
```json
{
  "name": "crisislink-donor-app",
  "version": "0.0.1",
  "type": "module",  // ES modules
  
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 3001",
    "build": "vite build",
    "lint": "eslint . --ext .js,.jsx",
    "preview": "vite preview"
  },
  
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "i18next": "^26.0.4",
    "react-i18next": "^17.0.2"
  },
  
  "devDependencies": {
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1",
    "@types/react": "^18.2.43"
  }
}
```

**Version specifier symbols:**
- `^1.2.3` - Compatible with 1.x.x (< 2.0.0)
- `~1.2.3` - Compatible with 1.2.x (< 1.3.0)
- `1.2.3` - Exact version
- `*` - Any version

**When to modify:**
- Add new npm packages
- Upgrade major versions
- Update script commands

**Install dependencies:**
```bash
npm install
npm install --save-dev @new/package  # Add dev dependency
```

---

### 2. `Layer2-Frontend/donor-app/package-lock.json`

**npm dependency lockfile** (auto-generated)

**Characteristics:**
- Auto-generated and managed by npm
- Must be committed to Git
- Ensures all developers use identical versions
- Contains complete dependency tree

**Do not edit manually!**

**Generate/Update:**
```bash
npm install  # Auto-generates if missing
npm update   # Updates all dependencies
```

---

### 3. `Layer2-Frontend/donor-app/vite.config.js`

**Vite build tool configuration**

**Current configuration:**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**When to modify:**
- Add new build plugins
- Configure API proxying
- Customize build environment
- Performance optimization

---

### 4. `Layer2-Frontend/donor-app/.env.local`

**Local environment variables file** (not committed to Git)

**Typical content:**
```
VITE_API_URL=http://localhost:9000/api/v1
VITE_DEBUG=true
```

**Usage in code:**
```javascript
const API_URL = import.meta.env.VITE_API_URL
```

**Notes:**
- Must start with `VITE_` prefix
- `.env.local` typically in git.ignore

---

## 📊 Dependency Version Reference Table

### Backend - Python Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| fastapi | 0.109.0 | Web framework | Lightweight, fast |
| uvicorn | 0.27.0 | ASGI server | Standard for FastAPI |
| starlette | 0.35.0 | Web toolkit | Base library for FastAPI |
| pydantic | 2.6.1 | Data validation | Requires Python 3.12+ |
| email-validator | 2.1.0 | Email validation | Optional but useful |
| python-multipart | 0.0.6 | File upload | For multipart forms |
| httpx | 0.25.2 | HTTP client | Async support |

### Frontend - Node.js Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| react | ^18.2.0 | UI framework | Core |
| react-dom | ^18.2.0 | React DOM | Required |
| react-router-dom | ^6.20.0 | Routing | Navigation |
| axios | ^1.6.0 | HTTP client | API calls |
| i18next | ^26.0.4 | Internationalization | Multi-language support |
| react-i18next | ^17.0.2 | React i18n components | Required |

---

## 🔄 Dependency Update Process

### Security Updates (Recommended)
```bash
# Check available updates
npm outdated              # Frontend
pip list --outdated      # Backend

# Update patch versions
npm update                # Frontend
pip install --upgrade -r requirements.txt  # Backend
```

### Major Version Updates (Use caution)
```bash
# Update to new major version
npm install react@19      # Frontend
pip install --upgrade 'fastapi==0.110'  # Backend

# Run tests to ensure compatibility
npm run build             # Frontend
python -m pytest          # Backend (if tests exist)
```

---

## ✅ Configuration Checklist

Before starting the project, ensure:

- [ ] Python version >= 3.12
  ```bash
  python --version
  ```

- [ ] Node.js version >= 18
  ```bash
  node --version
  ```

- [ ] Virtual environment activated (Backend)
  ```bash
  # Windows
  .\.venv\Scripts\activate
  ```

- [ ] Dependencies installed
  ```bash
  pip list | grep fastapi
  npm list react
  ```

- [ ] Configuration files complete
  ```bash
  ls Layer3-Backend/pyproject.toml
  ls Layer2-Frontend/donor-app/package.json
  ```

---

## 📖 Documentation Navigation

- **Quick Start**: [SETUP.md](SETUP.md)
- **Project Documentation**: [README.md](README.md)
- **Backend Details**: [Layer3-Backend/README.md](Layer3-Backend/README.md)
- **Frontend Details**: [Layer2-Frontend/donor-app/README.md](Layer2-Frontend/donor-app/README.md)
- **System Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

**Last Updated**: April 10, 2026
