"""Pure domain functions for mesocycle structure building and progression.

No database imports, no async. Operates on plain dicts (the JSONB structure)
and SQLAlchemy model instances used as attribute bags.
"""

import math

from app.domain.constants import RIR_SCHEMES
from app.domain.propagation import iter_future_exercise_instances


def calculate_rir_scheme(total_weeks: int) -> list[int]:
    """Return the RiR scheme for a mesocycle of 3-8 weeks."""
    if total_weeks not in RIR_SCHEMES:
        raise ValueError(f"Unsupported week count: {total_weeks}. Must be 3-8.")
    return RIR_SCHEMES[total_weeks]


def build_mesocycle_structure(
    days,
    exercises_by_id: dict,
    total_weeks: int,
    target_reps: int | None = None,
    sets_per_exercise: int = 3,
    exercise_performances: dict | None = None,
) -> dict:
    """Build the full nested JSONB structure for a mesocycle.

    If exercise_performances is provided (dict mapping exercise_id to ExercisePerformance),
    uses stored working_weight, working_reps, and num_sets for week 1 seeding.
    """
    rir_scheme = calculate_rir_scheme(total_weeks)
    perf_map = exercise_performances or {}

    weeks = []
    for week_idx in range(total_weeks):
        week_rir = rir_scheme[week_idx]
        week_sessions = []
        for day in days:
            exercise_entries = []
            for de in sorted(day.exercises, key=lambda x: x.order):
                ex = exercises_by_id.get(de.exercise_id)
                if not ex:
                    continue

                perf = perf_map.get(ex.id)
                ex_sets = perf.num_sets if perf and perf.num_sets else sets_per_exercise
                ex_target_reps = perf.working_reps if perf and perf.working_reps else target_reps
                ex_suggested = perf.working_weight if perf and perf.working_weight else None

                sets_list = []
                for set_num in range(1, ex_sets + 1):
                    sets_list.append(
                        {
                            "set_num": set_num,
                            "weight": None,
                            "reps": None,
                            "target_reps": ex_target_reps,
                            "suggested_weight": ex_suggested if week_idx == 0 else None,
                            "rir": None,
                            "logged": False,
                        }
                    )
                exercise_entries.append(
                    {
                        "exercise_id": ex.id,
                        "exercise_name": ex.name,
                        "muscle_group": ex.muscle_group,
                        "equipment_type": ex.equipment_type,
                        "technique": None,
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
                "rir": week_rir,
                "sessions": week_sessions,
            }
        )

    return {"weeks": weeks}


def get_current_position(structure: dict) -> dict:
    """Find the current position in the mesocycle structure."""
    for wi, week in enumerate(structure.get("weeks", [])):
        for si, session in enumerate(week.get("sessions", [])):
            non_skipped = [
                ex for ex in session.get("exercises", []) if not ex.get("skipped", False)
            ]
            if not non_skipped:
                # All exercises skipped — session counts as complete
                continue
            all_logged = all(s["logged"] for ex in non_skipped for s in ex.get("sets", []))
            if not all_logged:
                return {"week_index": wi, "session_index": si, "completed": False}
    return {"completed": True}


def handle_weight_bump(structure: dict, week_index: int, session_index: int) -> None:
    """Recalculate target_reps when the user changes weight from suggested.

    Called before compute_progression. For each logged set where the user changed
    the weight from suggested, recalculates target_reps using e1RM equivalence
    and propagates the new weight to all future unlogged instances of the same
    exercise anywhere in the structure (not just the same session slot).

    Mutates the structure in place.
    """
    weeks = structure.get("weeks", [])
    if week_index >= len(weeks):
        return

    session = weeks[week_index]["sessions"][session_index]

    for exercise in session.get("exercises", []):
        if exercise.get("skipped", False):
            continue

        exercise_id = exercise["exercise_id"]

        for s in exercise.get("sets", []):
            if not s.get("logged") or s.get("skipped"):
                continue

            suggested = s.get("suggested_weight")
            actual_weight = s.get("weight") or 0
            if suggested is None or actual_weight == 0:
                continue
            if actual_weight == suggested:
                continue

            # Weight was changed — recalculate target_reps via e1RM
            target = s.get("target_reps")
            if target is None:
                continue
            e1rm = suggested * (1 + target / 30)
            new_reps = math.floor(30 * (e1rm / actual_weight - 1))
            new_reps = max(new_reps, 5)
            s["target_reps"] = new_reps

        # Propagate actual weights to all future unlogged instances of the exercise
        logged_sets = [
            s for s in exercise.get("sets", []) if s.get("logged") and not s.get("skipped")
        ]
        if not logged_sets:
            continue

        for _wi, _si, fe in iter_future_exercise_instances(
            structure, week_index, session_index, exercise_id
        ):
            for fs in fe.get("sets", []):
                if fs.get("logged"):
                    continue
                matching = next(
                    (ls for ls in logged_sets if ls["set_num"] == fs["set_num"]),
                    None,
                )
                if matching and matching.get("weight"):
                    fs["suggested_weight"] = matching["weight"]


