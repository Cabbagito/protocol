# Development

## Start

**Prerequisites:** Docker, [bun](https://bun.sh/) (and [uv](https://docs.astral.sh/uv/) to run backend tools on the host)

```bash
# Terminal 1: PostgreSQL + API with hot reload
docker compose up

# Terminal 2: frontend on the host
cd frontend && bun install && bun run dev
```

| Service | URL | Details |
|---------|-----|---------|
| **PostgreSQL** | `localhost:5432` | Data persisted in Docker volume |
| **FastAPI** | `http://localhost:8000` | Hot reload via bind mount; venv in the `backend_venv` volume at `/venv` |
| **Vite** | `http://localhost:5173` | Runs on the host, HMR, proxies `/api` to `localhost:8000` |

Login with password: `devpassword`

The frontend is not containerized: on Docker Desktop for Mac a `node_modules` volume nested inside the `./frontend` bind mount is shared with the host, so host and container installs overwrite each other's native binaries. The backend container keeps its virtualenv at `/venv`, outside the `./backend` bind mount, for the same reason, so `uv sync` on the host and in the container don't interfere.

### Backend on the host

```bash
docker compose up db                     # just the database
cp .env.example backend/.env             # APP_ENV=dev, local DATABASE_URL
cd backend && uv sync && uv run uvicorn app.main:app --reload
```

### Useful commands

```bash
# Backend (tests need PostgreSQL; the protocol_test* database is dropped and recreated)
uv run pytest                                            # Run tests
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/protocol_test uv run pytest
uv run ruff check . && uv run ruff format .              # Lint + format
uv run alembic revision --autogenerate -m "description"  # New migration
uv run alembic upgrade head                              # Apply migrations

# Frontend
bun run test           # Unit tests (vitest)
bun run build          # Production build
bun run lint           # ESLint
```

CI (`.github/workflows/ci.yml`) runs ruff, pytest against a Postgres service and the frontend lint, tests and build, and deploys from `main` only when they pass.

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │            Docker Compose            │
                    │                                      │
  :5173 (dev)       │  ┌───────────┐    ┌───────────────┐  │
  :443  (prod)  ────┼──│   Caddy   │───▸│    FastAPI    │  │
                    │  │  (proxy)  │    │   (backend)   │  │
                    │  └───────────┘    └──────┬────────┘  │
                    │                          │           │
                    │                   ┌──────▾────────┐  │
                    │                   │  PostgreSQL   │  │
                    │                   │    :5432      │  │
                    │                   └───────────────┘  │
                    └──────────────────────────────────────┘

  Dev:  Vite (on the host) serves frontend, proxies /api → backend
  Prod: Caddy serves built React, reverse-proxies /api → backend
```

**Auth:** Multi-user, password-only login (no username field). Each user has a unique password hashed with bcrypt. JWT tokens valid 1 year, user UUID in `sub` claim. Admin user bootstrapped from `APP_PASSWORD` env var on first run; other users are created on the server with `backend/scripts/manage_users.py`.

**Data ownership:** Exercises, splits, mesocycles and foods have a nullable `user_id` FK. `NULL` = shared seed data (visible to all). Non-null = user-owned (visible only to owner).

**Workout data model:** No separate workout log table. Mesocycles store a `structure` JSONB column: `weeks[] → sessions[] → exercises[] → sets[]`. Workouts and meals are saved local-first: every change goes to the phone's storage, then a background queue syncs whole snapshots (idempotent `PUT`s) until the server confirms. Details: [`WORKOUT-LOGIC.md`](WORKOUT-LOGIC.md), [`DIET-LOGIC.md`](DIET-LOGIC.md).

## Deployment

**Production** runs on a VPS with Docker Compose — three containers:

| Container | Role |
|-----------|------|
| **Caddy** | Serves React frontend, reverse-proxies `/api/*` to backend, auto-provisions HTTPS |
| **FastAPI** | Pure API server (no static files), runs Alembic migrations on startup |
| **PostgreSQL** | Persistent data via named Docker volume |

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

### Environment variables

**Production** (`.env` file on the VPS — see `.env.prod.example`):

| Variable | Purpose |
|----------|---------|
| `DOMAIN` | Your domain (Caddy auto-SSL) |
| `DB_PASSWORD` | PostgreSQL password |
| `APP_PASSWORD` | Bootstrap admin user password (only used while no user exists) |
| `SECRET_KEY` | JWT signing key — required; the backend refuses to start if it is empty or a placeholder from this repo (`openssl rand -hex 32`) |
| `ADMIN_NAME` | Admin display name (default: "Admin") |
| `ANTHROPIC_API_KEY` | Optional: meal names and label reading |

`docker-compose.prod.yml` refuses to start without `SECRET_KEY` and `DB_PASSWORD`. Locally, `APP_ENV=dev` (set in `docker-compose.yml` and `.env.example`) allows the placeholder secrets.

## Design

The visual spec is the Protocol design system in Claude Design (linked from `CLAUDE.md`); new screens are designed there before they are built. Tokens live as CSS variables in `frontend/src/index.css` and `frontend/src/lib/themes.ts`.
