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

**Auth:** Multi-user password-based JWT with bcrypt hashing. Each user has a unique password (no username). `APP_PASSWORD` env var bootstraps the admin user on first run. JWT `sub` contains the user UUID, tokens valid 1 year. `get_current_user` dependency returns a `User` object. Login iterates all users checking bcrypt hashes.

**Database:** PostgreSQL with async SQLAlchemy and Alembic migrations. Migrations run automatically on startup (`alembic upgrade head`).

**Backend pattern:** Thin routers delegate to service layer (`app/services/`). Pydantic schemas in `app/schemas/`, one file per domain. Domain logic (progression calculations) isolated in `app/domain/` with no DB dependencies.

## Data Model

**Data ownership:** Exercise, Split, and Mesocycle have a nullable `user_id` FK. `NULL` = system/seed data (visible to all users). `<uuid>` = user-created (visible only to owner). Reads filter with `user_id = current OR user_id IS NULL`; writes require `user_id = current`.

**Exercise** (`/api/exercises`): Pre-seeded ~78 exercises (`user_id=NULL`, shared). Each has a single `muscle_group` (back, biceps, front delt, rear delt, side delt, chest, triceps, quads, hamstrings, glutes, calves, abs, traps, forearms) and `equipment_type` (barbell, dumbbell, machine, cable, bodyweight).

**Split** (`/api/splits`): Training template with ordered days. Each day has exercises (no sets/reps — those are a mesocycle concern, defaulting to 3 sets). Tables: `splits` -> `split_days` -> `split_day_exercises`. API accepts/returns nested create/update in one request.

**Mesocycle** (`/api/mesocycles`): Core training block, always user-owned. Stores a `structure` JSONB column: `weeks[] -> sessions[] -> exercises[] -> sets[]`. Each set has `weight`, `reps`, `target_reps`, `suggested_weight`, `rir`, and `logged` flag. No separate WorkoutLog table — all workout data lives in the structure.

**"Where we left off":** Scans structure for the first session with any unlogged sets.

**Progression:** Computed eagerly when a session is saved. If all sets hit `target_reps`, next week's `suggested_weight` increases by equipment-specific increment (barbell 2.5, dumbbell 2.0, machine 5.0, cable 2.5).

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

Server access (SSH, hcloud, DB queries, authenticated API calls) requires operator keys — see `CLAUDE.local.md`.

## No backwards compatibility

When changing data models, schemas, or APIs in this codebase, **do not** preserve the old shape. No `_legacy` fields, no dual-write, no deprecated routes kept around, no fallback parsing, no `// removed` comments. Change the code in one pass; let migrations handle the data. If a field/route/type is being removed, delete every reference to it. Only keep an old shape if explicitly asked.
