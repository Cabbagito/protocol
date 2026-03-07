"""add color column to splits

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-07

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("splits", sa.Column("color", sa.String(7), nullable=True))


def downgrade() -> None:
    op.drop_column("splits", "color")
