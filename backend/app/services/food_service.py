"""Food item and food log service."""

from collections.abc import Sequence
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_item import FoodItem
from app.models.food_log import FoodLog
from app.schemas.food import (
    DailyLogResponse,
    DailyTotals,
    FoodItemCreate,
    FoodLogCreate,
)
from app.services.common import get_owned_entity, get_visible_entity

_SEARCH_LIMIT = 50


async def list_foods(
    db: AsyncSession, user_id: str, q: str | None = None
) -> Sequence[FoodItem]:
    query = select(FoodItem).where(
        or_(FoodItem.user_id == user_id, FoodItem.user_id.is_(None))
    )
    if q:
        query = query.where(FoodItem.name.ilike(f"%{q}%"))
    query = query.order_by(FoodItem.name).limit(_SEARCH_LIMIT)
    result = await db.execute(query)
    return result.scalars().all()


async def create_food(
    db: AsyncSession, user_id: str, *, data: FoodItemCreate
) -> FoodItem:
    food = FoodItem(
        name=data.name,
        brand=data.brand,
        kcal_per_100g=data.kcal_per_100g,
        protein_per_100g=data.protein_per_100g,
        carbs_per_100g=data.carbs_per_100g,
        fat_per_100g=data.fat_per_100g,
        default_serving_g=data.default_serving_g,
        user_id=user_id,
    )
    db.add(food)
    await db.commit()
    await db.refresh(food)
    return food


async def get_daily_log(db: AsyncSession, user_id: str, d: date) -> DailyLogResponse:
    result = await db.execute(
        select(FoodLog)
        .where(FoodLog.user_id == user_id, FoodLog.logged_on == d)
        .order_by(FoodLog.created_at)
    )
    entries = result.scalars().all()
    totals = DailyTotals(
        kcal=sum(e.kcal for e in entries),
        protein_g=sum(e.protein_g for e in entries),
        carbs_g=sum(e.carbs_g for e in entries),
        fat_g=sum(e.fat_g for e in entries),
    )
    return DailyLogResponse(date=d, totals=totals, entries=entries)


async def create_log(
    db: AsyncSession, user_id: str, *, data: FoodLogCreate
) -> FoodLog:
    if data.food_item_id is not None:
        await get_visible_entity(db, FoodItem, data.food_item_id, user_id)

    log = FoodLog(
        user_id=user_id,
        logged_on=data.logged_on,
        food_item_id=data.food_item_id,
        name=data.name,
        quantity_g=data.quantity_g,
        kcal=data.kcal,
        protein_g=data.protein_g,
        carbs_g=data.carbs_g,
        fat_g=data.fat_g,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def delete_log(db: AsyncSession, log_id: str, user_id: str) -> None:
    log = await get_owned_entity(db, FoodLog, log_id, user_id)
    await db.delete(log)
    await db.commit()
