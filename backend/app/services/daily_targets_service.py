"""Daily macro targets service."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_targets import DailyTargets
from app.schemas.daily_targets import DailyTargetsUpdate

DEFAULT_PROTEIN_G = 160.0
DEFAULT_CARBS_G = 250.0
DEFAULT_FAT_G = 70.0


async def _select(db: AsyncSession, user_id: str) -> DailyTargets | None:
    result = await db.execute(select(DailyTargets).where(DailyTargets.user_id == user_id))
    return result.scalar_one_or_none()


async def get_targets(db: AsyncSession, user_id: str) -> DailyTargets:
    targets = await _select(db, user_id)
    if targets is not None:
        return targets

    # First read creates the defaults. ON CONFLICT DO NOTHING keeps two
    # concurrent first reads from colliding on the primary key.
    await db.execute(
        insert(DailyTargets)
        .values(
            user_id=user_id,
            protein_g=DEFAULT_PROTEIN_G,
            carbs_g=DEFAULT_CARBS_G,
            fat_g=DEFAULT_FAT_G,
        )
        .on_conflict_do_nothing(index_elements=[DailyTargets.user_id])
    )
    await db.commit()
    targets = await _select(db, user_id)
    assert targets is not None
    return targets


async def update_targets(
    db: AsyncSession, user_id: str, *, data: DailyTargetsUpdate
) -> DailyTargets:
    values = {"protein_g": data.protein_g, "carbs_g": data.carbs_g, "fat_g": data.fat_g}
    stmt = insert(DailyTargets).values(user_id=user_id, **values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[DailyTargets.user_id],
        set_={**values, "updated_at": stmt.excluded.updated_at},
    ).returning(DailyTargets)
    result = await db.scalars(stmt, execution_options={"populate_existing": True})
    targets = result.one()
    await db.commit()
    return targets
