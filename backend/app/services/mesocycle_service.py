"""Mesocycle service — business logic and DB operations for mesocycles."""

from datetime import date as date_type

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.progression import build_mesocycle_structure, derive_fields
from app.models.exercise import Exercise
from app.models.exercise_performance import ExercisePerformance
from app.models.mesocycle import Mesocycle
from app.models.split import Split, SplitDay, SplitDayExercise
from app.services.common import deactivate_user_mesos


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

    await deactivate_user_mesos(db, user_id)

    # Build exercise lookup by id
    exercise_ids = [de.exercise_id for d in split.days for de in d.exercises]
    if exercise_ids:
        result = await db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
        exercises_by_id = {e.id: e for e in result.scalars().all()}
    else:
        exercises_by_id = {}

    # Query exercise performances for cross-meso memory
    perf_map = {}
    if exercise_ids:
        perf_result = await db.execute(
            select(ExercisePerformance).where(
                ExercisePerformance.user_id == user_id,
                ExercisePerformance.exercise_id.in_(exercise_ids),
            )
        )
        perf_map = {p.exercise_id: p for p in perf_result.scalars().all()}

    structure = build_mesocycle_structure(
        split.days, exercises_by_id, total_weeks, exercise_performances=perf_map
    )

    mesocycle = Mesocycle(
        split_id=split_id,
        user_id=user_id,
        name=name,
        started_at=started_at or date_type.today(),
        is_active=True,
        structure=structure,
    )
    db.add(mesocycle)
    await db.commit()
    await db.refresh(mesocycle)

    return mesocycle_to_response(mesocycle, split.name, split.color)


async def get_active(db: AsyncSession, user_id: str) -> dict | None:
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.is_active.is_(True), Mesocycle.user_id == user_id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        return None
    return mesocycle_to_response(mesocycle, mesocycle.split.name, mesocycle.split.color)


async def get_detail(db: AsyncSession, mesocycle_id: str, user_id: str) -> dict:
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == user_id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")
    return mesocycle_to_response(mesocycle, mesocycle.split.name, mesocycle.split.color)


async def update_mesocycle(
    db: AsyncSession,
    mesocycle_id: str,
    user_id: str,
    *,
    name: str | None = None,
    is_active: bool | None = None,
) -> dict:
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == user_id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    if name is not None:
        mesocycle.name = name

    if is_active is not None:
        if is_active:
            await deactivate_user_mesos(db, user_id, exclude_id=mesocycle_id)
        mesocycle.is_active = is_active

    await db.commit()
    await db.refresh(mesocycle)

    return mesocycle_to_response(mesocycle, mesocycle.split.name, mesocycle.split.color)


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


def mesocycle_to_response(
    mesocycle: Mesocycle, split_name: str, split_color: str | None = None
) -> dict:
    derived = derive_fields(mesocycle.structure)
    return {
        "id": mesocycle.id,
        "name": mesocycle.name,
        "split_id": mesocycle.split_id,
        "split_name": split_name,
        "split_color": split_color,
        "total_weeks": derived["total_weeks"],
        "rir_scheme": derived["rir_scheme"],
        "current_week": derived["current_week"],
        "current_rir": derived["current_rir"],
        "is_active": mesocycle.is_active,
        "started_at": mesocycle.started_at,
        "workouts_completed": derived["workouts_completed"],
        "structure": mesocycle.structure,
    }


def mesocycle_to_list_item(mesocycle: Mesocycle) -> dict:
    derived = derive_fields(mesocycle.structure)
    weeks = mesocycle.structure.get("weeks", [])
    total_workouts = sum(
        1
        for week in weeks
        for session in week.get("sessions", [])
        if any(not ex.get("skipped", False) for ex in session.get("exercises", []))
    )
    return {
        "id": mesocycle.id,
        "name": mesocycle.name,
        "split_name": mesocycle.split.name,
        "split_color": mesocycle.split.color if mesocycle.split else None,
        "total_weeks": derived["total_weeks"],
        "current_week": derived["current_week"],
        "current_rir": derived["current_rir"],
        "is_active": mesocycle.is_active,
        "started_at": mesocycle.started_at,
        "workouts_completed": derived["workouts_completed"],
        "total_workouts": total_workouts,
    }
