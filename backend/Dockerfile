FROM ghcr.io/astral-sh/uv:python3.12-alpine AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

FROM python:3.12-alpine
WORKDIR /app
COPY --from=builder /app/.venv ./.venv
COPY alembic.ini ./
COPY migrations ./migrations
COPY app ./app
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
