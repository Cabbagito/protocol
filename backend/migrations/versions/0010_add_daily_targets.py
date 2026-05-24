"""add daily_targets

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-24

Per-user daily macro targets (protein/carbs/fat in grams). One row per user,
``user_id`` is the primary key. kcal is not stored — derived at the API
boundary as ``protein_g*4 + carbs_g*4 + fat_g*9``.

Backfill: every existing user gets a row with sensible defaults so the
Diet page never sees missing targets after this migration runs.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_PROTEIN_G = 160.0
DEFAULT_CARBS_G = 250.0
DEFAULT_FAT_G = 70.0


def upgrade() -> None:
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

    # Backfill: one default row per existing user.
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO daily_targets "
            "(user_id, protein_g, carbs_g, fat_g, created_at, updated_at) "
            "SELECT id, :p, :c, :f, NOW(), NOW() FROM users"
        ),
        {"p": DEFAULT_PROTEIN_G, "c": DEFAULT_CARBS_G, "f": DEFAULT_FAT_G},
    )


def downgrade() -> None:
    op.drop_table("daily_targets")
