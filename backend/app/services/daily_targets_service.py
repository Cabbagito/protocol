"""Daily macro targets service."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_targets import DailyTargets
from app.schemas.daily_targets import DailyTargetsUpdate

DEFAULT_PROTEIN_G = 160.0
DEFAULT_CARBS_G = 250.0
DEFAULT_FAT_G = 70.0


async def get_targets(db: AsyncSession, user_id: str) -> DailyTargets:
    result = await db.execute(
        select(DailyTargets).where(DailyTargets.user_id == user_id)
    )
    targets = result.scalar_one_or_none()
    if targets is None:
        targets = DailyTargets(
            user_id=user_id,
            protein_g=DEFAULT_PROTEIN_G,
            carbs_g=DEFAULT_CARBS_G,
            fat_g=DEFAULT_FAT_G,
        )
        db.add(targets)
        await db.commit()
        await db.refresh(targets)
    return targets


async def update_targets(
    db: AsyncSession, user_id: str, *, data: DailyTargetsUpdate
) -> DailyTargets:
    targets = await get_targets(db, user_id)
    targets.protein_g = data.protein_g
    targets.carbs_g = data.carbs_g
    targets.fat_g = data.fat_g
    await db.commit()
    await db.refresh(targets)
    return targets
