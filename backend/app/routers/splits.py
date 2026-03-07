from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.exercise import Exercise
from app.models.split import Split, SplitDay, SplitDayExercise
from app.models.user import User

router = APIRouter()


# --- Pydantic Schemas ---


class DayExerciseInput(BaseModel):
    exercise_id: str


class DayInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    exercises: list[DayExerciseInput] = []


class SplitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    days: list[DayInput] = []


class DayExerciseResponse(BaseModel):
    id: str
    exercise_id: str
    exercise_name: str
    muscle_group: str
    order: int

    class Config:
        from_attributes = True


class DayResponse(BaseModel):
    id: str
    name: str
    day_order: int
    exercises: list[DayExerciseResponse]

    class Config:
        from_attributes = True


class SplitResponse(BaseModel):
    id: str
    name: str
    color: str | None
    days: list[DayResponse]

    class Config:
        from_attributes = True


class SplitListItem(BaseModel):
    id: str
    name: str
    color: str | None
    day_count: int
    exercise_count: int

    class Config:
        from_attributes = True


# --- Endpoints ---


@router.get("", response_model=list[SplitListItem])
async def list_splits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exercise_count_subq = (
        select(func.count(SplitDayExercise.id))
        .join(SplitDay, SplitDayExercise.day_id == SplitDay.id)
        .where(SplitDay.split_id == Split.id)
        .correlate(Split)
        .scalar_subquery()
        .label("exercise_count")
    )
    result = await db.execute(
        select(
            Split.id,
            Split.name,
            Split.color,
            func.count(SplitDay.id).label("day_count"),
            exercise_count_subq,
        )
        .outerjoin(SplitDay)
        .where(or_(Split.user_id == current_user.id, Split.user_id.is_(None)))
        .group_by(Split.id)
        .order_by(Split.name)
    )
    splits = result.all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "color": s.color,
            "day_count": s.day_count,
            "exercise_count": s.exercise_count or 0,
        }
        for s in splits
    ]


@router.post("", response_model=SplitResponse, status_code=status.HTTP_201_CREATED)
async def create_split(
    split_data: SplitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_split = Split(name=split_data.name, color=split_data.color, user_id=current_user.id)
    db.add(db_split)
    await db.flush()

    # Validate all exercise IDs at once
    all_exercise_ids = [ex.exercise_id for day in split_data.days for ex in day.exercises]
    if all_exercise_ids:
        result = await db.execute(
            select(Exercise.id).where(
                Exercise.id.in_(all_exercise_ids),
                or_(Exercise.user_id == current_user.id, Exercise.user_id.is_(None)),
            )
        )
        found_ids = set(row[0] for row in result.all())
        missing = set(all_exercise_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Exercise(s) not found: {', '.join(missing)}",
            )

    for day_order, day_data in enumerate(split_data.days):
        day = SplitDay(split_id=db_split.id, name=day_data.name, day_order=day_order)
        db.add(day)
        await db.flush()
        for ex_order, ex_data in enumerate(day_data.exercises):
            db.add(SplitDayExercise(day_id=day.id, exercise_id=ex_data.exercise_id, order=ex_order))

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.days)
            .selectinload(SplitDay.exercises)
            .selectinload(SplitDayExercise.exercise)
        )
        .where(Split.id == db_split.id)
    )
    return _split_to_response(result.scalar_one())


@router.get("/{split_id}", response_model=SplitResponse)
async def get_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.days)
            .selectinload(SplitDay.exercises)
            .selectinload(SplitDayExercise.exercise)
        )
        .where(
            Split.id == split_id,
            or_(Split.user_id == current_user.id, Split.user_id.is_(None)),
        )
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    return _split_to_response(split)


@router.put("/{split_id}", response_model=SplitResponse)
async def update_split(
    split_id: str,
    split_data: SplitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Split)
        .options(selectinload(Split.days).selectinload(SplitDay.exercises))
        .where(Split.id == split_id, Split.user_id == current_user.id)
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    split.name = split_data.name
    split.color = split_data.color

    # Delete all existing days (cascade deletes exercises)
    for day in split.days:
        await db.delete(day)
    await db.flush()

    # Validate all exercise IDs at once
    all_exercise_ids = [ex.exercise_id for day in split_data.days for ex in day.exercises]
    if all_exercise_ids:
        result = await db.execute(
            select(Exercise.id).where(
                Exercise.id.in_(all_exercise_ids),
                or_(Exercise.user_id == current_user.id, Exercise.user_id.is_(None)),
            )
        )
        found_ids = set(row[0] for row in result.all())
        missing = set(all_exercise_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Exercise(s) not found: {', '.join(missing)}",
            )

    # Recreate days from payload
    for day_order, day_data in enumerate(split_data.days):
        day = SplitDay(split_id=split.id, name=day_data.name, day_order=day_order)
        db.add(day)
        await db.flush()
        for ex_order, ex_data in enumerate(day_data.exercises):
            db.add(SplitDayExercise(day_id=day.id, exercise_id=ex_data.exercise_id, order=ex_order))

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.days)
            .selectinload(SplitDay.exercises)
            .selectinload(SplitDayExercise.exercise)
        )
        .where(Split.id == split.id)
    )
    return _split_to_response(result.scalar_one())


@router.delete("/{split_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Split).where(Split.id == split_id, Split.user_id == current_user.id)
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    await db.delete(split)
    await db.commit()


# --- Helper Functions ---


def _day_to_response(day: SplitDay) -> dict:
    return {
        "id": day.id,
        "name": day.name,
        "day_order": day.day_order,
        "exercises": [
            {
                "id": ex.id,
                "exercise_id": ex.exercise_id,
                "exercise_name": ex.exercise.name,
                "muscle_group": ex.exercise.muscle_group,
                "order": ex.order,
            }
            for ex in day.exercises
        ],
    }


def _split_to_response(split: Split) -> dict:
    return {
        "id": split.id,
        "name": split.name,
        "color": split.color,
        "days": [_day_to_response(d) for d in split.days],
    }
