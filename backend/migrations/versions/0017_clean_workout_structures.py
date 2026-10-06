"""clean workout structures for snapshot saves

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-06

Data-only migration for the switch to snapshot saves and "last time"
targets (no schema change):

- drop ``suggested_weight`` from every set (weight carry-forward is gone;
  the client derives targets from the previous logged session)
- clear ``weight``/``reps`` on unlogged sets: the old client auto-saved
  suggested weights and 0 reps there as "drafts"; left in place they'd show
  as typed-in values instead of grey targets
- a logged set is never also skipped
- clear ``date`` on sessions with nothing logged: the old client re-stamped
  the date whenever a session was merely opened
- stamp ``completed_at`` on mesocycles that are complete under the current
  rules (skipped sets count as done) but were never stamped, using the last
  session date

Downgrade is a no-op: the removed values were derived or stale.
"""

import json
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def _session_done(session: dict) -> bool:
    if session.get("skipped"):
        return False
    return all(
        s.get("logged") or s.get("skipped")
        for ex in session.get("exercises", [])
        if not ex.get("skipped")
        for s in ex.get("sets", [])
    )


def _session_open(session: dict) -> bool:
    return not session.get("skipped") and not _session_done(session)


def _clean(structure: dict) -> tuple[dict, str | None, bool]:
    """Return (structure, last logged date, is complete)."""
    last_date = None
    for week in structure.get("weeks", []):
        for session in week.get("sessions", []):
            has_logged = False
            for ex in session.get("exercises", []):
                for s in ex.get("sets", []):
                    s.pop("suggested_weight", None)
                    if s.get("logged"):
                        has_logged = True
                        s["skipped"] = False
                    else:
                        s["weight"] = None
                        s["reps"] = None
            if not has_logged:
                session["date"] = None
            elif session.get("date") and (last_date is None or session["date"] > last_date):
                last_date = session["date"]

    complete = not any(
        _session_open(s) for w in structure.get("weeks", []) for s in w.get("sessions", [])
    )
    return structure, last_date, complete


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, structure, completed_at FROM mesocycles")).fetchall()
    for row in rows:
        structure = row.structure if isinstance(row.structure, dict) else json.loads(row.structure)
        structure, last_date, complete = _clean(structure)

        completed_at = row.completed_at
        if complete and completed_at is None:
            if last_date:
                completed_at = datetime.fromisoformat(last_date).replace(hour=12, tzinfo=UTC)
            else:
                completed_at = datetime.now(UTC)
        elif not complete:
            completed_at = None

        conn.execute(
            sa.text(
                "UPDATE mesocycles SET structure = CAST(:structure AS jsonb), "
                "completed_at = :completed_at WHERE id = :id"
            ),
            {"structure": json.dumps(structure), "completed_at": completed_at, "id": row.id},
        )


def downgrade() -> None:
    pass
