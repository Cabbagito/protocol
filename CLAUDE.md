# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Protocol is a multi-user personal fitness PWA combining gym tracking and nutrition logging. Monorepo with a React frontend and FastAPI backend, deployed via Docker Compose on a VPS with Caddy (reverse proxy + auto-SSL) and PostgreSQL.

## Development Commands

```bash
# Dev stack: PostgreSQL + API (hot reload) in Docker, Vite on the host
docker compose up                  # db + backend (venv in the backend_venv volume at /venv)
cd frontend && bun install && bun run dev   # Vite proxies /api to localhost:8000

# Backend only (from /backend; needs a backend/.env, e.g. a copy of ../.env.example)
uv sync
uv run uvicorn app.main:app --reload
uv run pytest                      # Run tests (needs PostgreSQL, see Testing)
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

The frontend is not containerized in dev: on Docker Desktop for Mac a `node_modules` (or `.venv`) volume nested inside a bind mount is shared with the host, so host and container installs clobber each other's native binaries. For the same reason the backend container keeps its venv at `/venv` (`UV_PROJECT_ENVIRONMENT`), outside the `./backend:/app` bind mount.

## Testing

`uv run pytest` runs pure-function tests plus DB-backed API tests against a real PostgreSQL. `TEST_DATABASE_URL` (async URL) selects the database, default `postgresql+asyncpg://postgres:postgres@localhost:5432/protocol_test`; its name must start with `protocol_test` because the suite drops and recreates it every run, then applies `alembic upgrade head` and seeds it. Each test runs in a transaction that is rolled back (services' commits become savepoints). Fixtures in `backend/tests/conftest.py`: `client` (httpx over ASGI), `db`, `user` / `other_user` / `make_user` (with bearer headers). `tests/test_migrations.py` also checks that the models match the migrated schema and exercises recent migrations on populated databases. Frontend unit tests use vitest (`cd frontend && bun run test`, files `src/**/*.test.ts`). CI (`.github/workflows/ci.yml`) runs ruff, pytest against a Postgres service and the frontend lint/tests/build, and deploys from `main` only when they pass.

## Architecture

**Split container deployment:** In production, three containers — Caddy serves the React frontend and reverse-proxies `/api/*` to the backend; FastAPI is a pure API server (no static file serving); PostgreSQL for data. In development, Vite runs on the host and proxies `/api` requests to the backend container.

**Auth:** Multi-user password-based JWT with bcrypt hashing. Each user has a unique password (no username). `APP_PASSWORD` env var bootstraps the admin user on first run. JWT `sub` contains the user UUID, tokens valid 1 year. `get_current_user` dependency returns a `User` object. Login (`services/auth_service.py`) checks every user's bcrypt hash in a worker thread; passwords over bcrypt's 72-byte limit simply fail. Failed logins are throttled in-process per client IP (10/minute, then 429); uvicorn trusts Caddy's `X-Forwarded-For` (`--forwarded-allow-ips '*'` in `backend/Dockerfile`) so the IP is the real client's.

**User management:** There is no admin role — every user is identical, and no user-management API exists. Users are managed server-side via `backend/scripts/manage_users.py` (list/create/delete, run with `docker exec` on the server); `scripts/create-user.sh "Name" [password]` wraps creation over SSH. Creating without a password generates a random one, printed once; explicit passwords are rejected if they match an existing user's (passwords identify users at login). Deleting a user cascades to all their data.

**Database:** PostgreSQL with async SQLAlchemy and Alembic migrations. Migrations run automatically on startup (`alembic upgrade head`).

**Frontend layout:** `components/Layout.tsx` is the app shell and owns the screen: the one shared background, the safe-area insets, a status-bar scrim and the floating nav's clearance (contract at the top of `src/index.css`). Pages only lay out content: no backgrounds, viewport heights or nav padding; bars floating above the nav use `bottom: var(--above-nav)`. The document is the scroll container and never shorter than `--screen-h` (`lib/viewport.ts`): iOS 26+ sizes an installed app's window one status-bar short whenever the page is shorter than that (WebKit bug 301108), leaving a dead strip at the bottom. Navigation runs as transitions (`v7_startTransition`), so the current page stays until the next one is ready, and the tab pages are preloaded.

**Backend pattern:** Thin routers delegate to service layer (`app/services/`). Pydantic schemas in `app/schemas/`, one file per domain. Domain logic (progression calculations) isolated in `app/domain/` with no DB dependencies.

## Data Model

