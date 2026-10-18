"""Food items and their units.

Visibility: seeded and barcode foods are shared (user_id NULL); custom foods
belong to their creator. Seeded foods are read-only. Barcode foods describe an
objective product, so any user may correct them, but nobody may delete them
(others may log them). Custom foods are their owner's to edit and delete.

Units: a food's own units (user_id NULL) come with the food and change with
it; a user may add personal units (user_id = theirs) to any food they see.
"""

from collections.abc import Sequence

from fastapi import HTTPException
from sqlalchemy import case, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_item import FoodItem
from app.models.food_unit import FoodUnit
from app.models.meal import Meal, MealItem
from app.schemas.food import (
    BarcodeLookupResponse,
    FoodDraft,
    FoodItemCreate,
    FoodItemResponse,
    FoodItemUpdate,
    FoodUnitCreate,
    LastUsed,
)
from app.services import off_client
from app.services.common import get_visible_entity

_SEARCH_LIMIT = 50


def _visible(user_id: str):
    return or_(FoodItem.user_id == user_id, FoodItem.user_id.is_(None))


async def _units_by_food(
    db: AsyncSession, food_ids: Sequence[str], user_id: str
) -> dict[str, list[FoodUnit]]:
    if not food_ids:
        return {}
    result = await db.execute(
        select(FoodUnit)
        .where(
            FoodUnit.food_item_id.in_(food_ids),
            or_(FoodUnit.user_id.is_(None), FoodUnit.user_id == user_id),
        )
        # The food's own units first, then personal ones, in the order added.
        .order_by(FoodUnit.user_id.is_not(None), FoodUnit.created_at, FoodUnit.name)
    )
    units: dict[str, list[FoodUnit]] = {}
    for unit in result.scalars().all():
        units.setdefault(unit.food_item_id, []).append(unit)
    return units


async def respond(
    db: AsyncSession,
    foods: Sequence[FoodItem],
    user_id: str,
    last_used: dict[str, LastUsed] | None = None,
) -> list[FoodItemResponse]:
    """Foods with the units the user sees (and, from search, their last use)."""
    units = await _units_by_food(db, [f.id for f in foods], user_id)
    return [
        FoodItemResponse.model_validate(food).model_copy(
            update={
                "units": units.get(food.id, []),
                "last_used": (last_used or {}).get(food.id),
            }
        )
        for food in foods
    ]


async def respond_one(db: AsyncSession, food: FoodItem, user_id: str) -> FoodItemResponse:
    return (await respond(db, [food], user_id))[0]


async def list_foods(
    db: AsyncSession, user_id: str, q: str | None = None
) -> list[FoodItemResponse]:
    """Search the user's visible foods: the ones they logged recently first
    (with how much they had last time), then names starting with the query,
    then the rest by name. Every word of the query must match the name or
    the brand."""
    last = (
        select(
            MealItem.food_item_id,
            MealItem.unit_name,
            MealItem.unit_quantity,
            MealItem.quantity_g,
            Meal.eaten_on,
            Meal.eaten_at,
        )
        .join(Meal, Meal.id == MealItem.meal_id)
        .where(Meal.user_id == user_id, MealItem.food_item_id.is_not(None))
        .order_by(
            MealItem.food_item_id,
            Meal.eaten_on.desc(),
            Meal.eaten_at.desc(),
            MealItem.position.desc(),
        )
        .distinct(MealItem.food_item_id)
        .subquery()
    )
    query = (
        select(FoodItem, last.c.unit_name, last.c.unit_quantity, last.c.quantity_g)
        .outerjoin(last, last.c.food_item_id == FoodItem.id)
        .where(_visible(user_id))
    )
    order = [last.c.eaten_on.desc().nulls_last(), last.c.eaten_at.desc().nulls_last()]
    words = (q or "").split()
    for word in words:
        query = query.where(
            or_(
                FoodItem.name.icontains(word, autoescape=True),
                FoodItem.brand.icontains(word, autoescape=True),
            )
        )
    if words:
        order.append(case((FoodItem.name.istartswith(words[0], autoescape=True), 0), else_=1))
    query = query.order_by(*order, FoodItem.name, FoodItem.id).limit(_SEARCH_LIMIT)

    rows = (await db.execute(query)).all()
    foods = [row[0] for row in rows]
    last_used = {
        row[0].id: LastUsed(unit_name=row[1], unit_quantity=row[2], quantity_g=row[3])
        for row in rows
        if row[2] is not None or row[3] is not None
    }
    return await respond(db, foods, user_id, last_used)


async def get_food(db: AsyncSession, food_id: str, user_id: str) -> FoodItemResponse:
    food = await get_visible_entity(db, FoodItem, food_id, user_id)
    return await respond_one(db, food, user_id)


async def _get_by_barcode(db: AsyncSession, barcode: str) -> FoodItem | None:
    result = await db.execute(select(FoodItem).where(FoodItem.barcode == barcode))
    return result.scalar_one_or_none()


def _add_own_units(db: AsyncSession, food: FoodItem, units: list[FoodUnitCreate]) -> None:
    for unit in units:
        db.add(FoodUnit(food_item_id=food.id, user_id=None, name=unit.name, grams=unit.grams))


