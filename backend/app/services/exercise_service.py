"""Exercise CRUD service."""

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle
from app.models.split import SplitDay, SplitDayExercise
from app.schemas.exercise import ExerciseCreate
from app.services.common import get_visible_entity, get_writable_entity

# True when any session of a mesocycle's JSONB structure contains the exercise.
_STRUCTURE_USES_EXERCISE = text(
    "jsonb_path_exists(mesocycles.structure, "
    "'$.weeks[*].sessions[*].exercises[*] ? (@.exercise_id == $id)', "
    "jsonb_build_object('id', CAST(:exercise_id AS text)))"
)


async def list_exercises(db: AsyncSession, user_id: str) -> list[Exercise]:
    result = await db.execute(
        select(Exercise)
        .where(or_(Exercise.user_id == user_id, Exercise.user_id.is_(None)))
        .order_by(Exercise.name)
    )
    return result.scalars().all()


async def create_exercise(db: AsyncSession, user_id: str, *, data: ExerciseCreate) -> Exercise:
    exercise = Exercise(
        name=data.name,
        muscle_group=data.muscle_group,
        equipment_type=data.equipment_type,
        user_id=user_id,
    )
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    return exercise


async def get_exercise(db: AsyncSession, exercise_id: str, user_id: str) -> Exercise:
    return await get_visible_entity(db, Exercise, exercise_id, user_id)


async def _get_editable(db: AsyncSession, exercise_id: str, user_id: str) -> Exercise:
    return await get_writable_entity(
        db, Exercise, exercise_id, user_id, shared_detail="Built-in exercises cannot be modified"
    )


async def update_exercise(
    db: AsyncSession, exercise_id: str, user_id: str, *, data: ExerciseCreate
) -> Exercise:
    exercise = await _get_editable(db, exercise_id, user_id)
    exercise.name = data.name
    exercise.muscle_group = data.muscle_group
    exercise.equipment_type = data.equipment_type
    await db.commit()
    await db.refresh(exercise)
    return exercise


async def _usage_counts(db: AsyncSession, exercise_id: str) -> tuple[int, int]:
    """(splits, mesocycles) that reference the exercise."""
    split_count = await db.scalar(
        select(func.count(func.distinct(SplitDay.split_id)))
        .select_from(SplitDayExercise)
        .join(SplitDay, SplitDayExercise.day_id == SplitDay.id)
        .where(SplitDayExercise.exercise_id == exercise_id)
    )
    meso_count = await db.scalar(
        select(func.count())
        .select_from(Mesocycle)
        .where(_STRUCTURE_USES_EXERCISE.bindparams(exercise_id=exercise_id))
    )
    return split_count or 0, meso_count or 0


def _in_use_error(split_count: int, meso_count: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            f"Exercise is used by {split_count} split(s) and {meso_count} mesocycle(s); "
            "remove it from them before deleting"
        ),
    )


async def delete_exercise(db: AsyncSession, exercise_id: str, user_id: str) -> None:
    """Delete a custom exercise that nothing references.

    Splits reference exercises by FK (no ON DELETE action) and mesocycles by id
    inside their JSONB structure, where a deleted exercise would leave a
    dangling id behind, so both block deletion with 409.
    """
    exercise = await _get_editable(db, exercise_id, user_id)
    split_count, meso_count = await _usage_counts(db, exercise_id)
    if split_count or meso_count:
        raise _in_use_error(split_count, meso_count)

    await db.delete(exercise)
    try:
        await db.commit()
    except IntegrityError:
        # A split started using it after the check above.
        await db.rollback()
        raise _in_use_error(*await _usage_counts(db, exercise_id))


def collect_exercise_history(mesocycles: list, exercise_id: str) -> list[dict]:
    """Pure helper: walk mesocycle structures and gather every session where
    this exercise has logged sets, newest first.

    Logged sets count even if the exercise was later skipped (the work was
    done). Ordering is by session date, then by position (mesocycle start,
    week, session), so undated or same-day sessions still sort sensibly.
    """
    entries: list[dict] = []
    for meso in mesocycles:
        weeks = (meso.structure or {}).get("weeks") or []
        for wi, week in enumerate(weeks):
            for si, session in enumerate(week.get("sessions") or []):
                for ex in session.get("exercises") or []:
                    if ex.get("exercise_id") != exercise_id:
                        continue
                    logged = [
                        s
                        for s in (ex.get("sets") or [])
                        if s.get("logged") and not s.get("skipped")
                    ]
                    if not logged:
                        continue
                    entries.append(
                        {
                            "meso_id": meso.id,
                            "meso_name": meso.name,
                            "week_index": wi,
                            "session_index": si,
                            "week_number": week.get("week_number"),
                            "session_name": session.get("session_name"),
                            "date": session.get("date"),
                            "meso_started_at": meso.started_at.isoformat(),
                            "sets": logged,
                        }
                    )

    entries.sort(
        key=lambda e: (
            e["date"] or e["meso_started_at"],
            e["meso_started_at"],
            e["week_index"],
            e["session_index"],
        ),
        reverse=True,
    )
    return entries


async def get_exercise_history(db: AsyncSession, exercise_id: str, user_id: str) -> list[dict]:
    """Every (meso, week, session) where this exercise has logged sets, newest first.

    Walks every user-owned mesocycle's JSONB structure. Each result entry is one
    session's worth of logged sets for the exercise, with meso/week/session
    metadata so the frontend can group by day.
    """
    result = await db.execute(select(Mesocycle).where(Mesocycle.user_id == user_id))
    return collect_exercise_history(list(result.scalars().all()), exercise_id)
