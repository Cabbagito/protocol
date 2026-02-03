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

**Currently implemented (Phase 1 - Gym MVP):**
- Exercise CRUD (`/api/exercises`)
  - Pre-seeded with ~50 common exercises on first startup
- Split CRUD with sessions (`/api/splits`)
  - Split contains multiple Sessions (workout days)
  - Session contains multiple SessionExercises (exercise + sets/rep ranges)
  - Session reordering and rest day support
- Mesocycle management (`/api/mesocycles`)
  - Create mesocycles with auto-calculated RiR scheme
  - Only one active mesocycle at a time
  - Week advancement and progress tracking
- Workout logging (`/api/workouts`)
  - Log sets with weight, reps, RiR
  - Get workout template with last weights and progression suggestions
  - Progression algorithm: suggest weight increase when all sets hit 15 reps
  - Exercise progress tracking endpoint

**Frontend pages:**
- Dashboard: Today's workout, active mesocycle, recent workouts
- Exercises: List, add, edit exercises
- Splits: List, create, delete splits
- SplitDetail: Manage sessions and exercises within a split
- Mesocycles: List, create mesocycles
- MesocycleDetail: Week progress, start workouts
- Workout: Log workout with rest timer
- WorkoutDetail: View past workout
- Progress: Charts for volume and exercise progression

## Environment Variables

Backend expects: `DATABASE_URL`, `APP_PASSWORD`, `SECRET_KEY`, `CORS_ORIGINS`, `ANTHROPIC_API_KEY` (future)

## Documentation

**Keep CLAUDE.md updated** when making code changes that affect:
- New models, routers, or API endpoints
- New frontend pages or major components
- Changes to the data model or architecture
- New environment variables or configuration
