<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/%E2%97%86-Protocol-0ea5e9?style=for-the-badge&labelColor=0d1b2a">
  <img alt="Protocol" src="https://img.shields.io/badge/%E2%97%86-Protocol-0ea5e9?style=for-the-badge&labelColor=0d1b2a">
</picture>

# Protocol

Personal fitness tracking PWA — gym training and nutrition.

Built mobile-first for an installed iPhone PWA: local-first workout logging
that keeps working with no signal, "last time" targets on every set, and a
diet log with barcode scanning.

```
 ┌─────────────────────────────────────────────────────────┐
 │                                                         │
 │   ◇ Exercises (seeded + custom)   ◇ Splits (templates)  │
 │   ◇ Mesocycles                    ◇ Workout logging     │
 │   ◇ Offline sync                  ◇ Progress            │
 │   ◇ Food log + barcode            ◇ Macro targets       │
 │   ◇ Bodyweight                                          │
 │                                                         │
 └─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS (via Bun) |
| **Backend** | FastAPI + SQLAlchemy async + Alembic migrations (via uv) |
| **Database** | PostgreSQL 16 |
| **Proxy** | Caddy (auto-HTTPS via Let's Encrypt) |
| **Infra** | Docker Compose — Caddy, API and Postgres in prod; Postgres and API in dev (Vite on the host) |

## Development

### Start

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

The frontend is not containerized: on Docker Desktop for Mac a `node_modules` volume nested inside the `./frontend` bind mount is shared with the host, so host and container installs overwrite each other's native binaries. The backend container keeps its virtualenv at `/venv`, outside the `./backend` bind mount, for the same reason, so `uv sync` on the host and in the container no longer interfere.

Coming from the old setup? Run `docker compose up --remove-orphans` once to drop the old frontend container, reinstall host deps (`rm -rf frontend/node_modules && bun install`, plus `uv sync` in `backend/`), and optionally `docker volume rm protocol_backend_cache protocol_frontend_node_modules`.

### Backend on the host

```bash
docker compose up db                     # just the database
cp .env.example backend/.env             # APP_ENV=dev, local DATABASE_URL
cd backend && uv sync && uv run uvicorn app.main:app --reload
```

### Useful Commands

```bash
# Backend (tests need PostgreSQL; the protocol_test* database is dropped and recreated)
uv run pytest                                            # Run tests
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/protocol_test uv run pytest
uv run ruff check . && uv run ruff format .              # Lint + format
uv run alembic revision --autogenerate -m "description"  # New migration
uv run alembic upgrade head                              # Apply migrations

