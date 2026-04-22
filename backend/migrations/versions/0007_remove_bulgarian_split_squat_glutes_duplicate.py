"""remove bulgarian_split_squat_glutes duplicate exercise

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-22

Drops the redundant 'Bulgarian Split Squat (Glutes)' seed exercise and
remaps any references in split_day_exercises and mesocycles.structure
to the canonical 'bulgarian_split_squat' (quads) row.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    orphan_id = conn.execute(
        sa.text("SELECT id FROM exercises WHERE seed_key = 'bulgarian_split_squat_glutes'")
    ).scalar()
    if orphan_id is None:
        return

    replacement_id = conn.execute(
        sa.text("SELECT id FROM exercises WHERE seed_key = 'bulgarian_split_squat'")
    ).scalar()
    if replacement_id is None:
        # Canonical row missing — unsafe to delete. Bail without touching data.
        return

    conn.execute(
        sa.text(
            "UPDATE split_day_exercises SET exercise_id = :new_id "
            "WHERE exercise_id = :old_id"
        ),
        {"new_id": replacement_id, "old_id": orphan_id},
    )

    # Remap any mesocycle.structure JSONB references. Exercise IDs are UUIDs,
    # so a whole-document text replace is safe.
    conn.execute(
        sa.text(
            "UPDATE mesocycles SET structure = "
            "REPLACE(structure::text, :old_id, :new_id)::jsonb "
            "WHERE structure::text LIKE '%' || :old_id || '%'"
        ),
        {"new_id": replacement_id, "old_id": orphan_id},
    )

    conn.execute(sa.text("DELETE FROM exercises WHERE id = :id"), {"id": orphan_id})


def downgrade() -> None:
    # Forward-only fix. Re-inserting the duplicate would re-introduce the bug.
    pass