async def create_food(
    db: AsyncSession, user_id: str, *, data: FoodItemCreate
) -> tuple[FoodItemResponse, bool]:
    """Create a food with its units, returning ``(food, created)``.

    A barcode identifies an objective product, so barcode foods are shared
    across all users (user_id NULL) rather than owned by their creator. If
    the barcode already exists (or another user creates it concurrently) the
    existing food is returned unchanged with ``created=False`` and the
    submitted values are ignored.
    """
    if data.barcode:
        existing = await _get_by_barcode(db, data.barcode)
        if existing is not None:
            return await respond_one(db, existing, user_id), False

    food = FoodItem(
        name=data.name,
        brand=data.brand,
        kcal_per_100g=data.kcal_per_100g,
        protein_per_100g=data.protein_per_100g,
        carbs_per_100g=data.carbs_per_100g,
        fat_per_100g=data.fat_per_100g,
        barcode=data.barcode,
        user_id=None if data.barcode else user_id,
    )
    db.add(food)
    try:
        await db.flush()
        _add_own_units(db, food, data.units)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await _get_by_barcode(db, data.barcode) if data.barcode else None
        if existing is None:
            raise
        return await respond_one(db, existing, user_id), False
    return await respond_one(db, food, user_id), True


async def _get_editable(db: AsyncSession, food_id: str, user_id: str) -> FoodItem:
    food = await get_visible_entity(db, FoodItem, food_id, user_id)
    if food.seed_key is not None:
        raise HTTPException(status_code=403, detail="Common foods cannot be modified")
    return food


async def update_food(
    db: AsyncSession, food_id: str, user_id: str, *, data: FoodItemUpdate
) -> FoodItemResponse:
    """Correct a food and replace its own units. Personal units stay."""
    food = await _get_editable(db, food_id, user_id)
    food.name = data.name
    food.brand = data.brand
    food.kcal_per_100g = data.kcal_per_100g
    food.protein_per_100g = data.protein_per_100g
    food.carbs_per_100g = data.carbs_per_100g
    food.fat_per_100g = data.fat_per_100g
    result = await db.execute(
        select(FoodUnit).where(FoodUnit.food_item_id == food.id, FoodUnit.user_id.is_(None))
    )
    for unit in result.scalars().all():
        await db.delete(unit)
    await db.flush()
    _add_own_units(db, food, data.units)
    await db.commit()
    await db.refresh(food)
    return await respond_one(db, food, user_id)


async def delete_food(db: AsyncSession, food_id: str, user_id: str) -> None:
    """Delete one of the user's custom foods. Meal items keep their copied
    name and macros; food_item_id becomes NULL (FK SET NULL)."""
    food = await _get_editable(db, food_id, user_id)
    if food.user_id is None:
        raise HTTPException(status_code=403, detail="Shared products cannot be deleted")
    await db.delete(food)
    await db.commit()


async def add_unit(
    db: AsyncSession, food_id: str, user_id: str, *, data: FoodUnitCreate
) -> FoodItemResponse:
    """Add a personal unit to a food the user sees."""
    food = await get_visible_entity(db, FoodItem, food_id, user_id)
    visible = (await _units_by_food(db, [food.id], user_id)).get(food.id, [])
    if any(u.name.lower() == data.name.lower() for u in visible):
        raise HTTPException(status_code=409, detail="This food already has that unit")
    db.add(FoodUnit(food_item_id=food.id, user_id=user_id, name=data.name, grams=data.grams))
    await db.commit()
    return await respond_one(db, food, user_id)


async def delete_unit(db: AsyncSession, food_id: str, unit_id: str, user_id: str) -> None:
    """Remove a personal unit, or one of the food's own units if the user may
    edit the food."""
    food = await get_visible_entity(db, FoodItem, food_id, user_id)
    result = await db.execute(
        select(FoodUnit).where(
            FoodUnit.id == unit_id,
            FoodUnit.food_item_id == food.id,
            or_(FoodUnit.user_id.is_(None), FoodUnit.user_id == user_id),
        )
    )
    unit = result.scalar_one_or_none()
    if unit is None:
        raise HTTPException(status_code=404, detail="Unit not found")
    if unit.user_id is None and food.seed_key is not None:
        raise HTTPException(status_code=403, detail="Common foods cannot be modified")
    await db.delete(unit)
    await db.commit()


async def lookup_barcode(db: AsyncSession, barcode: str, user_id: str) -> BarcodeLookupResponse:
    """Resolve a scanned barcode: local DB, then Open Food Facts, else a draft."""
    food = await _get_by_barcode(db, barcode)
    if food is not None:
        return BarcodeLookupResponse(status="found", food=await respond_one(db, food, user_id))

    # End the read transaction so no pooled connection sits idle in a
    # transaction during the (up to 5s) Open Food Facts request.
    await db.commit()
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
        barcode=barcode,
        user_id=None,
    )
    db.add(food)
    try:
        await db.flush()
        _add_own_units(db, food, draft.units)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        food = await _get_by_barcode(db, barcode)
        if food is None:
            raise
    return BarcodeLookupResponse(status="found", food=await respond_one(db, food, user_id))