**Data ownership:** Exercise, Split, Mesocycle and FoodItem have a nullable `user_id` FK. `NULL` = system/seed data (visible to all users). `<uuid>` = user-created (visible only to owner). Reads filter with `user_id = current OR user_id IS NULL`; writes require `user_id = current` (exercises and foods: shared rows → 403, other users' rows → 404; see `common.get_writable_entity`).

**Exercise** (`/api/exercises`): Pre-seeded exercises (`user_id=NULL`, shared) plus user-created custom ones (`user_id` is returned so the UI can tell them apart). Each has a single `muscle_group` (back, biceps, front delt, rear delt, side delt, chest, triceps, quads, hamstrings, glutes, calves, abs, traps, forearms, obliques) and `equipment_type` (barbell, dumbbell, machine, cable, bodyweight), validated on create/update (`schemas/exercise.py`). Deleting an exercise still used by a split or a mesocycle structure returns 409 (`split_day_exercises.exercise_id` has no ON DELETE action).

**Split** (`/api/splits`): Training template with ordered days. Each day has exercises (no sets/reps — those are a mesocycle concern, defaulting to 3 sets). Tables: `splits` -> `split_days` -> `split_day_exercises`. API accepts/returns nested create/update in one request.

**Mesocycle** (`/api/mesocycles`): Core training block, always user-owned. Stores a `structure` JSONB column: `weeks[] -> sessions[] -> exercises[] -> sets[]`. Each set has `weight`, `reps`, `logged`, `skipped` and optional `set_type`; exercises and sessions can be `skipped`; a session's `date` is the day its first set was logged. No separate WorkoutLog table — all workout data lives in the structure. The structure is self-contained, so `split_id` is nullable and becomes NULL when the split is deleted (`split_name`/`split_color` are then null in responses). At most one mesocycle per user is active (partial unique index `uq_mesocycles_one_active_per_user`); create/activate deactivate the others first and return 409 if a concurrent request won. `completed_at` (timezone-aware) follows completion on every save.

**Workout rules** (full write-up: `docs/WORKOUT-LOGIC.md`): a set is done when logged or skipped; a session is done when every non-skipped exercise's sets are done; a skipped session is passed over. "Where we left off" is the first open session. These rules live in `backend/app/domain/mesocycle_structure.py` and are mirrored in `frontend/src/lib/mesoUtils.ts` — change both together. There is no progression or carry-forward: the client pre-fills the previous logged instance of each exercise as "last time" targets: weight shown as entered, reps grey (`lib/workoutSession.ts`).

**Workout saving (local-first):** `PUT /api/workouts/session` takes the client's full snapshot of one session and is idempotent; it overwrites only the exercises it names (skip flag + full set list, renumbered), carries set-count changes onto matching unstarted future sessions, and never un-logs data it wasn't sent. On the client every change is written to localStorage first (`lib/workoutSync.ts`, one draft per user+session) and a single background queue pushes drafts with retry/backoff; drafts are overlaid on server data in `useMesocycle`/`useActiveMesocycle`, and the TanStack Query cache is persisted (`lib/queryClient.ts`) so the app opens offline. Exercise-list changes (`/workouts/add-exercise`, `replace-exercise`, `remove-exercise`, `reorder-exercises`, `skip-session`, `exercise-note`) stay online-only: the screen syncs the session first, then reloads it from the server.

**Diet** (`/api/foods`, `/api/food-logs`, `/api/me/daily-targets`): Food items (pre-seeded + user-created, same `user_id` visibility pattern), per-day food log entries with denormalized macros, and per-user daily macro targets (kcal derived from macros). Barcode foods are shared (`user_id` NULL) and read-only like seeded ones; `POST /api/foods` with an existing barcode returns that food with 200 (first submission wins). Users may edit/delete only their own custom foods; deleting one keeps its log entries (`food_item_id` → NULL).

## Environment Variables

**Backend:** `DATABASE_URL`, `APP_ENV` (`production` default; `dev` allows placeholder secrets), `APP_PASSWORD` (bootstrap admin password, only used while no user exists; default empty = no bootstrap), `ADMIN_NAME` (admin user display name, default "Admin"), `SECRET_KEY` (startup refuses an empty or placeholder key unless `APP_ENV=dev`), `CORS_ORIGINS`, `ANTHROPIC_API_KEY` (future)

**Production (`.env` file):** `DOMAIN` (Caddy auto-SSL), `DB_PASSWORD`, `APP_PASSWORD`, `SECRET_KEY`, `ADMIN_NAME`. See `.env.prod.example`.

**Docker compose dev:** Hardcoded dev values — `APP_ENV=dev`, `APP_PASSWORD=devpassword`, `ADMIN_NAME=Admin`, local PostgreSQL.

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
