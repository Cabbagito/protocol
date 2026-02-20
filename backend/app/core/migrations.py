import os

from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.core.database import engine


def _alembic_cfg() -> Config:
    """Build Alembic Config pointing at the backend root."""
    # In production: /app/alembic.ini  In dev: backend/alembic.ini
    ini_path = os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")
    cfg = Config(ini_path)
    # Override script_location to absolute path so it works regardless of cwd
    cfg.set_main_option(
        "script_location",
        os.path.join(os.path.dirname(__file__), "..", "..", "migrations"),
    )
    return cfg


async def check_needs_stamp() -> bool:
    """Detect pre-Alembic database: app tables exist but alembic_version doesn't."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT EXISTS ("
                "  SELECT FROM information_schema.tables"
                "  WHERE table_schema = 'public' AND table_name = 'exercises'"
                ")"
            )
        )
        has_app_tables = result.scalar()
        if not has_app_tables:
            return False

        result = await conn.execute(
            text(
                "SELECT EXISTS ("
                "  SELECT FROM information_schema.tables"
                "  WHERE table_schema = 'public' AND table_name = 'alembic_version'"
                ")"
            )
        )
        has_alembic = result.scalar()
        if not has_alembic:
            return True

        # Table exists but might be empty
        result = await conn.execute(text("SELECT version_num FROM alembic_version"))
        return result.first() is None


def run_stamp() -> None:
    """Stamp the database at head without running migrations."""
    print("Pre-Alembic database detected — stamping current revision as head")
    command.stamp(_alembic_cfg(), "head")


def run_upgrade() -> None:
    """Run Alembic upgrade head."""
    command.upgrade(_alembic_cfg(), "head")
