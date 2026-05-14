"""Exercise CRUD service."""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle
from app.schemas.exercise import ExerciseCreate
from app.services.common import get_owned_entity, get_visible_entity


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


async def update_exercise(
    db: AsyncSession, exercise_id: str, user_id: str, *, data: ExerciseCreate
) -> Exercise:
    exercise = await get_owned_entity(db, Exercise, exercise_id, user_id)
    exercise.name = data.name
    exercise.muscle_group = data.muscle_group
    exercise.equipment_type = data.equipment_type
    await db.commit()
    await db.refresh(exercise)
    return exercise


async def delete_exercise(db: AsyncSession, exercise_id: str, user_id: str) -> None:
    exercise = await get_owned_entity(db, Exercise, exercise_id, user_id)
    await db.delete(exercise)
    await db.commit()


def collect_exercise_history(mesocycles: list, exercise_id: str) -> list[dict]:
    """Pure helper: walk mesocycle structures and gather logged sessions for
    one exercise, sorted newest first."""
    entries: list[dict] = []
    for meso in mesocycles:
        weeks = (meso.structure or {}).get("weeks") or []
        for week in weeks:
            for session in week.get("sessions") or []:
                for ex in session.get("exercises") or []:
                    if ex.get("exercise_id") != exercise_id or ex.get("skipped"):
                        continue
                    logged = [
                        s for s in (ex.get("sets") or [])
                        if s.get("logged") and not s.get("skipped")
                    ]
                    if not logged:
                        continue
                    entries.append(
                        {
                            "meso_id": meso.id,
                            "meso_name": meso.name,
                            "week_number": week.get("week_number"),
                            "session_name": session.get("session_name"),
                            "date": session.get("date"),
                            "meso_started_at": meso.started_at.isoformat(),
                            "sets": logged,
                        }
                    )

    entries.sort(
        key=lambda e: (e["date"] or e["meso_started_at"]),
        reverse=True,
    )
    return entries


async def get_exercise_history(
    db: AsyncSession, exercise_id: str, user_id: str
) -> list[dict]:
    """Every (meso, week, session) where this exercise has logged sets, newest first.

    Walks every user-owned mesocycle's JSONB structure. Each result entry is one
    session's worth of logged sets for the exercise, with meso/week/session
    metadata so the frontend can group by day.
    """
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.user_id == user_id)
    )
    return collect_exercise_history(list(result.scalars().all()), exercise_id)
