"""Exercise CRUD service."""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
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
