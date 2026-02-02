# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Protocol is a single-user personal fitness PWA combining gym tracking, nutrition logging, and glucose management. It's a monorepo with a React frontend and FastAPI backend, deployed as a single Docker container.

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

**Database:** PostgreSQL with async SQLAlchemy. Tables auto-create on startup via `Base.metadata.create_all`.

## Key Patterns

**Backend structure:**
- `app/core/` - Config (pydantic-settings), database session, JWT security
- `app/models/` - SQLAlchemy models (inherit from `Base`, `TimestampMixin`)
- `app/routers/` - FastAPI routers, each protected with `Depends(get_current_user)`
- Pydantic schemas defined inline in routers for now

**Frontend structure:**
- `src/api/client.ts` - Fetch wrapper with auto-auth headers and 401 redirect
- `src/lib/auth.ts` - Token storage (localStorage)
- `src/pages/` - Route components
- Tailwind with custom `protocol-*` color palette and `.btn`, `.input`, `.card` component classes

**Docker networking:** Frontend container proxies to `http://backend:8000` via `API_URL` env var.

## Data Model (PRD reference)

Three domains planned:
1. **Gym:** Exercise → SessionExercise → Session → Split → Mesocycle → WorkoutLog
2. **Diet:** FoodItem, FoodLog, DailyTargets (with Claude Vision for photo estimation)
3. **Glucose:** GlucoseSettings, GlucoseLog (insulin calculations)

**Currently implemented:**
- Exercise CRUD (`/api/exercises`)
- Split CRUD with sessions (`/api/splits`)
  - Split contains multiple Sessions (workout days)
  - Session contains multiple SessionExercises (exercise + sets/rep ranges)
  - Session reordering and rest day support

## Environment Variables

Backend expects: `DATABASE_URL`, `APP_PASSWORD`, `SECRET_KEY`, `CORS_ORIGINS`, `ANTHROPIC_API_KEY` (future)

## Documentation

**Keep CLAUDE.md updated** when making code changes that affect:
- New models, routers, or API endpoints
- New frontend pages or major components
- Changes to the data model or architecture
- New environment variables or configuration
