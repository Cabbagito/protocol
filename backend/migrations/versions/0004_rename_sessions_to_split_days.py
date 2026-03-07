"""rename sessions to split_days and simplify schema

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-07

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rename tables
    op.rename_table("sessions", "split_days")
    op.rename_table("session_exercises", "split_day_exercises")

    # Rename session_id → day_id in split_day_exercises
    op.alter_column("split_day_exercises", "session_id", new_column_name="day_id")

    # Drop columns that are no longer needed
    op.drop_column("split_day_exercises", "sets")
    op.drop_column("split_days", "is_rest_day")


def downgrade() -> None:
    import sqlalchemy as sa

    # Re-add dropped columns
    op.add_column(
        "split_days",
        sa.Column("is_rest_day", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "split_day_exercises", sa.Column("sets", sa.Integer(), nullable=False, server_default="3")
    )

    # Rename day_id → session_id
    op.alter_column("split_day_exercises", "day_id", new_column_name="session_id")

    # Rename tables back
    op.rename_table("split_day_exercises", "session_exercises")
    op.rename_table("split_days", "sessions")
