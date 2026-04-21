"""add food_items and food_logs tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-21

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "food_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("brand", sa.String(100), nullable=True),
        sa.Column("kcal_per_100g", sa.Float, nullable=False),
        sa.Column("protein_per_100g", sa.Float, nullable=False),
        sa.Column("carbs_per_100g", sa.Float, nullable=False),
        sa.Column("fat_per_100g", sa.Float, nullable=False),
        sa.Column("default_serving_g", sa.Float, nullable=True),
        sa.Column("seed_key", sa.String(100), nullable=True, unique=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "food_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("logged_on", sa.Date, nullable=False),
        sa.Column(
            "food_item_id",
            sa.String(36),
            sa.ForeignKey("food_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("quantity_g", sa.Float, nullable=True),
        sa.Column("kcal", sa.Float, nullable=False),
        sa.Column("protein_g", sa.Float, nullable=False),
        sa.Column("carbs_g", sa.Float, nullable=False),
        sa.Column("fat_g", sa.Float, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_food_logs_user_date", "food_logs", ["user_id", "logged_on"])


def downgrade() -> None:
    op.drop_index("ix_food_logs_user_date", table_name="food_logs")
    op.drop_table("food_logs")
    op.drop_table("food_items")
