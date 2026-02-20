from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.exercise import Exercise
from app.models.user import User

router = APIRouter()


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    muscle_group: str = Field(min_length=1)
    equipment_type: str = Field(min_length=1)


class ExerciseResponse(BaseModel):
    id: str
    name: str
    muscle_group: str
    equipment_type: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exercise)
        .where(or_(Exercise.user_id == current_user.id, Exercise.user_id.is_(None)))
        .order_by(Exercise.name)
    )
    exercises = result.scalars().all()
    return exercises


@router.post("", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    exercise: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_exercise = Exercise(
        name=exercise.name,
        muscle_group=exercise.muscle_group,
        equipment_type=exercise.equipment_type,
        user_id=current_user.id,
    )
    db.add(db_exercise)
    await db.commit()
    await db.refresh(db_exercise)
    return db_exercise


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exercise).where(
            Exercise.id == exercise_id,
            or_(Exercise.user_id == current_user.id, Exercise.user_id.is_(None)),
        )
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: str,
    exercise_update: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id, Exercise.user_id == current_user.id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    exercise.name = exercise_update.name
    exercise.muscle_group = exercise_update.muscle_group
    exercise.equipment_type = exercise_update.equipment_type

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id, Exercise.user_id == current_user.id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    await db.delete(exercise)
    await db.commit()
