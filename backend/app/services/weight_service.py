"""Body weight tracking service."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
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
    """Upsert: one entry per user per day — weighing in again replaces it.

    A single INSERT ... ON CONFLICT, so two concurrent weigh-ins for the same
    day can't both try to insert.
    """
    stmt = insert(BodyWeightLog).values(
        user_id=user_id, logged_on=data.logged_on, weight_kg=data.weight_kg
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_body_weight_user_date",
        set_={"weight_kg": stmt.excluded.weight_kg, "updated_at": stmt.excluded.updated_at},
    ).returning(BodyWeightLog)
    result = await db.scalars(stmt, execution_options={"populate_existing": True})
    log = result.one()
    await db.commit()
    return log


async def delete_weight(db: AsyncSession, log_id: str, user_id: str) -> None:
    log = await get_owned_entity(db, BodyWeightLog, log_id, user_id)
    await db.delete(log)
    await db.commit()
