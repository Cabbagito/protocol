"""remove rir and deload from mesocycle structure

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-14

Strips the per-set ``rir`` field and the week-level ``rir`` field from every
mesocycle.structure JSONB document. RIR scheme and deload semantics are
removed from the product entirely — every week is now a regular training
week.

Forward-only: down-migrating would have to invent RIR/deload values, which
defeats the point of the removal.

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _strip_rir(structure: dict) -> dict:
    for week in structure.get("weeks", []) or []:
        week.pop("rir", None)
        for session in week.get("sessions", []) or []:
            for exercise in session.get("exercises", []) or []:
                for set_data in exercise.get("sets", []) or []:
                    set_data.pop("rir", None)
    return structure


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, structure FROM mesocycles")).fetchall()
    for row in rows:
        if not row.structure:
            continue
        cleaned = _strip_rir(dict(row.structure))
        conn.execute(
            sa.text("UPDATE mesocycles SET structure = CAST(:s AS jsonb) WHERE id = :id"),
            {"s": json.dumps(cleaned), "id": row.id},
        )


def downgrade() -> None:
    # Forward-only. RIR scheme + deload semantics are gone from the codebase;
    # restoring them would have to invent week-by-week RIR values.
    pass
