# Protocol

Personal fitness tracking PWA - gym, nutrition, and glucose management.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS (via Bun)
- **Backend:** FastAPI + SQLAlchemy async (via uv)
- **Database:** Supabase PostgreSQL (production) / Local PostgreSQL (development)
- **Hosting:** Railway (single Docker container)

## Development

### One Command Start

```bash
docker compose up
```

That's it. This starts:
- **PostgreSQL** on port 5432
- **FastAPI backend** on http://localhost:8000 (with hot reload)
- **Vite frontend** on http://localhost:5173 (with HMR)

Login with password: `devpassword`

### Local Development (without Docker)

If you prefer running services locally:

**Prerequisites:** [uv](https://docs.astral.sh/uv/), [bun](https://bun.sh/), Docker (for Postgres)

```bash
# Start just the database
docker compose up db

# Backend (terminal 1)
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Frontend (terminal 2)
cd frontend
bun install
bun run dev
```

## Project Structure

```
protocol/
├── frontend/           # React + Vite + Tailwind (Bun)
│   ├── src/
│   │   ├── api/       # API client with auth
│   │   ├── components/# Shared components (Icons, Toast, Layout)
│   │   ├── hooks/     # Custom React hooks
│   │   ├── lib/       # Utilities (auth)
│   │   ├── pages/     # Route pages (lazy-loaded)
│   │   └── types/     # TypeScript types
│   └── package.json
├── backend/           # FastAPI + SQLAlchemy (uv)
│   ├── app/
│   │   ├── core/      # Config, database, security
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API endpoints + inline Pydantic schemas
│   │   └── services/  # Business logic (seed data)
│   └── pyproject.toml
├── Dockerfile         # Production multi-stage build (Railway)
└── docker-compose.yml # Development (hot reload)
```

## Deployment (Railway + Supabase)

**How it works:** Railway auto-deploys from `main` branch. The Dockerfile builds a single container that serves both the React frontend and FastAPI backend on port 8000.

**Environment variables (Railway dashboard):**
- `DATABASE_URL` - Supabase pooled connection string (`postgresql+asyncpg://...`)
- `APP_PASSWORD` - Login password
- `SECRET_KEY` - Random string for JWT signing
- `CORS_ORIGINS` - `["https://your-domain.railway.app"]`
- `PORT` - Set automatically by Railway (8000)
- `ANTHROPIC_API_KEY` - For Claude Vision (Phase 2, not yet used)

**Database:** Supabase project in eu-central-1. Tables are auto-created by FastAPI on startup. Database is accessed only through the backend API, not through Supabase's PostgREST.

## Development Phases

- [x] **Phase 0:** Project scaffolding
- [x] **Phase 1:** Gym MVP (exercises, splits, mesocycles, workout logging)
- [ ] **Phase 2:** Diet tracking (food logging, barcode scan, AI estimation)
- [ ] **Phase 3:** Glucose management (bolus calculator, pattern analysis)
