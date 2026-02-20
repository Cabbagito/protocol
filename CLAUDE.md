# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Protocol is a multi-user personal fitness PWA combining gym tracking, nutrition logging, and glucose management. Monorepo with a React frontend and FastAPI backend, deployed via Docker Compose on a VPS with Caddy (reverse proxy + auto-SSL) and PostgreSQL.

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

# Alembic migrations (from /backend)
uv run alembic revision --autogenerate -m "description"  # Generate migration
uv run alembic upgrade head        # Apply migrations
uv run alembic current             # Show current revision
uv run alembic history             # Show migration history

# Frontend only (from /frontend)
bun install
bun run dev
bun run build
bun run lint
```

## Architecture

**Split container deployment:** In production, three containers — Caddy serves the React frontend and reverse-proxies `/api/*` to the backend; FastAPI is a pure API server (no static file serving); PostgreSQL for data. In development, Vite proxies `/api` requests to the backend container.

**Auth:** Multi-user password-based JWT with bcrypt hashing. Each user has a unique password. `APP_PASSWORD` env var bootstraps the admin user on first run. JWT `sub` contains the user UUID, tokens valid 1 year. `get_current_user` dependency returns a `User` object. Login iterates all users checking bcrypt hashes.

**Database:** PostgreSQL with async SQLAlchemy and Alembic migrations. Migrations run automatically on startup (`alembic upgrade head`). In development, PostgreSQL runs in Docker; in production, VPS-hosted PostgreSQL via Docker Compose.

## Infrastructure

**Local dev (`docker-compose.yml`):** Three containers — PostgreSQL on :5432, FastAPI on :8000, Vite on :5173. Frontend proxies `/api` to `http://backend:8000`. Hot reload via volume mounts.

**Production (`docker-compose.prod.yml`):** Three containers — PostgreSQL, FastAPI (no exposed ports), Caddy on :80/:443. Caddy serves the baked-in React frontend, reverse-proxies `/api/*` to backend, and auto-provisions SSL via Let's Encrypt. `backend/Dockerfile` builds the API image; `Dockerfile.caddy` builds frontend + Caddy image. All secrets via `.env` file (see `.env.prod.example`).

**Database:** PostgreSQL, accessed only through FastAPI backend. Runs as a Docker container in both dev and production.

## Key Patterns

**Backend structure:**
- `app/core/` - Config (pydantic-settings), database session, JWT security (bcrypt + passlib)
- `app/models/` - SQLAlchemy models (inherit from `Base`, `TimestampMixin`); `User` model for auth
- `app/routers/` - FastAPI routers, each protected with `Depends(get_current_user)` which returns a `User`
- Pydantic schemas defined inline in routers

**Frontend structure:**
- `src/api/client.ts` - Fetch wrapper with auto-auth headers and 401 redirect
- `src/lib/auth.ts` - Token + UserInfo storage (localStorage)
- `src/components/Icons.tsx` - Shared SVG icon components (all icons live here)
- `src/components/Toast.tsx` - Error toast notification system
- `src/pages/` - Route pages (lazy-loaded via React.lazy)
- Tailwind with custom `protocol-*` color palette and `.btn`, `.input`, `.card` component classes

**Docker networking:** Frontend container proxies to `http://backend:8000` via `API_URL` env var.

## Data Model

Three domains planned:
1. **Gym:** Exercise, Split/Session/SessionExercise, Mesocycle (with JSONB structure)
2. **Diet:** FoodItem, FoodLog, DailyTargets (with Claude Vision for photo estimation)
3. **Glucose:** GlucoseSettings, GlucoseLog (insulin calculations)

**Currently implemented (Phase 1 - Gym MVP):**

**User** (`users` table): Multi-user auth. Fields: `id` (UUID), `name`, `password_hash` (bcrypt), `is_admin`. Admin user is bootstrapped from `APP_PASSWORD` on first run via `ensure_admin_user()`.

**Data ownership:** Exercise, Split, and Mesocycle have a nullable `user_id` FK. `NULL` = system/seed data (visible to all users). `<uuid>` = user-created (visible only to owner). Queries use `WHERE user_id = current_user.id OR user_id IS NULL` for reads, `WHERE user_id = current_user.id` for writes.

**Exercise** (`/api/exercises`): Pre-seeded ~50 exercises (`user_id=NULL`, shared). User-created exercises have `user_id` set. Each has a single `muscle_group` string (one of: back, biceps, front delt, rear delt, side delt, chest, triceps, quads, hamstrings, glutes, calves, abs, traps, forearms) and `equipment_type` (barbell, dumbbell, machine, cable, bodyweight).

**Split** (`/api/splits`): Training template with ordered sessions. Each session has exercises with `sets` count (no rep ranges — rep targets are set per-set in the mesocycle structure). Seed splits (`user_id=NULL`) are shared; user-created splits have `user_id` set.

**Mesocycle** (`/api/mesocycles`): Core training block. Always owned by a user (`user_id` set on creation). Stores a `structure` JSONB column containing the entire nested document: `weeks[] → sessions[] → exercises[] → sets[]`. Each set has `weight`, `reps`, `target_reps`, `suggested_weight`, `rir`, and `logged` flag. No separate WorkoutLog table — all workout data lives in the structure. `is_active` bulk updates are scoped to current user.

Key derived fields (computed from structure, not stored): `total_weeks`, `current_week`, `rir_scheme`, `current_rir`, `workouts_completed`.

**"Where we left off" algorithm:** Scans structure for the first session with any unlogged sets — determines current position automatically.

**Progression:** Computed eagerly when a session is saved. If all sets hit `target_reps`, next week's `suggested_weight` increases by equipment-specific increment (barbell 2.5, dumbbell 2.0, machine 5.0, cable 2.5).

**Workout endpoints** (`/api/workouts`):
- `GET /template/{meso_id}` — auto-detect next session
- `GET /template/{meso_id}/{week}/{session}` — specific session
- `POST /log` — log sets into structure, triggers progression
- `GET /history/{meso_id}` — list of completed sessions
- `GET /detail/{meso_id}/{week}/{session}` — view logged session
- `GET /progress/{exercise_id}` — weight progression across all mesos

**DB reset:** For a full reset in dev, use `docker compose down -v && docker compose up` to drop volumes and re-run migrations from scratch.

**Frontend pages:**
- Dashboard, Exercises, Splits, SplitDetail, Mesocycles, MesocycleDetail
- Workout (log with rest timer), WorkoutDetail, Progress (charts)
- Settings (current user name, logout button)

**Frontend routes:**
- `/workout/:mesocycleId` — log workout (auto-detects next session, supports `?week=N&session=N` query params for specific session)
- `/workouts/:mesocycleId/:weekIndex/:sessionIndex` — view completed workout detail

## Environment Variables

**Backend:** `DATABASE_URL`, `APP_PASSWORD` (bootstrap admin password), `ADMIN_NAME` (admin user display name, default "Admin"), `SECRET_KEY`, `CORS_ORIGINS`, `ANTHROPIC_API_KEY` (future)

**Production (`.env` file):** `DOMAIN` (Caddy auto-SSL), `DB_PASSWORD`, `APP_PASSWORD`, `SECRET_KEY`, `ADMIN_NAME`. See `.env.prod.example`.

**Docker compose dev:** Hardcoded dev values — `APP_PASSWORD=devpassword`, `ADMIN_NAME=Admin`, local PostgreSQL.

## Git Conventions

**Branch naming:** `feat/description`, `fix/description`, `chore/description`, `refactor/description`

**Commit messages:** Use conventional commits:
- `feat: add diet logging page`
- `fix: correct progression threshold logic`
- `chore: update dependencies`
- `refactor: extract shared icon components`

**Do NOT include** the `Co-Authored-By` footer in commit messages.

**Workflow:** Work on feature/fix branches, merge to `main`.

## Documentation

**Keep CLAUDE.md updated** when making changes that affect:
- New models, routers, or API endpoints
- New frontend pages or major components
- Changes to the data model or architecture
- New environment variables or configuration
- Infrastructure or deployment changes