def compute_progression(structure: dict, week_index: int, session_index: int) -> None:
    """Compute per-set rep progression from a completed session to the next unlogged
    instance of each exercise anywhere in the structure (deload weeks excluded).

    Algorithm: for each logged set, if reps >= target_reps, the next unlogged
    instance's matching set gets target_reps + 1 (or averaged-up). Weight carries
    forward as suggested_weight.

    Mutates the structure in place.
    """
    weeks = structure.get("weeks", [])
    if week_index >= len(weeks):
        return

    completed_session = weeks[week_index]["sessions"][session_index]

    for exercise in completed_session.get("exercises", []):
        if exercise.get("skipped", False):
            continue

        exercise_id = exercise["exercise_id"]

        # Build set lookup from completed session (exclude skipped sets)
        logged_sets = {
            s["set_num"]: s
            for s in exercise.get("sets", [])
            if s.get("logged") and not s.get("skipped")
        }
        if not logged_sets:
            continue

        next_exercise = next(
            (
                fe
                for _wi, _si, fe in iter_future_exercise_instances(
                    structure,
                    week_index,
                    session_index,
                    exercise_id,
                    skip_deloads=True,
                )
            ),
            None,
        )
        if next_exercise is None:
            continue

        for next_set in next_exercise.get("sets", []):
            if next_set.get("logged"):
                continue

            prev_set = logged_sets.get(next_set["set_num"])
            if not prev_set:
                continue

            # Carry weight forward
            prev_weight = prev_set.get("weight") or 0
            if prev_weight > 0:
                next_set["suggested_weight"] = prev_weight

            # Per-set rep progression
            prev_reps = prev_set.get("reps") or 0
            prev_target = prev_set.get("target_reps")

            if prev_target is None:
                # First workout — actual reps become the baseline
                if prev_reps > 0:
                    next_set["target_reps"] = prev_reps
            elif prev_reps >= prev_target:
                # Met/exceeded — average for faster catch-up, minimum +1
                next_set["target_reps"] = max(
                    prev_target + 1, math.ceil((prev_target + prev_reps) / 2)
                )
            else:
                # Didn't meet — hold target
                next_set["target_reps"] = prev_target


def derive_fields(structure: dict) -> dict:
    """Derive total_weeks, current_week, rir_scheme, workouts_completed from structure."""
    weeks = structure.get("weeks", [])
    total_weeks = len(weeks)
    rir_scheme = [w.get("rir", 0) for w in weeks]

    pos = get_current_position(structure)
    if pos.get("completed"):
        current_week = total_weeks
    else:
        current_week = pos["week_index"] + 1

    current_rir = rir_scheme[current_week - 1] if rir_scheme else 0

    # Count fully-logged sessions (respecting skipped exercises)
    workouts_completed = 0
    for week in weeks:
        for session in week.get("sessions", []):
            non_skipped = [
                ex for ex in session.get("exercises", []) if not ex.get("skipped", False)
            ]
            if not non_skipped:
                continue
            all_logged = all(s["logged"] for ex in non_skipped for s in ex.get("sets", []))
            if all_logged:
                workouts_completed += 1

    return {
        "total_weeks": total_weeks,
        "rir_scheme": rir_scheme,
        "current_week": current_week,
        "current_rir": current_rir,
        "workouts_completed": workouts_completed,
    }
