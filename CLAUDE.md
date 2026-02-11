# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Protocol is a single-user personal fitness PWA combining gym tracking, nutrition logging, and glucose management. Monorepo with a React frontend and FastAPI backend, deployed as a single Docker container on Railway with a Supabase PostgreSQL database.

## Development Commands

```bash
# Start full stack (recommended)
docker compose up

# Backend only (from /backend)
uv sync
uv run uvicorn app.main:app --reload
uv run pytest                      # Run tests
uv run pytest path/to/test.py -k "test_name"  # Single test
uv run ruff check .                # Lint
uv run ruff format .               # Format

# Frontend only (from /frontend)
bun install
bun run dev
bun run build
bun run lint
```

## Architecture

**Single container deployment:** FastAPI serves both `/api/*` routes and React static files in production. In development, Vite proxies `/api` requests to the backend container.

**Auth:** Simple password-based JWT (single user). Password from `APP_PASSWORD` env var, tokens valid 1 year.

**Database:** Supabase-hosted PostgreSQL with async SQLAlchemy. Tables auto-create on startup via `Base.metadata.create_all`. Connection uses SSL with pgbouncer compatibility (`statement_cache_size=0`).

## Infrastructure

**Local dev (docker compose):** Three containers — PostgreSQL on :5432, FastAPI on :8000, Vite on :5173. Frontend proxies `/api` to `http://backend:8000`.

**Production (Railway):** Single Docker container. Multi-stage build: bun builds frontend, uv installs backend deps, python:alpine runs everything. FastAPI serves React static files from `/frontend/dist` and API from `/api`. Listens on port 8000 (Railway's `PORT` env var).

**Database (Supabase):** Project `wjrugbqldyedubliygew` in eu-central-1. DB accessed only through FastAPI backend (not PostgREST). RLS is disabled since all access goes through the backend's JWT auth.

## Key Patterns

**Backend structure:**
- `app/core/` - Config (pydantic-settings), database session, JWT security
- `app/models/` - SQLAlchemy models (inherit from `Base`, `TimestampMixin`)
- `app/routers/` - FastAPI routers, each protected with `Depends(get_current_user)`
- Pydantic schemas defined inline in routers

**Frontend structure:**
- `src/api/client.ts` - Fetch wrapper with auto-auth headers and 401 redirect
- `src/lib/auth.ts` - Token storage (localStorage)
- `src/components/Icons.tsx` - Shared SVG icon components (all icons live here)
- `src/components/Toast.tsx` - Error toast notification system
- `src/pages/` - Route pages (lazy-loaded via React.lazy)
- Tailwind with custom `protocol-*` color palette and `.btn`, `.input`, `.card` component classes

**Docker networking:** Frontend container proxies to `http://backend:8000` via `API_URL` env var.

## Data Model

Three domains planned:
1. **Gym:** Exercise -> SessionExercise -> Session -> Split -> Mesocycle -> WorkoutLog
2. **Diet:** FoodItem, FoodLog, DailyTargets (with Claude Vision for photo estimation)
3. **Glucose:** GlucoseSettings, GlucoseLog (insulin calculations)

**Currently implemented (Phase 1 - Gym MVP):**
- Exercise CRUD (`/api/exercises`) — pre-seeded with ~50 common exercises
- Split CRUD with sessions (`/api/splits`) — sessions contain exercises with set/rep config
- Mesocycle management (`/api/mesocycles`) — auto-calculated RiR scheme, one active at a time
- Workout logging (`/api/workouts`) — log sets, progression suggestions, exercise progress tracking

**Frontend pages:**
- Dashboard, Exercises, Splits, SplitDetail, Mesocycles, MesocycleDetail
- Workout (log with rest timer), WorkoutDetail, Progress (charts)

## Environment Variables

**Backend:** `DATABASE_URL`, `APP_PASSWORD`, `SECRET_KEY`, `CORS_ORIGINS`, `ANTHROPIC_API_KEY` (future)

**Railway production:** Same as above, plus `PORT=8000` (set by Railway). `DATABASE_URL` points to Supabase pooled connection string.

**Docker compose dev:** Hardcoded dev values — `APP_PASSWORD=devpassword`, local PostgreSQL.

## Git Conventions

**Branch naming:** `feat/description`, `fix/description`, `chore/description`, `refactor/description`

**Commit messages:** Use conventional commits:
- `feat: add diet logging page`
- `fix: correct progression threshold logic`
- `chore: update dependencies`
- `refactor: extract shared icon components`

**Do NOT include** the `Co-Authored-By` footer in commit messages.

**Workflow:** Work on feature/fix branches, merge to `main`. Railway auto-deploys from `main`.

## Documentation

**Keep CLAUDE.md updated** when making changes that affect:
- New models, routers, or API endpoints
- New frontend pages or major components
- Changes to the data model or architecture
- New environment variables or configuration
- Infrastructure or deployment changes
