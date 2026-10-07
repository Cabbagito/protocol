"""Pure domain functions for the mesocycle ``structure`` JSONB.

No database imports, no async. Operates on plain dicts:
``weeks[] -> sessions[] -> exercises[] -> sets[]``, where each set is
``{set_num, weight, reps, logged, skipped?, set_type?}``.

Semantics (shared with ``frontend/src/lib/mesoUtils.ts``):

- A set is *done* when it is logged or skipped.
- An exercise is *done* when it is skipped, or all of its sets are done.
- A session is *done* when it is not skipped and every exercise is done.
  A skipped session is neither done nor open; it is passed over.
- "Where we left off" is the first open session in structure order.
"""

from datetime import date

from app.domain.propagation import find_exercise_in_session, iter_future_sessions


def blank_set(set_num: int) -> dict:
    return {"set_num": set_num, "weight": None, "reps": None, "logged": False}


def build_mesocycle_structure(
    days,
    exercises_by_id: dict,
    total_weeks: int,
    sets_per_exercise: int = 3,
) -> dict:
    """Build the full nested JSONB structure for a mesocycle. All sets start blank."""
    weeks = []
    for week_idx in range(total_weeks):
        week_sessions = []
        for day in days:
            exercise_entries = []
            for de in sorted(day.exercises, key=lambda x: x.order):
                ex = exercises_by_id.get(de.exercise_id)
                if not ex:
                    continue
                exercise_entries.append(
                    {
                        "exercise_id": ex.id,
                        "exercise_name": ex.name,
                        "muscle_group": ex.muscle_group,
                        "equipment_type": ex.equipment_type,
                        "sets": [blank_set(n) for n in range(1, sets_per_exercise + 1)],
                    }
                )
            week_sessions.append(
                {
                    "session_name": day.name,
                    "day_order": day.day_order,
                    "date": None,
                    "notes": None,
                    "exercises": exercise_entries,
                }
            )

        weeks.append({"week_number": week_idx + 1, "sessions": week_sessions})

    return {"weeks": weeks}


def is_set_done(s: dict) -> bool:
    return bool(s.get("logged")) or bool(s.get("skipped"))


def is_session_skipped(session: dict) -> bool:
    """A session the user explicitly skipped. It is passed over, never logged."""
    return bool(session.get("skipped", False))


def is_session_done(session: dict) -> bool:
    """Every set of every non-skipped exercise is logged or skipped.

    A session whose exercises are all skipped counts as done; a skipped
    session does not (it is neither done nor open, see ``is_session_open``).
    """
    if is_session_skipped(session):
        return False
    return all(
        is_set_done(s)
        for ex in session.get("exercises", [])
        if not ex.get("skipped", False)
        for s in ex.get("sets", [])
    )


def is_session_open(session: dict) -> bool:
    """Still has work to do: not skipped and not done."""
    return not is_session_skipped(session) and not is_session_done(session)


def has_countable_work(session: dict) -> bool:
    """Not skipped, with at least one non-skipped exercise."""
    return not is_session_skipped(session) and any(
        not ex.get("skipped", False) for ex in session.get("exercises", [])
    )


def get_current_position(structure: dict) -> dict:
    """The first open session in structure order ("where we left off")."""
    for wi, week in enumerate(structure.get("weeks", [])):
        for si, session in enumerate(week.get("sessions", [])):
            if is_session_open(session):
                return {"week_index": wi, "session_index": si, "completed": False}
    return {"completed": True}


def is_mesocycle_complete(structure: dict) -> bool:
    return bool(get_current_position(structure).get("completed"))


def derive_fields(structure: dict) -> dict:
    """Derive total_weeks, current_week, workouts_completed from structure."""
    weeks = structure.get("weeks", [])
    total_weeks = len(weeks)

    pos = get_current_position(structure)
    current_week = total_weeks if pos.get("completed") else pos["week_index"] + 1

    workouts_completed = sum(
        1
        for week in weeks
        for session in week.get("sessions", [])
        if is_session_done(session) and has_countable_work(session)
    )

    return {
        "total_weeks": total_weeks,
        "current_week": current_week,
        "workouts_completed": workouts_completed,
    }


def count_total_workouts(structure: dict) -> int:
    """Sessions that can be completed: not skipped, with a non-skipped exercise."""
    return sum(
        1
        for week in structure.get("weeks", [])
        for session in week.get("sessions", [])
        if has_countable_work(session)
    )


def resize_future_sets(
    structure: dict, week_index: int, session: dict, exercise_id: str, new_count: int
) -> None:
    """Carry a set-count change onto the same exercise in matching future
    sessions that haven't been started (no logged sets on that exercise)."""
    for _wi, future_session in iter_future_sessions(
        structure, week_index, session["session_name"], session["day_order"]
    ):
        fe = find_exercise_in_session(future_session, exercise_id)
        if fe is None or any(s.get("logged") for s in fe.get("sets", [])):
            continue
        sets = fe.get("sets", [])[:new_count]
        while len(sets) < new_count:
            sets.append(blank_set(len(sets) + 1))
        for i, s in enumerate(sets, start=1):
            s["set_num"] = i
        fe["sets"] = sets


def apply_session_snapshot(
    structure: dict,
    week_index: int,
    session_index: int,
    *,
    exercises: list[dict],
    logged_on: date,
    apply_to_future: bool = True,
) -> None:
    """Overwrite one session with the client's snapshot of it.

    ``exercises`` is a list of ``{exercise_id, skipped, sets: [...]}`` where
    each set is ``{weight, reps, set_type, logged, skipped}`` in order. The
    snapshot is authoritative for every exercise it names: its skip flag and
    its full set list (sets are renumbered 1..n). Exercises in the session
    that the snapshot doesn't name are left untouched, and snapshot entries
    for exercises no longer in the session are ignored, so a stale or partial
    client can never wipe data it didn't know about.

    A set-count change carries onto matching future sessions that haven't
    been started, unless ``apply_to_future`` is False. The session date is
    the day its first set was logged: it is set from ``logged_on`` when the
    session goes from no logged sets to some, and cleared when no logged sets
    remain. Mutates ``structure`` in place.
    """
    session = structure["weeks"][week_index]["sessions"][session_index]
    had_logged = any(
        s.get("logged") for ex in session.get("exercises", []) for s in ex.get("sets", [])
    )

    by_id = {e["exercise_id"]: e for e in exercises}
    for exercise in session.get("exercises", []):
        snap = by_id.get(exercise["exercise_id"])
        if snap is None:
            continue

        exercise["skipped"] = bool(snap.get("skipped", False))

        old_count = len(exercise.get("sets", []))
        new_sets = []
        for i, s in enumerate(snap["sets"], start=1):
            logged = bool(s.get("logged"))
            entry = {
                "set_num": i,
                "weight": s.get("weight"),
                "reps": s.get("reps"),
                "logged": logged,
                "skipped": bool(s.get("skipped")) and not logged,
            }
            if s.get("set_type"):
                entry["set_type"] = s["set_type"]
            new_sets.append(entry)
        exercise["sets"] = new_sets

        if apply_to_future and len(new_sets) != old_count:
            resize_future_sets(
                structure, week_index, session, exercise["exercise_id"], len(new_sets)
            )

    has_logged = any(
        s.get("logged") for ex in session.get("exercises", []) for s in ex.get("sets", [])
    )
    if not has_logged:
        session["date"] = None
    elif not had_logged or not session.get("date"):
        session["date"] = logged_on.isoformat()
