<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/%E2%97%86-Protocol-0ea5e9?style=for-the-badge&labelColor=0d1b2a">
  <img alt="Protocol" src="https://img.shields.io/badge/%E2%97%86-Protocol-0ea5e9?style=for-the-badge&labelColor=0d1b2a">
</picture>

# Protocol

Personal fitness tracking PWA — gym, nutrition, and glucose management.

Built mobile-first with a dark navy UI, animated transitions, and offline-ready PWA support.

```
 ┌─────────────────────────────────────────────────────────┐
 │                                                         │
 │      ◇  Exercises   ◇  Splits   ◇  Mesocycles          │
 │      ◇  Workouts    ◇  Progress Charts                 │
 │      ◇  Rest Timer  ◇  Auto-Progression                │
 │                                                         │
 │      Phase 1: Gym MVP ························ Done ✓   │
 │      Phase 2: Diet Tracking ··················· Soon     │
 │      Phase 3: Glucose Management ·············· Soon     │
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
| **Infra** | Docker Compose — 3 containers (dev & prod) |

## Development

### One Command Start

```bash
docker compose up
```

That's it. This starts:

| Service | URL | Details |
|---------|-----|---------|
| **PostgreSQL** | `localhost:5432` | Data persisted in Docker volume |
| **FastAPI** | `http://localhost:8000` | Hot reload via volume mount |
| **Vite** | `http://localhost:5173` | HMR, proxies `/api` to backend |

Login with password: `devpassword`

### Without Docker

**Prerequisites:** [uv](https://docs.astral.sh/uv/), [bun](https://bun.sh/), Docker (for Postgres)

```bash
# Start just the database
docker compose up db

# Backend (terminal 1)
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Frontend (terminal 2)
cd frontend && bun install && bun run dev
```

### Useful Commands

```bash
# Backend
uv run pytest                                            # Run tests
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
                    │            Docker Compose             │
                    │                                       │
  :5173 (dev)       │  ┌───────────┐    ┌───────────────┐  │
  :443  (prod)  ────┼──│   Caddy   │───▸│    FastAPI     │  │
                    │  │  (proxy)  │    │   (backend)   │  │
                    │  └───────────┘    └──────┬────────┘  │
                    │                          │           │
                    │                   ┌──────▾────────┐  │
                    │                   │  PostgreSQL   │  │
                    │                   │    :5432      │  │
                    │                   └───────────────┘  │
                    └──────────────────────────────────────┘

  Dev:  Vite serves frontend, proxies /api → backend
  Prod: Caddy serves built React, reverse-proxies /api → backend
```

**Auth:** Multi-user, password-only login (no username field). Each user has a unique password hashed with bcrypt. JWT tokens valid 1 year, user UUID in `sub` claim. Admin user bootstrapped from `APP_PASSWORD` env var on first run.

**Data ownership:** Exercises, splits, and mesocycles have a nullable `user_id` FK. `NULL` = shared seed data (visible to all). Non-null = user-owned (visible only to owner).

**Workout data model:** No separate workout log table. Mesocycles store a `structure` JSONB column: `weeks[] → sessions[] → exercises[] → sets[]`. Each set tracks `weight`, `reps`, `target_reps`, `rir`, and `logged` status. Progression is computed eagerly on session save.

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
| `APP_PASSWORD` | Bootstrap admin user password |
| `SECRET_KEY` | JWT signing key |
| `ADMIN_NAME` | Admin display name (default: "Admin") |

## Design System

Navy-based dark theme with sky blue accents and distinct muscle group colors.

```
  Navy Palette                     Accents
  ─────────────────────────        ─────────────────────
  ██ #070d15  Deep (bg)            ██ #38bdf8  Sky light
  ██ #0d1b2a  Base                 ██ #0ea5e9  Sky base
  ██ #0f1d2e  Card                 ██ #0284c7  Sky dark
  ██ #132438  Panel
  ██ #162a3e  Input                Muscle Groups
  ██ #1e3a52  Border               ─────────────────────
                                   ██ Back    ██ Biceps
  Text                             ██ Chest   ██ Triceps
  ─────────────────────────        ██ Quads   ██ Hams
  ██ #e2e8f0  Primary              ██ Glutes  ██ Calves
  ██ #cbd5e1  Secondary            ██ Delts   ██ Core
  ██ #475569  Muted                ██ Traps   ██ Forearms
```

Font: **Inter** (400/500/600/700). Frosted glass bottom nav, vignette overlay, animated splash screen with orbiting dots and layered logo reveal.

Full specification in [`docs/UI-STYLE.md`](docs/UI-STYLE.md).

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
| `GET` | `/api/workouts/template/{id}` | Auto-detect next session |
| `POST` | `/api/workouts/log` | Log sets + trigger progression |
| `GET` | `/api/workouts/history/{id}` | Completed sessions list |
| `GET` | `/api/workouts/progress/{id}` | Weight progression chart data |
| `GET` | `/api/health` | Health check |

All endpoints except `/auth/login` and `/health` require a Bearer JWT token.

## Development Phases

- [x] **Phase 0** — Project scaffolding
- [x] **Phase 1** — Gym MVP: exercises, splits, mesocycles, workout logging with progression, rest timer, set types (straight/myorep/myorep match), exercise replacement, per-exercise notes, progress charts, PWA, splash animation
- [ ] **Phase 2** — Diet tracking: food logging, barcode scan, AI photo estimation
- [ ] **Phase 3** — Glucose management: bolus calculator, pattern analysis
