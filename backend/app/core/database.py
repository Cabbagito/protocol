import ssl

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

is_remote = (
    "localhost" not in settings.async_database_url
    and "127.0.0.1" not in settings.async_database_url
    and "@db:" not in settings.async_database_url
)

# Use SSL and pgbouncer-compatible settings for remote databases (Supabase, etc.)
connect_args: dict = {}
if is_remote:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ssl_context
    # Supabase uses pgbouncer which doesn't support prepared statements
    connect_args["statement_cache_size"] = 0

# For remote databases behind pgbouncer/Supavisor, use NullPool to let the
# external pooler manage connections. For local databases, use standard pooling.
pool_options: dict = {}
if is_remote:
    pool_options["poolclass"] = NullPool
else:
    pool_options["pool_size"] = 5
    pool_options["max_overflow"] = 10
    pool_options["pool_timeout"] = 30
    pool_options["pool_recycle"] = 1800
    pool_options["pool_pre_ping"] = True

engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    future=True,
    connect_args=connect_args,
    **pool_options,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
