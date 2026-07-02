"""add food_items.barcode

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-02

Barcode-identified foods are shared across users (user_id NULL), so the
barcode is globally unique. Postgres unique indexes allow multiple NULLs,
leaving seeded and non-barcode foods unaffected.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("food_items", sa.Column("barcode", sa.String(32), nullable=True))
    op.create_index("ix_food_items_barcode", "food_items", ["barcode"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_food_items_barcode", table_name="food_items")
    op.drop_column("food_items", "barcode")
