"""Shared helpers for propagating changes to future weeks in a mesocycle structure.

Pure functions — no DB, no async. Used by both domain logic (progression.py)
and service layer (workout_service.py).
"""

from collections.abc import Iterator


def iter_future_sessions(
    structure: dict, week_index: int, session_name: str, day_order: int
) -> Iterator[tuple[int, dict]]:
    """Yield (week_index, session) for matching sessions in all weeks after week_index."""
    weeks = structure.get("weeks", [])
    for wi in range(week_index + 1, len(weeks)):
        for session in weeks[wi].get("sessions", []):
            if session["session_name"] == session_name and session["day_order"] == day_order:
                yield wi, session


def find_exercise_in_session(session: dict, exercise_id: str) -> dict | None:
    """Find an exercise dict in a session by exercise_id, or None."""
    return next(
        (e for e in session.get("exercises", []) if e["exercise_id"] == exercise_id),
        None,
    )
