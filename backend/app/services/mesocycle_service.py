"""Mesocycle service — business logic and DB operations for mesocycles."""

from datetime import date as date_type

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.progression import (
    build_mesocycle_structure,
    count_total_workouts,
    derive_fields,
)
from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle
from app.models.split import Split, SplitDay, SplitDayExercise
from app.services.common import deactivate_user_mesos


async def _commit_activation(db: AsyncSession) -> None:
    """Commit a change that activates a mesocycle.

    The partial unique index allows one active mesocycle per user. Callers
    deactivate the others first in the same transaction, so a violation here
    means a concurrent request activated another one in between.
    """
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another mesocycle was activated at the same time; reload and retry",
        )


async def list_mesocycles(
    db: AsyncSession, user_id: str, *, active_only: bool = False
) -> list[dict]:
    query = (
        select(Mesocycle).options(selectinload(Mesocycle.split)).where(Mesocycle.user_id == user_id)
    )
    if active_only:
        query = query.where(Mesocycle.is_active.is_(True))
    query = query.order_by(Mesocycle.is_active.desc(), Mesocycle.started_at.desc())

    result = await db.execute(query)
    mesocycles = result.scalars().all()

    return [mesocycle_to_list_item(m) for m in mesocycles]


async def create_mesocycle(
    db: AsyncSession,
    user_id: str,
    *,
    split_id: str,
    name: str,
    total_weeks: int,
    started_at: date_type | None,
) -> dict:
    # Verify split exists and is visible to user, load days with exercises
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.days)
            .selectinload(SplitDay.exercises)
            .selectinload(SplitDayExercise.exercise)
        )
        .where(
            Split.id == split_id,
            or_(Split.user_id == user_id, Split.user_id.is_(None)),
        )
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    # Build exercise lookup by id
    exercise_ids = [de.exercise_id for d in split.days for de in d.exercises]
    if exercise_ids:
        result = await db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
        exercises_by_id = {e.id: e for e in result.scalars().all()}
    else:
        exercises_by_id = {}

    structure = build_mesocycle_structure(split.days, exercises_by_id, total_weeks)

    # Deactivate-then-insert in one transaction.
    await deactivate_user_mesos(db, user_id)
    mesocycle = Mesocycle(
        split_id=split.id,
        user_id=user_id,
        name=name,
        started_at=started_at or date_type.today(),
        is_active=True,
        structure=structure,
    )
    db.add(mesocycle)
    await _commit_activation(db)
    await db.refresh(mesocycle)

    return mesocycle_to_response(mesocycle, split)


async def get_active(db: AsyncSession, user_id: str) -> dict | None:
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.is_active.is_(True), Mesocycle.user_id == user_id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        return None
    return mesocycle_to_response(mesocycle, mesocycle.split)


async def _get_with_split(db: AsyncSession, mesocycle_id: str, user_id: str) -> Mesocycle:
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == user_id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")
    return mesocycle


async def get_detail(db: AsyncSession, mesocycle_id: str, user_id: str) -> dict:
    mesocycle = await _get_with_split(db, mesocycle_id, user_id)
    return mesocycle_to_response(mesocycle, mesocycle.split)


async def update_mesocycle(
    db: AsyncSession,
    mesocycle_id: str,
    user_id: str,
    *,
    name: str | None = None,
    is_active: bool | None = None,
) -> dict:
    mesocycle = await _get_with_split(db, mesocycle_id, user_id)
    split = mesocycle.split

    if name is not None:
        mesocycle.name = name

    if is_active is not None:
        if is_active:
            await deactivate_user_mesos(db, user_id, exclude_id=mesocycle_id)
        mesocycle.is_active = is_active

    await _commit_activation(db)
    await db.refresh(mesocycle)

    return mesocycle_to_response(mesocycle, split)


async def delete_mesocycle(db: AsyncSession, mesocycle_id: str, user_id: str) -> None:
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == user_id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    await db.delete(mesocycle)
    await db.commit()


# --- Response formatting ---
# The split is optional: deleting a split keeps its mesocycles (split_id NULL).


def mesocycle_to_response(mesocycle: Mesocycle, split: Split | None) -> dict:
    derived = derive_fields(mesocycle.structure)
    return {
        "id": mesocycle.id,
        "name": mesocycle.name,
        "split_id": mesocycle.split_id,
        "split_name": split.name if split else None,
        "split_color": split.color if split else None,
        "total_weeks": derived["total_weeks"],
        "current_week": derived["current_week"],
        "is_active": mesocycle.is_active,
        "started_at": mesocycle.started_at,
        "workouts_completed": derived["workouts_completed"],
        "structure": mesocycle.structure,
    }


def mesocycle_to_list_item(mesocycle: Mesocycle) -> dict:
    derived = derive_fields(mesocycle.structure)
    total_workouts = count_total_workouts(mesocycle.structure)
    split = mesocycle.split
    return {
        "id": mesocycle.id,
        "name": mesocycle.name,
        "split_name": split.name if split else None,
        "split_color": split.color if split else None,
        "total_weeks": derived["total_weeks"],
        "current_week": derived["current_week"],
        "is_active": mesocycle.is_active,
        "started_at": mesocycle.started_at,
        "workouts_completed": derived["workouts_completed"],
        "total_workouts": total_workouts,
    }