# Frontend
bun run build          # Production build
bun run lint           # ESLint
```

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

**Auth:** Multi-user, password-only login (no username field). Each user has a unique password hashed with bcrypt. JWT tokens valid 1 year, user UUID in `sub` claim. Admin user bootstrapped from `APP_PASSWORD` env var on first run.

**Data ownership:** Exercises, splits, mesocycles and foods have a nullable `user_id` FK. `NULL` = shared seed data (visible to all, read-only). Non-null = user-owned (visible only to owner).

**Workout data model:** No separate workout log table. Mesocycles store a `structure` JSONB column: `weeks[] → sessions[] → exercises[] → sets[]`. Each set tracks `weight`, `reps`, `logged`, `skipped` and an optional set type. Workouts are saved local-first: every change goes to the phone's storage, then a background queue syncs whole-session snapshots (`PUT /api/workouts/session`, idempotent) until the server confirms. How skips, set counts, targets and dates work: [`docs/WORKOUT-LOGIC.md`](docs/WORKOUT-LOGIC.md).

## Project Structure

```
protocol/
├── frontend/                    React + Vite + Tailwind (Bun)
│   ├── src/
│   │   ├── api/client.ts        Fetch wrapper with auth headers
│   │   ├── components/          AppHeader, BottomSheet, MesoGrid,
│   │   │                        SplashScreen, ProtocolMark, Toast, ...
│   │   ├── hooks/               Custom React hooks
│   │   ├── lib/                 Auth, muscle colors, meso utilities
│   │   ├── pages/               12 lazy-loaded route pages
│   │   └── types/               TypeScript interfaces
│   ├── design/                  13 HTML design prototypes
│   └── package.json
│
├── backend/                     FastAPI + SQLAlchemy (uv)
│   ├── app/
│   │   ├── core/                Config, database, security, seed data
│   │   ├── models/              User, Exercise, Split, Mesocycle
│   │   ├── routers/             Auth, exercises, splits, mesocycles,
│   │   │                        workouts, health
│   │   └── services/            Business logic
│   ├── migrations/              Alembic migrations (auto-upgrade on start)
│   └── pyproject.toml
│
├── docs/                        PRD, Go-Live roadmap, UI style guide
├── docker-compose.yml           Development (hot reload)
├── docker-compose.prod.yml      Production (Caddy + auto-SSL)
├── Caddyfile                    Reverse proxy config
├── Dockerfile.caddy             Frontend build + Caddy image
└── backend/Dockerfile           API server image
```

## Deployment

**Production** runs on a VPS with Docker Compose — three containers:

| Container | Role |
|-----------|------|
| **Caddy** | Serves React frontend, reverse-proxies `/api/*` to backend, auto-provisions HTTPS |
| **FastAPI** | Pure API server (no static files), runs Alembic migrations on startup |
| **PostgreSQL** | Persistent data via named Docker volume |

```bash
# Deploy
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

### Environment Variables

**Production** (`.env` file on VPS — see `.env.prod.example`):

| Variable | Purpose |
|----------|---------|
| `DOMAIN` | Your domain (Caddy auto-SSL) |
| `DB_PASSWORD` | PostgreSQL password |
| `APP_PASSWORD` | Bootstrap admin user password (only used while no user exists) |
| `SECRET_KEY` | JWT signing key — required; the backend refuses to start if it is empty or a placeholder from this repo (`openssl rand -hex 32`) |
| `ADMIN_NAME` | Admin display name (default: "Admin") |

`docker-compose.prod.yml` refuses to start without `SECRET_KEY` and `DB_PASSWORD`. Locally, `APP_ENV=dev` (set in `docker-compose.yml` and `.env.example`) allows the placeholder secrets.

## Design System

The implemented design is "v5": themeable dark UI (several themes in Settings) on a static gradient background, Inter + JetBrains Mono, with one color per muscle group. Spec and prototypes: [`docs/design-v5/README.md`](docs/design-v5/README.md). Tokens live as CSS variables in `frontend/src/index.css` and `frontend/src/lib/themes.ts`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Password-only login, returns JWT |
| `GET` | `/api/exercises` | List exercises (shared + user-owned) |
| `POST` | `/api/exercises` | Create exercise |
| `GET` | `/api/splits` | List training templates |
| `POST` | `/api/splits` | Create split with sessions |
| `GET` | `/api/mesocycles` | List user's mesocycles |
| `POST` | `/api/mesocycles` | Create mesocycle from split |
| `GET` | `/api/mesocycles/{id}` | Mesocycle with its full workout structure |
| `PUT` | `/api/workouts/session` | Save one session's snapshot (idempotent) |
| `POST` | `/api/workouts/add-exercise` · `replace-exercise` · `remove-exercise` · `reorder-exercises` | Change a session's exercise list |
| `POST` | `/api/workouts/skip-session` | Skip / restore a whole workout |
| `GET` | `/api/exercises/{id}/history` | Every logged session of an exercise |
| `GET` | `/api/foods` · `/api/food-logs` · `/api/weight-logs` · `/api/me/daily-targets` | Diet |
| `GET` | `/api/health` | Health check |

All endpoints except `/auth/login` and `/health` require a Bearer JWT token.

## Status

Gym tracking and the diet log are in use. What's next: [`docs/ROADMAP.md`](docs/ROADMAP.md).
