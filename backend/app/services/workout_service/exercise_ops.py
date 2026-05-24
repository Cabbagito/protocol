"""Exercise management — replace, add, remove, reorder, modify_sets, update_note."""

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.domain.propagation import find_exercise_in_session, iter_future_sessions
from app.models.exercise import Exercise
from app.services.common import get_user_mesocycle
from app.services.workout_service._helpers import get_session_from_structure


async def update_exercise_note(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    exercise_id: str,
    note: str | None,
) -> dict:
    """Update or remove a meso-wide exercise note."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    if "exercise_notes" not in structure:
        structure["exercise_notes"] = {}

    if note:
        structure["exercise_notes"][exercise_id] = note
    else:
        structure["exercise_notes"].pop(exercise_id, None)

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}


async def replace_exercise(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    exercise_index: int,
    old_exercise_id: str,
    new_exercise_id: str,
    apply_to_future: bool,
) -> dict:
    """Replace an exercise in the mesocycle structure."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    # Look up new exercise (scoped to visible exercises)
    ex_result = await db.execute(
        select(Exercise).where(
            Exercise.id == new_exercise_id,
            or_(Exercise.user_id == user_id, Exercise.user_id.is_(None)),
        )
    )
    new_exercise = ex_result.scalar_one_or_none()
    if not new_exercise:
        raise HTTPException(status_code=404, detail="New exercise not found")

    structure = mesocycle.structure
    week, session = get_session_from_structure(structure, week_index, session_index)
    exercises = session.get("exercises", [])

    if exercise_index >= len(exercises):
        raise HTTPException(status_code=400, detail="Invalid exercise index")

    target_ex = exercises[exercise_index]
    if target_ex["exercise_id"] != old_exercise_id:
        raise HTTPException(status_code=400, detail="Exercise ID mismatch")

    session_name = session["session_name"]
    day_order = session["day_order"]

    def replace_in_exercise(ex_data: dict) -> None:
        ex_data["exercise_id"] = new_exercise.id
        ex_data["exercise_name"] = new_exercise.name
        ex_data["muscle_group"] = new_exercise.muscle_group
        ex_data["equipment_type"] = new_exercise.equipment_type

        for s in ex_data.get("sets", []):
            if not s.get("logged"):
                s["weight"] = None
                s["reps"] = None
                s["suggested_weight"] = None

    # Replace in current week
    replace_in_exercise(target_ex)

    # If apply_to_future, replace in all subsequent weeks
    if apply_to_future:
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session_name, day_order
        ):
            fe = find_exercise_in_session(future_session, old_exercise_id)
            if fe:
                replace_in_exercise(fe)

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}


