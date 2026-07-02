"""drop users.is_admin

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-02

There is no admin role: every user is identical, and user management happens
server-side via scripts/manage_users.py rather than through the API.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("users", "is_admin")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean, nullable=False, server_default=sa.false()),
    )
