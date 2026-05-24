"""drop exercise_performances table

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-24

The progression system (target_reps + cross-meso working-weight memory) was
removed. The only remaining weight convenience is per-meso carry-forward,
which lives in the JSONB structure. The exercise_performances table is no
longer read or written, so we drop it.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("exercise_performances")


def downgrade() -> None:
    op.create_table(
        "exercise_performances",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "exercise_id",
            sa.String(36),
            sa.ForeignKey("exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("working_weight", sa.Float, nullable=True),
        sa.Column("working_reps", sa.Integer, nullable=True),
        sa.Column("num_sets", sa.Integer, nullable=True),
        sa.Column("weight_increment", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "user_id", "exercise_id", name="uq_exercise_performances_user_exercise"
        ),
    )