async def modify_sets(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    exercise_id: str,
    action: str,
    set_num: int | None,
) -> dict:
    """Add or remove a set from an exercise, propagating to future unlogged weeks."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    week, session = get_session_from_structure(structure, week_index, session_index)

    session_name = session["session_name"]
    day_order = session["day_order"]

    # Find the target exercise
    target_exercise = None
    for ex in session.get("exercises", []):
        if ex["exercise_id"] == exercise_id:
            target_exercise = ex
            break

    if not target_exercise:
        raise HTTPException(status_code=404, detail="Exercise not found in session")

    sets_list = target_exercise.get("sets", [])

    if action == "add":
        # Clone from last set
        last_set = sets_list[-1] if sets_list else {}
        new_set = {
            "set_num": len(sets_list) + 1,
            "weight": None,
            "reps": None,
            "suggested_weight": last_set.get("suggested_weight"),
            "logged": False,
            "set_type": None,
        }
        sets_list.append(new_set)
        target_exercise["sets"] = sets_list
        new_set_count = len(sets_list)

        # Propagate to future weeks
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session_name, day_order
        ):
            fe = find_exercise_in_session(future_session, exercise_id)
            if not fe:
                continue
            future_sets = fe.get("sets", [])
            has_logged = any(s.get("logged") for s in future_sets)
            if not has_logged and len(future_sets) < new_set_count:
                last_fs = future_sets[-1] if future_sets else {}
                future_sets.append(
                    {
                        "set_num": len(future_sets) + 1,
                        "weight": None,
                        "reps": None,
                        "suggested_weight": last_fs.get("suggested_weight"),
                        "logged": False,
                        "set_type": None,
                    }
                )
                fe["sets"] = future_sets

    elif action == "remove":
        if set_num is None:
            raise HTTPException(status_code=400, detail="set_num required for remove action")

        if len(sets_list) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the only set")

        target_set = None
        for s in sets_list:
            if s["set_num"] == set_num:
                target_set = s
                break

        if not target_set:
            raise HTTPException(status_code=400, detail="Set not found")

        if target_set.get("logged"):
            raise HTTPException(status_code=400, detail="Cannot remove a logged set")

        sets_list.remove(target_set)
        # Renumber
        for i, s in enumerate(sets_list):
            s["set_num"] = i + 1
        target_exercise["sets"] = sets_list
        new_set_count = len(sets_list)

        # Propagate to future weeks
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session_name, day_order
        ):
            fe = find_exercise_in_session(future_session, exercise_id)
            if not fe:
                continue
            future_sets = fe.get("sets", [])
            has_logged = any(s.get("logged") for s in future_sets)
            if not has_logged and len(future_sets) > new_set_count:
                # Remove last unlogged set
                future_sets.pop()
                for i, s in enumerate(future_sets):
                    s["set_num"] = i + 1
                fe["sets"] = future_sets

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {
        "status": "ok",
        "exercise_id": exercise_id,
        "sets": target_exercise["sets"],
    }


async def add_exercise(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    exercise_id: str,
    apply_to_future: bool,
) -> dict:
    """Add a new exercise to a session in the mesocycle structure."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    # Look up exercise (scoped to visible exercises)
    ex_result = await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            or_(Exercise.user_id == user_id, Exercise.user_id.is_(None)),
        )
    )
    exercise = ex_result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    num_sets = 3

    def build_exercise_entry() -> dict:
        sets = [
            {
                "set_num": i + 1,
                "weight": None,
                "reps": None,
                "suggested_weight": None,
                "logged": False,
                "set_type": None,
            }
            for i in range(num_sets)
        ]
        return {
            "exercise_id": exercise.id,
            "exercise_name": exercise.name,
            "muscle_group": exercise.muscle_group,
            "equipment_type": exercise.equipment_type,
            "sets": sets,
        }

    structure = mesocycle.structure
    week, session = get_session_from_structure(structure, week_index, session_index)
    session_name = session["session_name"]
    day_order = session["day_order"]

    new_entry = build_exercise_entry()
    session.setdefault("exercises", []).append(new_entry)

    if apply_to_future:
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session_name, day_order
        ):
            existing_ids = {e["exercise_id"] for e in future_session.get("exercises", [])}
            if exercise_id not in existing_ids:
                future_session.setdefault("exercises", []).append(build_exercise_entry())

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok", "exercise": new_entry}


async def reorder_exercise(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    exercise_index: int,
    direction: str,
    apply_to_future: bool,
) -> dict:
    """Move an exercise up or down within a session."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    week, session = get_session_from_structure(structure, week_index, session_index)
    exercises = session.get("exercises", [])

    if exercise_index >= len(exercises):
        raise HTTPException(status_code=400, detail="Invalid exercise index")

    swap_index = exercise_index - 1 if direction == "up" else exercise_index + 1
    if swap_index < 0 or swap_index >= len(exercises):
        raise HTTPException(status_code=400, detail="Cannot move exercise further")

    # Remember the two exercise IDs for future-week matching
    moving_id = exercises[exercise_index]["exercise_id"]
    swapping_id = exercises[swap_index]["exercise_id"]

    # Swap in current session
    exercises[exercise_index], exercises[swap_index] = (
        exercises[swap_index],
        exercises[exercise_index],
    )

    if apply_to_future:
        session_name = session["session_name"]
        day_order = session["day_order"]
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session_name, day_order
        ):
            fex = future_session.get("exercises", [])
            idx_a = None
            idx_b = None
            for i, e in enumerate(fex):
                if e["exercise_id"] == moving_id:
                    idx_a = i
                elif e["exercise_id"] == swapping_id:
                    idx_b = i
            if idx_a is not None and idx_b is not None:
                fex[idx_a], fex[idx_b] = fex[idx_b], fex[idx_a]

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}


async def remove_exercise(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    exercise_id: str,
    apply_to_future: bool,
) -> dict:
    """Remove an exercise from a session in the mesocycle structure."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    week, session = get_session_from_structure(structure, week_index, session_index)
    exercises = session.get("exercises", [])

    original_len = len(exercises)
    session["exercises"] = [e for e in exercises if e["exercise_id"] != exercise_id]
    if len(session["exercises"]) == original_len:
        raise HTTPException(status_code=404, detail="Exercise not found in session")

    if apply_to_future:
        session_name = session["session_name"]
        day_order = session["day_order"]
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session_name, day_order
        ):
            target = find_exercise_in_session(future_session, exercise_id)
            if target:
                has_logged = any(s.get("logged") for s in target.get("sets", []))
                if not has_logged:
                    future_session["exercises"] = [
                        e
                        for e in future_session.get("exercises", [])
                        if e["exercise_id"] != exercise_id
                    ]

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}
