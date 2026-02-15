from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session, engine
from app.core.seed import reset_and_reseed, seed_default_splits, seed_exercises
from app.models import base  # noqa: F401 - Import to register models
from app.routers import auth, exercises, health, mesocycles, splits, workouts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(base.Base.metadata.create_all)
        # Add seed_key columns to existing tables (no-op if already present)
        await conn.execute(
            text("ALTER TABLE exercises ADD COLUMN IF NOT EXISTS seed_key VARCHAR(100) UNIQUE")
        )
        await conn.execute(
            text("ALTER TABLE splits ADD COLUMN IF NOT EXISTS seed_key VARCHAR(100) UNIQUE")
        )

    # Seed exercises and default splits
    async with async_session() as session:
        if settings.dev_reset_db:
            await reset_and_reseed(session)
        else:
            count = await seed_exercises(session)
            if count > 0:
                print(f"Seeded/updated {count} exercises")

            added = await seed_default_splits(session)
            if added > 0:
                print(f"Seeded {added} default split(s)")

    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title="Protocol API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(exercises.router, prefix="/api/exercises", tags=["exercises"])
app.include_router(splits.router, prefix="/api/splits", tags=["splits"])
app.include_router(mesocycles.router, prefix="/api/mesocycles", tags=["mesocycles"])
app.include_router(workouts.router, prefix="/api/workouts", tags=["workouts"])

# Serve static files in production
# In Docker: /app/app/main.py → /app/frontend/dist
# In dev:    backend/app/main.py → frontend/dist
_app_dir = Path(__file__).resolve().parent.parent
for _base in [_app_dir, _app_dir.parent]:
    _static = _base / "frontend" / "dist"
    if _static.exists():
        app.mount("/", StaticFiles(directory=_static, html=True), name="static")
        break
