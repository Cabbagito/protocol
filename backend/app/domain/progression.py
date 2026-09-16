"""Pure domain functions for mesocycle structure building and weight carry-forward.

No database imports, no async. Operates on plain dicts (the JSONB structure)
and SQLAlchemy model instances used as attribute bags.
"""

from app.domain.propagation import iter_future_exercise_instances


def build_mesocycle_structure(
    days,
    exercises_by_id: dict,
    total_weeks: int,
    sets_per_exercise: int = 3,
) -> dict:
    """Build the full nested JSONB structure for a mesocycle.

    All sets start blank — no seeded weights or reps. The first logged set
    of an exercise carries its weight forward into the next instance via
    ``carry_weight_forward``.
    """
    weeks = []
    for week_idx in range(total_weeks):
        week_sessions = []
        for day in days:
            exercise_entries = []
            for de in sorted(day.exercises, key=lambda x: x.order):
                ex = exercises_by_id.get(de.exercise_id)
                if not ex:
                    continue

                sets_list = [
                    {
                        "set_num": set_num,
                        "weight": None,
                        "reps": None,
                        "suggested_weight": None,
                        "logged": False,
                    }
                    for set_num in range(1, sets_per_exercise + 1)
                ]
                exercise_entries.append(
                    {
                        "exercise_id": ex.id,
                        "exercise_name": ex.name,
                        "muscle_group": ex.muscle_group,
                        "equipment_type": ex.equipment_type,
                        "sets": sets_list,
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

        weeks.append(
            {
                "week_number": week_idx + 1,
                "sessions": week_sessions,
            }
        )

    return {"weeks": weeks}


def is_session_skipped(session: dict) -> bool:
    """A session the user explicitly skipped. It is passed over, never logged."""
    return bool(session.get("skipped", False))


def is_session_done(session: dict) -> bool:
    """Every set of every non-skipped exercise is logged.

    A session whose exercises are all skipped counts as done; a skipped
    session does not (it is neither done nor open, see ``is_session_open``).
    """
    if is_session_skipped(session):
        return False
    non_skipped = [ex for ex in session.get("exercises", []) if not ex.get("skipped", False)]
    if not non_skipped:
        return True
    return all(s["logged"] for ex in non_skipped for s in ex.get("sets", []))


def is_session_open(session: dict) -> bool:
    """Still has work to do: not skipped and not fully logged."""
    return not is_session_skipped(session) and not is_session_done(session)


def get_current_position(structure: dict) -> dict:
    """Find the current position in the mesocycle structure.

    The first open session, scanning in order. Skipped sessions and sessions
    whose exercises are all skipped are passed over.
    """
    for wi, week in enumerate(structure.get("weeks", [])):
        for si, session in enumerate(week.get("sessions", [])):
            if is_session_open(session):
                return {"week_index": wi, "session_index": si, "completed": False}
    return {"completed": True}


def carry_weight_forward(structure: dict, week_index: int, session_index: int) -> None:
    """Copy each logged set's weight to the matching set on the next unlogged
    instance of the same exercise anywhere later in the structure.

    No rep handling, no e1RM math. Pure copy-forward as a placeholder/default
    for the user's next session. Mutates the structure in place.
    """
    weeks = structure.get("weeks", [])
    if week_index >= len(weeks):
        return

    completed_session = weeks[week_index]["sessions"][session_index]

    for exercise in completed_session.get("exercises", []):
        if exercise.get("skipped", False):
            continue

        logged_by_set_num = {
            s["set_num"]: s
            for s in exercise.get("sets", [])
            if s.get("logged") and not s.get("skipped")
        }
        if not logged_by_set_num:
            continue

        next_exercise = next(
            (
                fe
                for _wi, _si, fe in iter_future_exercise_instances(
                    structure, week_index, session_index, exercise["exercise_id"]
                )
            ),
            None,
        )
        if next_exercise is None:
            continue

        for next_set in next_exercise.get("sets", []):
            if next_set.get("logged"):
                continue
            prev = logged_by_set_num.get(next_set["set_num"])
            if prev and (prev.get("weight") or 0) > 0:
                next_set["suggested_weight"] = prev["weight"]


def derive_fields(structure: dict) -> dict:
    """Derive total_weeks, current_week, workouts_completed from structure."""
    weeks = structure.get("weeks", [])
    total_weeks = len(weeks)

    pos = get_current_position(structure)
    if pos.get("completed"):
        current_week = total_weeks
    else:
        current_week = pos["week_index"] + 1

    # Count fully-logged sessions. Skipped sessions are neither completed
    # nor counted toward the total (see ``count_total_workouts``).
    workouts_completed = sum(
        1
        for week in weeks
        for session in week.get("sessions", [])
        if is_session_done(session)
        and any(not ex.get("skipped", False) for ex in session.get("exercises", []))
    )

    return {
        "total_weeks": total_weeks,
        "current_week": current_week,
        "workouts_completed": workouts_completed,
    }


def count_total_workouts(structure: dict) -> int:
    """Sessions that can be completed: not skipped, with at least one
    non-skipped exercise."""
    return sum(
        1
        for week in structure.get("weeks", [])
        for session in week.get("sessions", [])
        if not is_session_skipped(session)
        and any(not ex.get("skipped", False) for ex in session.get("exercises", []))
    )
