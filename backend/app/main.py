from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine
from app.models import base  # noqa: F401 - Import to register models
from app.routers import auth, exercises, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(base.Base.metadata.create_all)
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

# Serve static files in production
static_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
