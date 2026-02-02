# Protocol

Personal fitness tracking PWA - gym, nutrition, and glucose management.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS (via Bun)
- **Backend:** FastAPI + SQLAlchemy async (via uv)
- **Database:** PostgreSQL
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
│   │   ├── api/       # API client
│   │   ├── components/# Reusable components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── lib/       # Utilities
│   │   ├── pages/     # Route pages
│   │   └── types/     # TypeScript types
│   └── package.json
├── backend/           # FastAPI + SQLAlchemy (uv)
│   ├── app/
│   │   ├── core/      # Config, database, security
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API endpoints
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic
│   └── pyproject.toml
├── Dockerfile         # Production build (Railway)
└── docker-compose.yml # Development (hot reload)
```

## Useful Commands

```bash
# Development
docker compose up          # Start everything
docker compose down        # Stop everything
docker compose logs -f     # Follow logs

# Backend (local)
cd backend
uv sync                    # Install dependencies
uv run uvicorn app.main:app --reload  # Run with reload
uv run pytest              # Run tests
uv run ruff check .        # Lint
uv run ruff format .       # Format

# Frontend (local)
cd frontend
bun install                # Install dependencies
bun run dev                # Dev server
bun run build              # Production build
bun run lint               # Lint
```

## Deployment (Railway)

1. Connect your GitHub repo to Railway
2. Set environment variables:
   - `DATABASE_URL` - Supabase PostgreSQL connection string
   - `APP_PASSWORD` - Your login password
   - `SECRET_KEY` - Random string for JWT signing
   - `ANTHROPIC_API_KEY` - For Claude Vision (Phase 2)
3. Deploy - Railway builds the Dockerfile automatically

## Development Phases

- [x] **Phase 0:** Project scaffolding
- [ ] **Phase 1:** Gym MVP (exercises, splits, mesocycles, workout logging)
- [ ] **Phase 2:** Diet tracking (food logging, barcode scan, AI estimation)
- [ ] **Phase 3:** Glucose management (bolus calculator, pattern analysis)
