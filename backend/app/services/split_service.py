"""Split CRUD service."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.split import Split, SplitDay, SplitDayExercise
from app.schemas.split import SplitCreate
from app.services.common import get_owned_entity, get_visible_entity, validate_exercise_ids


async def list_splits(db: AsyncSession, user_id: str) -> list[dict]:
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
        .where(or_(Split.user_id == user_id, Split.user_id.is_(None)))
        .group_by(Split.id)
        .order_by(Split.name)
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "color": s.color,
            "day_count": s.day_count,
            "exercise_count": s.exercise_count or 0,
        }
        for s in result.all()
    ]


def _selectinload_split():
    return (
        selectinload(Split.days)
        .selectinload(SplitDay.exercises)
        .selectinload(SplitDayExercise.exercise)
    )


async def _reload_split(db: AsyncSession, split_id: str) -> dict:
    result = await db.execute(
        select(Split).options(_selectinload_split()).where(Split.id == split_id)
    )
    return _split_to_response(result.scalar_one())


async def create_split(db: AsyncSession, user_id: str, *, data: SplitCreate) -> dict:
    db_split = Split(name=data.name, color=data.color, user_id=user_id)
    db.add(db_split)
    await db.flush()

    all_exercise_ids = [ex.exercise_id for day in data.days for ex in day.exercises]
    await validate_exercise_ids(db, all_exercise_ids, user_id)

    for day_order, day_data in enumerate(data.days):
        day = SplitDay(split_id=db_split.id, name=day_data.name, day_order=day_order)
        db.add(day)
        await db.flush()
        for ex_order, ex_data in enumerate(day_data.exercises):
            db.add(SplitDayExercise(day_id=day.id, exercise_id=ex_data.exercise_id, order=ex_order))

    await db.commit()
    return await _reload_split(db, db_split.id)


async def get_split(db: AsyncSession, split_id: str, user_id: str) -> dict:
    split = await get_visible_entity(db, Split, split_id, user_id, options=[_selectinload_split()])
    return _split_to_response(split)


async def update_split(db: AsyncSession, split_id: str, user_id: str, *, data: SplitCreate) -> dict:
    split = await get_owned_entity(
        db,
        Split,
        split_id,
        user_id,
        options=[selectinload(Split.days).selectinload(SplitDay.exercises)],
    )

    split.name = data.name
    split.color = data.color

    for day in split.days:
        await db.delete(day)
    await db.flush()

    all_exercise_ids = [ex.exercise_id for day in data.days for ex in day.exercises]
    await validate_exercise_ids(db, all_exercise_ids, user_id)

    for day_order, day_data in enumerate(data.days):
        day = SplitDay(split_id=split.id, name=day_data.name, day_order=day_order)
        db.add(day)
        await db.flush()
        for ex_order, ex_data in enumerate(day_data.exercises):
            db.add(SplitDayExercise(day_id=day.id, exercise_id=ex_data.exercise_id, order=ex_order))

    await db.commit()
    return await _reload_split(db, split.id)


async def delete_split(db: AsyncSession, split_id: str, user_id: str) -> None:
    split = await get_owned_entity(db, Split, split_id, user_id)
    await db.delete(split)
    await db.commit()


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
