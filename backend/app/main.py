from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, async_session
from app.core.seed import seed_exercises
from app.models import base  # noqa: F401 - Import to register models
from app.routers import auth, exercises, health, mesocycles, splits, workouts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(base.Base.metadata.create_all)

    # Seed common exercises
    async with async_session() as session:
        added = await seed_exercises(session)
        if added > 0:
            print(f"Seeded {added} common exercises")

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
