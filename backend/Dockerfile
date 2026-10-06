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
COPY scripts ./scripts
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
# Caddy is the only client (the backend publishes no ports) and replaces any
# client-supplied X-Forwarded-For with the real peer address, so trust it.
# Without this, request.client.host is Caddy's container IP for every request
# and the per-IP login throttle would lock everyone out together.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
