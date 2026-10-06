"""mesocycle and foreign-key hardening

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-06

- ``mesocycles.completed_at`` becomes TIMESTAMPTZ. The code stamps it with an
  aware ``datetime.now(UTC)``, which asyncpg refuses for a naive column (500 on
  finishing the final workout). Existing naive values are interpreted as UTC.
- ``mesocycles.split_id`` becomes nullable with ON DELETE SET NULL. The JSONB
  structure is self-contained, so deleting a split no longer deletes every
  mesocycle (and all workout history) built from it.
- At most one active mesocycle per user, via a partial unique index. Any extra
  active rows are deactivated first, keeping the most recently started one.
- ``split_day_exercises.exercise_id`` loses ON DELETE CASCADE (now NO ACTION):
  deleting an exercise must not silently strip it out of splits; the API
  reports it as 409 instead. User deletion still cascades, because the split
  rows are removed in the same statement.
- ``food_logs.food_item_id`` is ensured to be ON DELETE SET NULL (0006 already
  created it so); logs denormalize name and macros and outlive their food.
- Indexes on FK columns used for joins, ownership lookups and cascades.

Downgrade restores the 0015 schema, but refuses while any mesocycle has lost
its split (``split_id IS NULL``): 0015 requires one and would cascade-delete.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ACTIVE_INDEX = "uq_mesocycles_one_active_per_user"

# (name, table, columns). ix_mesocycles_user_id already exists since 0002 and
# is only ensured here, so downgrade leaves it alone.
NEW_INDEXES = [
    ("ix_split_days_split_id", "split_days", ["split_id"]),
    ("ix_split_day_exercises_day_id", "split_day_exercises", ["day_id"]),
    ("ix_split_day_exercises_exercise_id", "split_day_exercises", ["exercise_id"]),
    ("ix_mesocycles_split_id", "mesocycles", ["split_id"]),
    ("ix_food_logs_food_item_id", "food_logs", ["food_item_id"]),
]


def _find_fk(table: str, column: str) -> dict | None:
    # FK names differ between databases created by 0001 (Postgres-generated,
    # e.g. session_exercises_exercise_id_fkey after the 0004 rename) and older
    # create_all databases, so look them up instead of hard-coding.
    for fk in sa.inspect(op.get_bind()).get_foreign_keys(table):
        if fk["constrained_columns"] == [column]:
            return fk
    return None


def _replace_fk(table: str, column: str, referent: str, ondelete: str | None) -> None:
    existing = _find_fk(table, column)
    if existing is not None:
        op.drop_constraint(existing["name"], table, type_="foreignkey")
    op.create_foreign_key(
        f"{table}_{column}_fkey", table, referent, [column], ["id"], ondelete=ondelete
    )


def upgrade() -> None:
    # a. Timezone-aware completion timestamp; stored naive values were UTC.
    op.alter_column(
        "mesocycles",
        "completed_at",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=True,
        postgresql_using="completed_at AT TIME ZONE 'UTC'",
    )

    # b. A mesocycle outlives its split.
    _replace_fk("mesocycles", "split_id", "splits", ondelete="SET NULL")
    op.alter_column("mesocycles", "split_id", nullable=True, existing_type=sa.String(36))

    # c. One active mesocycle per user. Deactivate any extras first.
    op.execute(
        """
        UPDATE mesocycles SET is_active = false
        WHERE id IN (
            SELECT id FROM (
                SELECT id, row_number() OVER (
                    PARTITION BY user_id
                    ORDER BY started_at DESC, created_at DESC, id DESC
                ) AS rn
                FROM mesocycles
                WHERE is_active AND user_id IS NOT NULL
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.create_index(
        ACTIVE_INDEX,
        "mesocycles",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    # Exercise deletion is blocked while a split uses it.
    _replace_fk("split_day_exercises", "exercise_id", "exercises", ondelete=None)

    # Deleting a food keeps its log entries.
    food_fk = _find_fk("food_logs", "food_item_id")
    if food_fk is None or (food_fk.get("options") or {}).get("ondelete") != "SET NULL":
        _replace_fk("food_logs", "food_item_id", "food_items", ondelete="SET NULL")

    # d. FK indexes.
    for name, table, columns in NEW_INDEXES:
        op.create_index(name, table, columns, if_not_exists=True)
    op.create_index("ix_mesocycles_user_id", "mesocycles", ["user_id"], if_not_exists=True)


def downgrade() -> None:
    orphans = (
        op.get_bind()
        .execute(sa.text("SELECT count(*) FROM mesocycles WHERE split_id IS NULL"))
        .scalar()
    )
    if orphans:
        raise RuntimeError(
            f"Cannot downgrade 0016: {orphans} mesocycle(s) have no split (it was "
            "deleted). Revision 0015 requires mesocycles.split_id; reassign or delete "
            "those mesocycles first."
        )

    for name, table, _columns in reversed(NEW_INDEXES):
        op.drop_index(name, table_name=table, if_exists=True)
    op.drop_index(ACTIVE_INDEX, table_name="mesocycles")

    _replace_fk("split_day_exercises", "exercise_id", "exercises", ondelete="CASCADE")

    _replace_fk("mesocycles", "split_id", "splits", ondelete="CASCADE")
    op.alter_column("mesocycles", "split_id", nullable=False, existing_type=sa.String(36))

    op.alter_column(
        "mesocycles",
        "completed_at",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="completed_at AT TIME ZONE 'UTC'",
    )
