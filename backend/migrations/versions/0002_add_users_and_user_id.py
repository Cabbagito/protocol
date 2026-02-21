"""add users table and user_id columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Add nullable user_id FK to exercises
    op.add_column("exercises", sa.Column("user_id", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_exercises_user_id", "exercises", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_exercises_user_id", "exercises", ["user_id"])

    # Add nullable user_id FK to splits
    op.add_column("splits", sa.Column("user_id", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_splits_user_id", "splits", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_splits_user_id", "splits", ["user_id"])

    # Add nullable user_id FK to mesocycles
    op.add_column("mesocycles", sa.Column("user_id", sa.String(36), nullable=True))
    op.create_foreign_key(
        "fk_mesocycles_user_id", "mesocycles", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_mesocycles_user_id", "mesocycles", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_mesocycles_user_id", table_name="mesocycles")
    op.drop_constraint("fk_mesocycles_user_id", "mesocycles", type_="foreignkey")
    op.drop_column("mesocycles", "user_id")

    op.drop_index("ix_splits_user_id", table_name="splits")
    op.drop_constraint("fk_splits_user_id", "splits", type_="foreignkey")
    op.drop_column("splits", "user_id")

    op.drop_index("ix_exercises_user_id", table_name="exercises")
    op.drop_constraint("fk_exercises_user_id", "exercises", type_="foreignkey")
    op.drop_column("exercises", "user_id")

    op.drop_table("users")
