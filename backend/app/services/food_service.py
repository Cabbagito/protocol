"""Food item and food log service."""

from collections.abc import Sequence
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_item import FoodItem
from app.models.food_log import FoodLog
from app.schemas.food import (
    BarcodeLookupResponse,
    DailyLogResponse,
    DailyTotals,
    FoodDraft,
    FoodItemCreate,
    FoodItemResponse,
    FoodItemUpdate,
    FoodLogCreate,
)
from app.services import off_client
from app.services.common import get_owned_entity, get_visible_entity

_SEARCH_LIMIT = 50


async def list_foods(db: AsyncSession, user_id: str, q: str | None = None) -> Sequence[FoodItem]:
    query = select(FoodItem).where(or_(FoodItem.user_id == user_id, FoodItem.user_id.is_(None)))
    if q:
        query = query.where(FoodItem.name.ilike(f"%{q}%"))
    query = query.order_by(FoodItem.name).limit(_SEARCH_LIMIT)
    result = await db.execute(query)
    return result.scalars().all()


async def _get_by_barcode(db: AsyncSession, barcode: str) -> FoodItem | None:
    result = await db.execute(select(FoodItem).where(FoodItem.barcode == barcode))
    return result.scalar_one_or_none()


async def create_food(db: AsyncSession, user_id: str, *, data: FoodItemCreate) -> FoodItem:
    # A barcode identifies an objective product, so barcode foods are shared
    # across all users (user_id NULL) rather than owned by their creator.
    food = FoodItem(
        name=data.name,
        brand=data.brand,
        kcal_per_100g=data.kcal_per_100g,
        protein_per_100g=data.protein_per_100g,
        carbs_per_100g=data.carbs_per_100g,
        fat_per_100g=data.fat_per_100g,
        default_serving_g=data.default_serving_g,
        barcode=data.barcode,
        user_id=None if data.barcode else user_id,
    )
    db.add(food)
    try:
        await db.commit()
    except IntegrityError:
        # Another user created the same barcode concurrently — use their row.
        await db.rollback()
        existing = await _get_by_barcode(db, data.barcode) if data.barcode else None
        if existing is None:
            raise
        return existing
    await db.refresh(food)
    return food


async def update_food(db: AsyncSession, food_id: str, *, data: FoodItemUpdate) -> FoodItem:
    result = await db.execute(select(FoodItem).where(FoodItem.id == food_id))
    food = result.scalar_one_or_none()
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
    if food.seed_key is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeded foods cannot be edited",
        )
    food.name = data.name
    food.brand = data.brand
    food.kcal_per_100g = data.kcal_per_100g
    food.protein_per_100g = data.protein_per_100g
    food.carbs_per_100g = data.carbs_per_100g
    food.fat_per_100g = data.fat_per_100g
    food.default_serving_g = data.default_serving_g
    await db.commit()
    await db.refresh(food)
    return food


async def lookup_barcode(db: AsyncSession, barcode: str) -> BarcodeLookupResponse:
    """Resolve a scanned barcode: local DB, then Open Food Facts, else a draft."""
    food = await _get_by_barcode(db, barcode)
    if food is not None:
        return BarcodeLookupResponse(status="found", food=FoodItemResponse.model_validate(food))

    product = await off_client.fetch_product(barcode)
    if product is None:
        return BarcodeLookupResponse(status="draft", draft=FoodDraft(barcode=barcode))

    draft = off_client.map_product(product, barcode)
    if not off_client.is_complete(draft):
        return BarcodeLookupResponse(status="draft", draft=draft)

    food = FoodItem(
        name=draft.name,
        brand=draft.brand,
        kcal_per_100g=draft.kcal_per_100g,
        protein_per_100g=draft.protein_per_100g,
        carbs_per_100g=draft.carbs_per_100g,
        fat_per_100g=draft.fat_per_100g,
        default_serving_g=draft.default_serving_g,
        barcode=barcode,
        user_id=None,
    )
    db.add(food)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        food = await _get_by_barcode(db, barcode)
        if food is None:
            raise
    else:
        await db.refresh(food)
    return BarcodeLookupResponse(status="found", food=FoodItemResponse.model_validate(food))


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


async def create_log(db: AsyncSession, user_id: str, *, data: FoodLogCreate) -> FoodLog:
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
