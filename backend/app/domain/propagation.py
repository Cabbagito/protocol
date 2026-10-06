"""Shared helpers for propagating changes to future weeks in a mesocycle structure.

Pure functions — no DB, no async. Used by both domain logic (mesocycle_structure.py)
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


def iter_future_exercise_instances(
    structure: dict,
    week_index: int,
    session_index: int,
    exercise_id: str,
) -> Iterator[tuple[int, int, dict]]:
    """Yield (week_index, session_index, exercise) for every non-skipped instance
    of ``exercise_id`` in non-skipped sessions strictly after
    ``(week_index, session_index)``, in natural structure order.
    """
    weeks = structure.get("weeks", [])
    for wi in range(week_index, len(weeks)):
        week = weeks[wi]
        sessions = week.get("sessions", [])
        start_si = session_index + 1 if wi == week_index else 0
        for si in range(start_si, len(sessions)):
            session = sessions[si]
            if session.get("skipped", False):
                continue
            exercise = find_exercise_in_session(session, exercise_id)
            if exercise is None or exercise.get("skipped", False):
                continue
            yield wi, si, exercise


def apply_relative_order(exercises: list[dict], ordered_ids: list[str]) -> list[dict]:
    """Return ``exercises`` re-sequenced so the ones named in ``ordered_ids``
    follow that relative order.

    Only the slots occupied by listed exercises are refilled; exercises not in
    ``ordered_ids`` keep their positions, and listed ids that are missing from
    ``exercises`` are ignored. This lets one order chosen for the current
    session be carried onto future sessions whose exercise lists differ.
    """
    rank = {eid: i for i, eid in enumerate(ordered_ids)}
    movable = sorted(
        (e for e in exercises if e["exercise_id"] in rank),
        key=lambda e: rank[e["exercise_id"]],
    )
    it = iter(movable)
    return [next(it) if e["exercise_id"] in rank else e for e in exercises]
