# Protocol

Personal fitness tracking PWA - gym, nutrition, and glucose management.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) + SQLAlchemy
- **Database:** PostgreSQL
- **Hosting:** Railway (single Docker container)

## Development Setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (for local Postgres)

### Quick Start

1. **Start the database:**
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. **Set up backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp ../.env.example .env
   # Edit .env with your settings
   uvicorn app.main:app --reload
   ```

3. **Set up frontend (new terminal):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Open the app:**
   - Frontend: http://localhost:5173
   - API docs: http://localhost:8000/docs

### Default Credentials

Password: `devpassword` (change `APP_PASSWORD` in `.env`)

## Project Structure

```
protocol/
├── frontend/           # React + Vite PWA
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/# Reusable components
│   │   ├── hooks/     # Custom React hooks
│   │   ├── lib/       # Utilities
│   │   ├── pages/     # Route pages
│   │   └── types/     # TypeScript types
│   └── public/        # Static assets
├── backend/           # FastAPI
│   └── app/
│       ├── core/      # Config, database, security
│       ├── models/    # SQLAlchemy models
│       ├── routers/   # API endpoints
│       ├── schemas/   # Pydantic schemas
│       └── services/  # Business logic
├── Dockerfile         # Production build
├── docker-compose.yml # Full stack (production-like)
└── docker-compose.dev.yml # Dev database only
```

## Deployment

### Railway

1. Connect your GitHub repo to Railway
2. Set environment variables:
   - `DATABASE_URL` - Supabase PostgreSQL connection string
   - `APP_PASSWORD` - Your login password
   - `SECRET_KEY` - Random string for JWT signing
   - `ANTHROPIC_API_KEY` - For Claude Vision (Phase 2)
3. Deploy - Railway will build the Dockerfile automatically

## Development Phases

- [x] **Phase 0:** Project scaffolding
- [ ] **Phase 1:** Gym MVP (exercises, splits, mesocycles, workout logging)
- [ ] **Phase 2:** Diet tracking (food logging, barcode scan, AI estimation)
- [ ] **Phase 3:** Glucose management (bolus calculator, pattern analysis)
