"""add mesocycles.completed_at

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-14

Adds a nullable ``completed_at`` timestamp to mesocycles, set when the
last session is logged. Used as a tiebreaker / sort key alongside
``started_at`` for the cross-mesocycle exercise history.

Backfill: rows whose JSONB structure has every set ``logged=true`` get
``completed_at = started_at + interval '1 day' * 7 * total_weeks`` as a
best-effort guess. Imperfect (we don't know the real completion date),
but better than NULL when sorting historical mesocycles.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "mesocycles",
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )

    # Backfill: for fully-logged mesocycles, infer a completion timestamp
    # from started_at + (weeks * 7 days). Approximate but good for sorting.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, structure, started_at FROM mesocycles")
    ).fetchall()
    for row in rows:
        structure = row.structure or {}
        weeks = structure.get("weeks") or []
        if not weeks:
            continue
        all_logged = True
        for week in weeks:
            for session in week.get("sessions") or []:
                non_skipped = [
                    ex for ex in (session.get("exercises") or []) if not ex.get("skipped")
                ]
                if not non_skipped:
                    continue
                if not all(s.get("logged") for ex in non_skipped for s in (ex.get("sets") or [])):
                    all_logged = False
                    break
            if not all_logged:
                break
        if all_logged:
            conn.execute(
                sa.text(
                    "UPDATE mesocycles "
                    "SET completed_at = (started_at::timestamp + (:weeks * interval '7 days')) "
                    "WHERE id = :id"
                ),
                {"weeks": len(weeks), "id": row.id},
            )


def downgrade() -> None:
    op.drop_column("mesocycles", "completed_at")
