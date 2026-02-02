from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.exercise import Exercise

router = APIRouter()


class ExerciseCreate(BaseModel):
    name: str
    muscle_groups: list[str]
    equipment_type: str


class ExerciseResponse(BaseModel):
    id: str
    name: str
    muscle_groups: list[str]
    equipment_type: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Exercise).order_by(Exercise.name))
    exercises = result.scalars().all()
    return exercises


@router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    db_exercise = Exercise(
        name=exercise.name,
        muscle_groups=exercise.muscle_groups,
        equipment_type=exercise.equipment_type,
    )
    db.add(db_exercise)
    await db.commit()
    await db.refresh(db_exercise)
    return db_exercise


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: str,
    exercise_update: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    exercise.name = exercise_update.name
    exercise.muscle_groups = exercise_update.muscle_groups
    exercise.equipment_type = exercise_update.equipment_type

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    await db.delete(exercise)
    await db.commit()
