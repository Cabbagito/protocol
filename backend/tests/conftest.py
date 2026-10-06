"""Shared test fixtures for the protocol backend test suite.

Pure-function tests need nothing from here. DB-backed tests request the
``client`` / ``db`` / ``user`` fixtures, which run against a real PostgreSQL
database named by ``TEST_DATABASE_URL`` (async URL). Once per session the
database is dropped and recreated, migrated with ``alembic upgrade head``
(which validates the migration chain end-to-end) and seeded.

Each test runs inside one outer transaction that is rolled back at the end.
Sessions join it with ``join_transaction_mode="create_savepoint"``, so the
services' own ``commit()`` / ``rollback()`` calls work on savepoints and
nothing leaks between tests. Every request gets a fresh session, as in prod.
"""

import asyncio
import os
import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import pytest
from sqlalchemy.engine import make_url

DEFAULT_TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/protocol_test"
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or DEFAULT_TEST_DATABASE_URL
_TEST_URL = make_url(TEST_DATABASE_URL)
CONNECT_TIMEOUT_S = 5

# The test database is dropped and recreated every session, so refuse to
# point at anything that doesn't look like a throwaway test database.
if not (_TEST_URL.database or "").startswith("protocol_test"):
    raise pytest.UsageError(
        f"TEST_DATABASE_URL must name a database starting with 'protocol_test' "
        f"(got {_TEST_URL.database!r}); it is dropped and recreated on every run."
    )

# app.core.config reads the environment at import time, so this must run
# before anything imports the app. Alembic's env.py reads the same settings.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["APP_PASSWORD"] = ""


def _maintenance_dsn() -> str:
    url = _TEST_URL.set(drivername="postgresql", database="postgres")
    return url.render_as_string(hide_password=False)


async def _recreate_database() -> None:
    import asyncpg

    try:
        conn = await asyncpg.connect(_maintenance_dsn(), timeout=CONNECT_TIMEOUT_S)
    except (OSError, TimeoutError, asyncpg.PostgresError) as exc:
        raise RuntimeError(
            f"Cannot reach the test PostgreSQL server at {_TEST_URL.host}:{_TEST_URL.port} "
            f"({type(exc).__name__}: {exc}). Start Postgres or set TEST_DATABASE_URL."
        ) from exc
    try:
        name = _TEST_URL.database
        await conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()


async def _seed() -> None:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.core.seed import seed_default_splits, seed_exercises, seed_foods

    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    try:
        async with async_sessionmaker(engine, class_=AsyncSession)() as session:
            await seed_exercises(session)
            await seed_foods(session)
            await seed_default_splits(session)
    finally:
        await engine.dispose()


def _prepare_database() -> None:
    from alembic import command

    from app.core.migrations import alembic_config

    asyncio.run(_recreate_database())
    # env.py drives the async engine with asyncio.run, so call it outside a loop.
    command.upgrade(alembic_config(), "head")
    asyncio.run(_seed())


def run_outside_event_loop(fn: Callable[..., object], *args: object) -> object:
    """Run blocking/asyncio.run-based code in a fresh thread with no running loop."""
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(fn, *args).result()


@pytest.fixture(scope="session")
def database() -> str:
    """Create, migrate and seed the test database once per session."""
    run_outside_event_loop(_prepare_database)
    return TEST_DATABASE_URL


@pytest.fixture
async def db_connection(database: str):
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    engine = create_async_engine(
        database, poolclass=NullPool, connect_args={"timeout": CONNECT_TIMEOUT_S}
    )
    try:
        async with engine.connect() as conn:
            trans = await conn.begin()
            try:
                yield conn
            finally:
                if trans.is_active:
                    await trans.rollback()
    finally:
        await engine.dispose()


@pytest.fixture
def session_factory(db_connection):
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    return async_sessionmaker(
        bind=db_connection,
        class_=AsyncSession,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )


@pytest.fixture
async def db(session_factory) -> AsyncIterator:
    """A session for arranging/inspecting data directly. It shares the test's
    transaction with the requests made through ``client``."""
    async with session_factory() as session:
        yield session


@pytest.fixture
async def client(session_factory) -> AsyncIterator:
    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.main import app

    async def _get_test_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)


@dataclass
class AuthedUser:
    id: str
    name: str
    password: str
    headers: dict[str, str]


def _fast_hash(password: str) -> str:
    # Minimum bcrypt cost keeps user creation cheap; checkpw handles any cost.
    import bcrypt

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4)).decode()


@pytest.fixture
def make_user(session_factory) -> Callable[..., Awaitable[AuthedUser]]:
    """Factory: create a user and return it with a bearer-token header."""
    from app.core.security import create_access_token
    from app.models.user import User

    async def _make(name: str = "Test User", password: str | None = None) -> AuthedUser:
        password = password or secrets.token_urlsafe(12)
        async with session_factory() as session:
            user = User(name=name, password_hash=_fast_hash(password))
            session.add(user)
            await session.commit()
            user_id = user.id
        token = create_access_token(user_id)
        return AuthedUser(
            id=user_id,
            name=name,
            password=password,
            headers={"Authorization": f"Bearer {token}"},
        )

    return _make


@pytest.fixture
async def user(make_user) -> AuthedUser:
    return await make_user("Alice")


@pytest.fixture
async def other_user(make_user) -> AuthedUser:
    return await make_user("Bob")
