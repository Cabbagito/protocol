"""Meals: whatever a user ate at one time, saved as full snapshots.

A meal's name and timeline summary come from Claude (``meal_summary``) and
describe one set of items, fingerprinted by ``items_key``. When the items
change, both go stale until Claude has caught up: responses then carry no
summary and, for auto-named meals, no name, so the client shows the foods, and
``naming`` while Claude is at it.
"""

import hashlib
import json
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food_item import FoodItem
from app.models.meal import Meal, MealItem
from app.schemas.daily_targets import DailyTargetsResponse
from app.schemas.meal import DayKcal, DayResponse, MacroTotals, MealPut, MealResponse
from app.services import claude, daily_targets_service

MAX_DAYS = 92

# Summary jobs running per meal id. Kept in the process, like the login
# throttle: the API runs as a single uvicorn worker.
_naming: Counter[str] = Counter()


def items_key(items: Sequence[MealItem]) -> str:
    """Fingerprint of what a summary describes: names and amounts, in order."""
    payload = [[i.name, i.unit_name, i.unit_quantity, i.quantity_g] for i in items]
    return hashlib.sha256(json.dumps(payload).encode()).hexdigest()


def amount_label(item: MealItem) -> str | None:
    """How much was eaten, as the user entered it: "150 g", "2 cup (182 g)"."""
    if item.unit_name and item.unit_quantity is not None:
        grams = f" ({item.quantity_g:g} g)" if item.quantity_g is not None else ""
        return f"{item.unit_quantity:g} {item.unit_name}{grams}"
    if item.quantity_g is not None:
        return f"{item.quantity_g:g} g"
    return None


def _totals(items: Sequence[MealItem]) -> MacroTotals:
    return MacroTotals(
        kcal=sum(i.kcal for i in items),
        protein_g=sum(i.protein_g for i in items),
        carbs_g=sum(i.carbs_g for i in items),
        fat_g=sum(i.fat_g for i in items),
    )


def meal_response(meal: Meal) -> MealResponse:
    current = meal.summary_key is not None and meal.summary_key == items_key(meal.items)
    return MealResponse(
        id=meal.id,
        eaten_on=meal.eaten_on,
        eaten_at=meal.eaten_at,
        name=meal.name if meal.name_source == "user" or current else None,
        name_source=meal.name_source,
        summary=meal.summary if current else None,
        naming=_naming[meal.id] > 0,
        totals=_totals(meal.items),
        items=meal.items,
    )


async def get_day(db: AsyncSession, user_id: str, day: date) -> DayResponse:
    result = await db.execute(
        select(Meal)
        .where(Meal.user_id == user_id, Meal.eaten_on == day)
        .order_by(Meal.eaten_at, Meal.created_at)
    )
    meals = result.scalars().all()
    targets = await daily_targets_service.get_targets(db, user_id)
    return DayResponse(
        date=day,
        totals=_totals([i for m in meals for i in m.items]),
        targets=DailyTargetsResponse.model_validate(targets),
        meals=[meal_response(m) for m in meals],
    )


async def list_days(db: AsyncSession, user_id: str, start: date, end: date) -> list[DayKcal]:
    """Kcal per day with meals, for the week strip and the calendar."""
    if end < start:
        raise HTTPException(status_code=422, detail="'to' is before 'from'")
    if (end - start).days >= MAX_DAYS:
        raise HTTPException(status_code=422, detail=f"At most {MAX_DAYS} days at a time")
    result = await db.execute(
        select(Meal.eaten_on, func.sum(MealItem.kcal))
        .join(MealItem, MealItem.meal_id == Meal.id)
        .where(Meal.user_id == user_id, Meal.eaten_on >= start, Meal.eaten_on <= end)
        .group_by(Meal.eaten_on)
        .order_by(Meal.eaten_on)
    )
    return [DayKcal(date=d, kcal=kcal) for d, kcal in result.all()]


async def _get_own(
    db: AsyncSession, meal_id: str, user_id: str, *, for_update: bool = False
) -> Meal | None:
    """The meal, None if it doesn't exist yet; another user's meal is a 404."""
    meal = await db.get(Meal, meal_id, with_for_update=for_update)
    if meal is not None and meal.user_id != user_id:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal


async def get_meal(db: AsyncSession, meal_id: str, user_id: str) -> MealResponse:
    meal = await _get_own(db, meal_id, user_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal_response(meal)


async def _check_foods(db: AsyncSession, user_id: str, food_ids: set[str]) -> None:
    if not food_ids:
        return
    result = await db.execute(
        select(FoodItem.id).where(
            FoodItem.id.in_(food_ids),
            or_(FoodItem.user_id == user_id, FoodItem.user_id.is_(None)),
        )
    )
    if food_ids - set(result.scalars().all()):
        raise HTTPException(status_code=404, detail="Food item not found")


@dataclass(frozen=True)
class SummaryJob:
    """A meal whose current items Claude hasn't named and summarized yet."""

    meal_id: str
    key: str
    foods: list[str]


def summary_done(job: SummaryJob) -> None:
    """The job finished, named the meal or not."""
    _naming[job.meal_id] -= 1
    if _naming[job.meal_id] <= 0:
        del _naming[job.meal_id]


async def save_meal(
    db: AsyncSession, meal_id: str, user_id: str, *, data: MealPut, _retry: bool = True
) -> tuple[MealResponse, SummaryJob | None]:
    """Create or replace a meal from the client's snapshot (idempotent).

    A name in the snapshot is the user's and always wins; no name hands the
    meal back to Claude. Returns the job for Claude when the items have no
    current summary and Claude is set up; the meal is ``naming`` until the
    job calls ``summary_done``.
    """
    meal = await _get_own(db, meal_id, user_id, for_update=True)
    await _check_foods(db, user_id, {i.food_item_id for i in data.items if i.food_item_id})

    if meal is None:
        meal = Meal(id=meal_id, user_id=user_id, name_source="auto", items=[])
        db.add(meal)
    meal.eaten_on = data.eaten_on
    meal.eaten_at = data.eaten_at
    if data.name is not None:
        meal.name = data.name
        meal.name_source = "user"
    elif meal.name_source == "user":
        # Back to Claude's name, which the user's had replaced.
        meal.name = None
        meal.name_source = "auto"
        meal.summary_key = None
    meal.items = [
        MealItem(position=position, **item.model_dump()) for position, item in enumerate(data.items)
    ]
    try:
        await db.commit()
    except IntegrityError:
        # Another request created this id first: save over it.
        await db.rollback()
        if not _retry:
            raise
        return await save_meal(db, meal_id, user_id, data=data, _retry=False)

    key = items_key(meal.items)
    job = None
    if meal.summary_key != key and claude.get_client() is not None:
        foods = [f"{i.name} — {amount_label(i) or 'some'}" for i in meal.items]
        job = SummaryJob(meal_id=meal.id, key=key, foods=foods)
        _naming[meal.id] += 1
    return meal_response(meal), job


async def delete_meal(db: AsyncSession, meal_id: str, user_id: str) -> None:
    meal = await _get_own(db, meal_id, user_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    await db.delete(meal)
    await db.commit()
