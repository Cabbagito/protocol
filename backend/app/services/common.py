"""Shared async DB helpers used by multiple services."""

from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle


async def validate_exercise_ids(
    db: AsyncSession, exercise_ids: list[str], user_id: str
) -> set[str]:
    """Validate exercise IDs exist and are visible to user. Returns set of found IDs."""
    if not exercise_ids:
        return set()
    result = await db.execute(
        select(Exercise.id).where(
            Exercise.id.in_(exercise_ids),
            or_(Exercise.user_id == user_id, Exercise.user_id.is_(None)),
        )
    )
    found_ids = set(row[0] for row in result.all())
    missing = set(exercise_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Exercise(s) not found: {', '.join(missing)}",
        )
    return found_ids


async def deactivate_user_mesos(
    db: AsyncSession, user_id: str, *, exclude_id: str | None = None
) -> None:
    """Bulk-deactivate active mesocycles for a user, optionally excluding one."""
    query = update(Mesocycle).where(
        Mesocycle.is_active.is_(True),
        Mesocycle.user_id == user_id,
    )
    if exclude_id:
        query = query.where(Mesocycle.id != exclude_id)
    await db.execute(query.values(is_active=False))


async def get_user_mesocycle(
    db: AsyncSession,
    mesocycle_id: str,
    user_id: str,
    *,
    for_update: bool = False,
) -> Mesocycle:
    """Fetch mesocycle by ID scoped to user. Raises 404 if not found."""
    query = select(Mesocycle).where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == user_id)
    if for_update:
        query = query.with_for_update()
    result = await db.execute(query)
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")
    return mesocycle


async def get_visible_entity(
    db: AsyncSession,
    model: type,
    entity_id: str,
    user_id: str,
    *,
    options: list[Any] | None = None,
) -> Any:
    """Fetch entity visible to user (owned or system). Raises 404."""
    query = select(model).where(
        model.id == entity_id,
        or_(model.user_id == user_id, model.user_id.is_(None)),
    )
    if options:
        for opt in options:
            query = query.options(opt)
    result = await db.execute(query)
    entity = result.scalar_one_or_none()
    if not entity:
        name = model.__tablename__.rstrip("s").title()
        raise HTTPException(status_code=404, detail=f"{name} not found")
    return entity


async def get_owned_entity(
    db: AsyncSession,
    model: type,
    entity_id: str,
    user_id: str,
    *,
    options: list[Any] | None = None,
) -> Any:
    """Fetch entity owned by user (write access). Raises 404."""
    query = select(model).where(model.id == entity_id, model.user_id == user_id)
    if options:
        for opt in options:
            query = query.options(opt)
    result = await db.execute(query)
    entity = result.scalar_one_or_none()
    if not entity:
        name = model.__tablename__.rstrip("s").title()
        raise HTTPException(status_code=404, detail=f"{name} not found")
    return entity
