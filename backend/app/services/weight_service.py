"""Body weight tracking service."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.body_weight import BodyWeightLog
from app.schemas.weight import WeightLogCreate
from app.services.common import get_owned_entity


async def list_weights(db: AsyncSession, user_id: str) -> list[BodyWeightLog]:
    result = await db.execute(
        select(BodyWeightLog)
        .where(BodyWeightLog.user_id == user_id)
        .order_by(BodyWeightLog.logged_on)
    )
    return list(result.scalars().all())


async def log_weight(db: AsyncSession, user_id: str, *, data: WeightLogCreate) -> BodyWeightLog:
    """Upsert: one entry per user per day — weighing in again replaces it."""
    result = await db.execute(
        select(BodyWeightLog).where(
            BodyWeightLog.user_id == user_id,
            BodyWeightLog.logged_on == data.logged_on,
        )
    )
    log = result.scalar_one_or_none()
    if log is None:
        log = BodyWeightLog(user_id=user_id, logged_on=data.logged_on, weight_kg=data.weight_kg)
        db.add(log)
    else:
        log.weight_kg = data.weight_kg
    await db.commit()
    await db.refresh(log)
    return log


async def delete_weight(db: AsyncSession, log_id: str, user_id: str) -> None:
    log = await get_owned_entity(db, BodyWeightLog, log_id, user_id)
    await db.delete(log)
    await db.commit()
