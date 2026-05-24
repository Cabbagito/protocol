"""Workout logging — log_sets."""

from datetime import UTC, datetime
from datetime import date as date_type

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.domain.progression import carry_weight_forward, get_current_position
from app.services.common import get_user_mesocycle
from app.services.workout_service._helpers import get_session_from_structure


async def log_sets(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    sets: list,
    notes: str | None,
    exercise_updates: list | None,
    skipped_sets: list | None,
    draft_sets: list | None,
    complete: bool,
) -> dict:
    """Log sets into the mesocycle structure."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    week, session = get_session_from_structure(structure, week_index, session_index)

    # Update the session date and notes
    session["date"] = date_type.today().isoformat()
    if notes is not None:
        session["notes"] = notes

    # Apply exercise updates (skip/unskip)
    if exercise_updates:
        ex_update_map = {eu.exercise_id: eu for eu in exercise_updates}
        for exercise in session.get("exercises", []):
            eu = ex_update_map.get(exercise["exercise_id"])
            if eu and eu.skipped is not None:
                exercise["skipped"] = eu.skipped

    # Build a lookup of logged sets
    logged_map: dict[tuple[str, int], object] = {}
    for s in sets:
        logged_map[(s.exercise_id, s.set_num)] = s

    # Build skipped sets lookup
    skipped_set_keys: set[tuple[str, int]] = set()
    if skipped_sets:
        skipped_set_keys = {(s.exercise_id, s.set_num) for s in skipped_sets}

    # Build draft sets lookup (unlogged sets with edited reps/weight)
    draft_map: dict[tuple[str, int], object] = {}
    if draft_sets:
        for d in draft_sets:
            draft_map[(d.exercise_id, d.set_num)] = d

    # Apply logged data to the structure (and un-log sets not in payload)
    for exercise in session.get("exercises", []):
        for set_data in exercise.get("sets", []):
            key = (exercise["exercise_id"], set_data["set_num"])
            if key in logged_map:
                log = logged_map[key]
                set_data["weight"] = log.weight
                set_data["reps"] = log.reps
                set_data["logged"] = True
                if log.set_type:
                    set_data["set_type"] = log.set_type
            else:
                set_data["logged"] = False
                draft = draft_map.get(key)
                if draft:
                    if draft.weight is not None:
                        set_data["weight"] = draft.weight
                    if draft.reps is not None:
                        set_data["reps"] = draft.reps
            set_data["skipped"] = key in skipped_set_keys

    # On explicit end-of-workout, carry logged weights into the next instance
    if complete:
        carry_weight_forward(structure, week_index, session_index)

        # Stamp completed_at when the final session of the mesocycle is logged
        if get_current_position(structure).get("completed"):
            mesocycle.completed_at = datetime.now(UTC)

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok", "session_name": session["session_name"]}
