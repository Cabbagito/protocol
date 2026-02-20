import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import async_session, engine
from app.core.migrations import check_needs_stamp, run_stamp, run_upgrade
from app.core.seed import ensure_admin_user, seed_default_splits, seed_exercises
from app.models import base  # noqa: F401 - Import to register models
from app.routers import auth, exercises, health, mesocycles, splits, workouts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run Alembic migrations (sync — needs its own event loop in a thread)
    if await check_needs_stamp():
        await asyncio.to_thread(run_stamp)
    else:
        await asyncio.to_thread(run_upgrade)

    # Seed exercises and default splits
    async with async_session() as session:
        count = await seed_exercises(session)
        if count > 0:
            print(f"Seeded/updated {count} exercises")

        added = await seed_default_splits(session)
        if added > 0:
            print(f"Seeded {added} default split(s)")

        await ensure_admin_user(session)

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
