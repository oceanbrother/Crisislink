# Local Dev Stack Contract

This document defines one stable local setup for the whole project.

## Single Source Of Truth

- Backend service origin is configured once with `VITE_BACKEND_ORIGIN`.
- Frontend API calls use `/api` in local dev.
- Static images use `/static` in local dev.
- Vite proxies both `/api` and `/static` to the same backend origin.

This prevents:
- API hitting one port while static files hit another.
- image-recognition/upload working but listing images breaking.
- story-specific fixes that do not generalize.

## Recommended Local Ports

- Listing service: `127.0.0.1:8000`
- Prediction service: `127.0.0.1:8001`
- Frontend (Vite): `localhost:3004` (auto-fallback if occupied)

## Donor App Env Example

`Layer2-Frontend/donor-app/.env.local`

```bash
VITE_SITE_PASSWORD=CrisisLink2026
VITE_BACKEND_ORIGIN=http://127.0.0.1:8000
VITE_PREDICTION_ORIGIN=http://127.0.0.1:8001
# VITE_API_URL is optional for non-local direct environments only.
```

## Standard Startup

Terminal A (backend):

```bash
cd Layer3-Backend/listing_service
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

Terminal B (prediction service):

```bash
cd Layer3-Backend/prediction_service
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8001
```

Terminal C (frontend):

```bash
cd Layer2-Frontend/donor-app
npm run dev
```

## Quick Health Check

```bash
curl -i "http://127.0.0.1:8000/listings?status=available"
curl -I "http://127.0.0.1:8000/static/README.md"
curl -i "http://127.0.0.1:8001/health"
```

If the backend checks pass, frontend image URLs under `/static/...` should render via Vite proxy.
