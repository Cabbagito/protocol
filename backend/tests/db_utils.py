"""Database plumbing for the test suite (no app imports at module level)."""

from collections.abc import Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from sqlalchemy.engine import URL

CONNECT_TIMEOUT_S = 5


def plain_dsn(url: URL, database: str | None = None) -> str:
    """asyncpg DSN for ``url`` (optionally pointing at another database)."""
    url = url.set(drivername="postgresql")
    if database is not None:
        url = url.set(database=database)
    return url.render_as_string(hide_password=False)


async def connect(url: URL, database: str | None = None):
    import asyncpg

    try:
        return await asyncpg.connect(plain_dsn(url, database), timeout=CONNECT_TIMEOUT_S)
    except (OSError, TimeoutError, asyncpg.PostgresError) as exc:
        raise RuntimeError(
            f"Cannot reach the test PostgreSQL server at {url.host}:{url.port} "
            f"({type(exc).__name__}: {exc}). Start Postgres or set TEST_DATABASE_URL."
        ) from exc


def _check_name(url: URL) -> str:
    name = url.database or ""
    if not name.startswith("protocol_test"):
        raise RuntimeError(f"Refusing to drop/create non-test database {name!r}")
    return name


async def recreate_database(url: URL) -> None:
    name = _check_name(url)
    conn = await connect(url, "postgres")
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()


async def drop_database(url: URL) -> None:
    name = _check_name(url)
    conn = await connect(url, "postgres")
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
    finally:
        await conn.close()


def run_outside_event_loop(fn: Callable[..., Any], *args: Any) -> Any:
    """Run blocking / ``asyncio.run``-based code in a fresh thread with no loop.

    Alembic's env.py drives its async engine with ``asyncio.run``, which can't
    be nested inside the loop pytest-asyncio may have set up.
    """
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(fn, *args).result()


def run_async(make_coro: Callable[[], Awaitable[Any]]) -> Any:
    """Run a coroutine factory to completion outside any running loop."""
    import asyncio

    async def _main() -> Any:
        return await make_coro()

    return run_outside_event_loop(asyncio.run, _main())
