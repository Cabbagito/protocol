import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import async_session, engine
from app.core.migrations import check_needs_stamp, run_stamp, run_upgrade
from app.core.seed import seed_default_splits, seed_exercises
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
_static_dir: Path | None = None
for _base in [_app_dir, _app_dir.parent]:
    _static = _base / "frontend" / "dist"
    if _static.exists():
        _static_dir = _static
        app.mount("/assets", StaticFiles(directory=_static / "assets"), name="static-assets")
        break


# SPA fallback: serve static files if they exist on disk, otherwise
# return index.html so client-side routing works on hard refresh.
@app.api_route("/{path:path}", methods=["GET"], include_in_schema=False)
async def spa_fallback(request: Request, path: str):
    if _static_dir:
        # Serve actual static files (favicon.svg, sw.js, manifest, etc.)
        file = _static_dir / path
        if file.is_file():
            return FileResponse(file)
        # Otherwise fall back to index.html for SPA routing
        index = _static_dir / "index.html"
        if index.exists():
            return FileResponse(index)
    return {"detail": "Not Found"}
