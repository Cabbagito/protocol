"""Exercise management — replace, add, remove, reorder, update_note."""

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.domain.mesocycle_structure import blank_set
from app.domain.propagation import (
    apply_relative_order,
    find_exercise_in_session,
    iter_future_sessions,
)
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


async def _get_visible_exercise(db: AsyncSession, exercise_id: str, user_id: str) -> Exercise:
    result = await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            or_(Exercise.user_id == user_id, Exercise.user_id.is_(None)),
        )
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


def _exercise_entry(exercise: Exercise, num_sets: int) -> dict:
    return {
        "exercise_id": exercise.id,
        "exercise_name": exercise.name,
        "muscle_group": exercise.muscle_group,
        "equipment_type": exercise.equipment_type,
        "sets": [blank_set(n) for n in range(1, num_sets + 1)],
    }


def _session_has_exercise(session: dict, exercise_id: str) -> bool:
    return find_exercise_in_session(session, exercise_id) is not None


def _session_started(session: dict) -> bool:
    return any(s.get("logged") for e in session.get("exercises", []) for s in e.get("sets", []))


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
    """Swap an exercise for another one.

    Logged sets stay attributed to the exercise they were done on: if the
    exercise already has logged sets in this session, it keeps them and the
    new exercise is inserted right after it with the remaining (unlogged)
    set slots. Otherwise it is replaced in place. With ``apply_to_future``,
    the swap carries onto matching future sessions where the old exercise
    has nothing logged yet.
    """
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)
    new_exercise = await _get_visible_exercise(db, new_exercise_id, user_id)

    structure = mesocycle.structure
    _, session = get_session_from_structure(structure, week_index, session_index)
    exercises = session.get("exercises", [])

    if exercise_index >= len(exercises):
        raise HTTPException(status_code=400, detail="Invalid exercise index")
    target_ex = exercises[exercise_index]
    if target_ex["exercise_id"] != old_exercise_id:
        raise HTTPException(status_code=400, detail="Exercise ID mismatch")
    if _session_has_exercise(session, new_exercise.id):
        raise HTTPException(status_code=409, detail="That exercise is already in this workout")

    def swap_in_place(ex_data: dict) -> None:
        num_sets = len(ex_data.get("sets", [])) or 3
        ex_data.clear()
        ex_data.update(_exercise_entry(new_exercise, num_sets))

    logged = [s for s in target_ex.get("sets", []) if s.get("logged")]
    if logged:
        remaining = len(target_ex["sets"]) - len(logged)
        target_ex["sets"] = logged
        for i, s in enumerate(logged, start=1):
            s["set_num"] = i
        exercises.insert(exercise_index + 1, _exercise_entry(new_exercise, max(remaining, 1)))
    else:
        swap_in_place(target_ex)

    if apply_to_future:
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session["session_name"], session["day_order"]
        ):
            fe = find_exercise_in_session(future_session, old_exercise_id)
            if (
                fe is None
                or any(s.get("logged") for s in fe.get("sets", []))
                or _session_has_exercise(future_session, new_exercise.id)
            ):
                continue
            swap_in_place(fe)

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}


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
    """Add an exercise to a session. With ``apply_to_future``, it is also
    added to matching future sessions that haven't been started."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)
    exercise = await _get_visible_exercise(db, exercise_id, user_id)

    structure = mesocycle.structure
    _, session = get_session_from_structure(structure, week_index, session_index)
    if _session_has_exercise(session, exercise.id):
        raise HTTPException(status_code=409, detail="That exercise is already in this workout")

    new_entry = _exercise_entry(exercise, 3)
    session.setdefault("exercises", []).append(new_entry)

    if apply_to_future:
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session["session_name"], session["day_order"]
        ):
            if _session_started(future_session) or _session_has_exercise(
                future_session, exercise.id
            ):
                continue
            future_session.setdefault("exercises", []).append(_exercise_entry(exercise, 3))

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok", "exercise": new_entry}


async def reorder_exercises(
    db: AsyncSession,
    user_id: str,
    *,
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    exercise_ids: list[str],
    apply_to_future: bool,
) -> dict:
    """Set the full exercise order of a session.

    ``exercise_ids`` must be a permutation of the session's exercises. With
    ``apply_to_future``, matching future sessions adopt the same relative order
    for the exercises they share (others keep their slots).
    """
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id, for_update=True)

    structure = mesocycle.structure
    week, session = get_session_from_structure(structure, week_index, session_index)
    exercises = session.get("exercises", [])

    current_ids = [e["exercise_id"] for e in exercises]
    if sorted(current_ids) != sorted(exercise_ids):
        raise HTTPException(
            status_code=400, detail="exercise_ids must list every exercise in the session"
        )

    session["exercises"] = apply_relative_order(exercises, exercise_ids)

    if apply_to_future:
        session_name = session["session_name"]
        day_order = session["day_order"]
        for _wi, future_session in iter_future_sessions(
            structure, week_index, session_name, day_order
        ):
            future_session["exercises"] = apply_relative_order(
                future_session.get("exercises", []), exercise_ids
            )

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
