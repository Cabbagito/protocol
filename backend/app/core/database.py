import ssl

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings

# Use SSL and pgbouncer-compatible settings for remote databases (Supabase, etc.)
connect_args: dict = {}
if "localhost" not in settings.async_database_url and "127.0.0.1" not in settings.async_database_url:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ssl_context
    # Supabase uses pgbouncer on port 6543 which doesn't support prepared statements
    connect_args["statement_cache_size"] = 0

pool_options: dict = {}
if "localhost" not in settings.async_database_url and "127.0.0.1" not in settings.async_database_url:
    # Disable SQLAlchemy's prepared statement cache for pgbouncer compatibility
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
