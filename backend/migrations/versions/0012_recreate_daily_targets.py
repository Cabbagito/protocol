"""recreate daily_targets if missing

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-24

Self-heal for the same 0010 collision that prompted 0011's IF EXISTS guard:
on prod, alembic_version advanced past 0010 without ``daily_targets`` ever
being created, so the diet targets endpoint 500s. This migration creates
the table (and backfills defaults) only if it isn't already there, so it is
a no-op on any healthy database (dev, fresh installs).

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_PROTEIN_G = 160.0
DEFAULT_CARBS_G = 250.0
DEFAULT_FAT_G = 70.0


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            "SELECT EXISTS ("
            "  SELECT FROM information_schema.tables"
            "  WHERE table_schema = 'public' AND table_name = 'daily_targets'"
            ")"
        )
    ).scalar()
    if exists:
        return

    op.create_table(
        "daily_targets",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("protein_g", sa.Float(), nullable=False),
        sa.Column("carbs_g", sa.Float(), nullable=False),
        sa.Column("fat_g", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    conn.execute(
        sa.text(
            "INSERT INTO daily_targets "
            "(user_id, protein_g, carbs_g, fat_g, created_at, updated_at) "
            "SELECT id, :p, :c, :f, NOW(), NOW() FROM users"
        ),
        {"p": DEFAULT_PROTEIN_G, "c": DEFAULT_CARBS_G, "f": DEFAULT_FAT_G},
    )


def downgrade() -> None:
    # Forward-only self-heal; the original 0010 owns the canonical
    # drop_table in its downgrade.
    pass
