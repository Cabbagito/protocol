"""Workout logging — log_sets and update_exercise_performances."""

from datetime import UTC, datetime
from datetime import date as date_type

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.domain.progression import compute_progression, handle_weight_bump
from app.models.base import generate_uuid
from app.models.exercise_performance import ExercisePerformance
from app.services.common import get_user_mesocycle
from app.services.workout_service._helpers import get_session_from_structure


async def update_exercise_performances(db: AsyncSession, user_id: str, session: dict) -> None:
    """Upsert exercise_performances for each non-skipped exercise in a completed session."""
    for exercise in session.get("exercises", []):
        if exercise.get("skipped", False):
            continue

        logged_sets = [
            s for s in exercise.get("sets", []) if s.get("logged") and not s.get("skipped")
        ]
        if not logged_sets:
            continue

        # Use reps from the heaviest set so weight and reps stay paired
        best_set = max(logged_sets, key=lambda s: s.get("weight") or 0)
        working_weight = best_set.get("weight") or 0
        working_reps = best_set.get("reps") or None
        num_sets = len(logged_sets)

        if working_weight == 0:
            continue

        now = datetime.now(UTC)
        stmt = pg_insert(ExercisePerformance).values(
            id=generate_uuid(),
            user_id=user_id,
            exercise_id=exercise["exercise_id"],
            working_weight=working_weight,
            working_reps=working_reps,
            num_sets=num_sets,
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_exercise_performances_user_exercise",
            set_={
                "working_weight": stmt.excluded.working_weight,
                "working_reps": stmt.excluded.working_reps,
                "num_sets": stmt.excluded.num_sets,
                "updated_at": now,
            },
        )
        await db.execute(stmt)


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

    # Apply logged data to the structure (and un-log sets not in payload)
    for exercise in session.get("exercises", []):
        for set_data in exercise.get("sets", []):
            key = (exercise["exercise_id"], set_data["set_num"])
            if key in logged_map:
                log = logged_map[key]
                set_data["weight"] = log.weight
                set_data["reps"] = log.reps
                set_data["rir"] = log.rir
                set_data["logged"] = True
                if log.set_type:
                    set_data["set_type"] = log.set_type
            else:
                set_data["logged"] = False
            set_data["skipped"] = key in skipped_set_keys

    # Only compute progression on explicit end-of-workout
    if complete:
        handle_weight_bump(structure, week_index, session_index)
        compute_progression(structure, week_index, session_index)
        await update_exercise_performances(db, user_id, session)

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok", "session_name": session["session_name"]}
