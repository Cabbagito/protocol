# Stage 1: Build frontend with Bun
FROM oven/bun:1-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# Stage 2: Python runtime with uv
FROM ghcr.io/astral-sh/uv:python3.12-alpine AS backend-builder

WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --no-dev --frozen

# Stage 3: Final runtime
FROM python:3.12-alpine

WORKDIR /app

# Copy virtual environment from builder
COPY --from=backend-builder /app/.venv /app/.venv

# Copy backend code
COPY backend/app ./app

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Use the virtual environment
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8080

CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"
