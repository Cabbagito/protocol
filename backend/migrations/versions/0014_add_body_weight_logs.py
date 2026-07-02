"""add body_weight_logs

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-02

Daily body weight tracking: one entry per user per day, upserted on weigh-in.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "body_weight_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("logged_on", sa.Date, nullable=False),
        sa.Column("weight_kg", sa.Float, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "logged_on", name="uq_body_weight_user_date"),
    )


def downgrade() -> None:
    op.drop_table("body_weight_logs")
