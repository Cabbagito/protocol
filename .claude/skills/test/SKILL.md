---
disable-model-invocation: true
argument-hint: [optional test path or -k filter]
---

# /test — Run Tests in Docker

Ensure Docker is up, then run pytest inside the backend container.

## Steps

1. Run `docker compose ps` to check if the backend container is running.
2. If the backend container is **not running**:
   - Run `docker compose up -d` and wait for the backend to be healthy.
3. Run tests inside the container:
   - If `$ARGUMENTS` is provided, pass it through: `docker compose exec backend uv run pytest $ARGUMENTS`
   - If no arguments, run all tests: `docker compose exec backend uv run pytest`
   - Examples: `/test -k test_login`, `/test app/tests/test_auth.py`, `/test app/tests/ -v`
4. Report results clearly — show pass/fail counts and any failures.
