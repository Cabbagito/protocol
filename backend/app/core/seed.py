import json
import logging
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import generate_uuid
from app.models.exercise import Exercise
from app.models.food_item import FoodItem
from app.models.food_unit import FoodUnit
from app.models.mesocycle import Mesocycle
from app.models.split import Split, SplitDay, SplitDayExercise
from app.models.user import User

logger = logging.getLogger(__name__)

_SEED_DATA_DIR = Path(__file__).parent / "seed_data"


def _load_json(filename: str) -> list | dict:
    return json.loads((_SEED_DATA_DIR / filename).read_text())


COMMON_EXERCISES: list[dict] = _load_json("exercises.json")
DEFAULT_SPLITS: list[dict] = _load_json("splits.json")
COMMON_FOODS: list[dict] = _load_json("foods.json")


async def seed_exercises(session: AsyncSession) -> int:
    """Seed exercises using upsert-by-seed_key. Returns count of added/updated exercises."""
    result = await session.execute(select(Exercise))
    existing = result.scalars().all()
    by_seed_key = {e.seed_key: e for e in existing if e.seed_key}

    added = 0
    updated = 0

    for ex_data in COMMON_EXERCISES:
        sk = ex_data["seed_key"]
        name = ex_data["name"]
        muscle_group = ex_data["muscle_group"]
        equipment_type = ex_data["equipment_type"]

        if sk in by_seed_key:
            existing_ex = by_seed_key[sk]
            changed = False
            if existing_ex.name != name:
                existing_ex.name = name
                changed = True
            if existing_ex.muscle_group != muscle_group:
                existing_ex.muscle_group = muscle_group
                changed = True
            if existing_ex.equipment_type != equipment_type:
                existing_ex.equipment_type = equipment_type
                changed = True
            if changed:
                updated += 1
        else:
            exercise = Exercise(
                seed_key=sk,
                name=name,
                muscle_group=muscle_group,
                equipment_type=equipment_type,
            )
            session.add(exercise)
            added += 1

    if added > 0 or updated > 0:
        await session.commit()
        if added:
            logger.info("Seeded %d new exercises", added)
        if updated:
            logger.info("Updated %d existing exercises", updated)

    return added + updated


_FOOD_FIELDS = (
    "name",
    "brand",
    "kcal_per_100g",
    "protein_per_100g",
    "carbs_per_100g",
    "fat_per_100g",
)


def _plan_seed_units(
    units: list[dict], current: list[FoodUnit]
) -> tuple[list[FoodUnit], list[dict], bool]:
    """Compare a seeded food's own units with the seed file: returns (units to
    delete, unit specs to add, whether anything changed). Matching units are
    updated in place. Seeded foods are read-only, so their own (user_id NULL)
    units come only from here; units users added for themselves are left
    alone."""
    wanted = {u["name"].lower(): u for u in units}
    have = {u.name.lower(): u for u in current}
    to_delete = [unit for key, unit in have.items() if key not in wanted]
    to_add = [spec for key, spec in wanted.items() if key not in have]
    changed = bool(to_delete or to_add)
    for key, unit in have.items():
        spec = wanted.get(key)
        if spec is not None and (unit.name != spec["name"] or unit.grams != spec["grams"]):
            unit.name = spec["name"]
            unit.grams = spec["grams"]
            changed = True
    return to_delete, to_add, changed


async def seed_foods(session: AsyncSession) -> int:
    """Seed food items and their units using upsert-by-seed_key. Returns
    count added/updated."""
    result = await session.execute(select(FoodItem))
    existing = result.scalars().all()
    by_seed_key = {f.seed_key: f for f in existing if f.seed_key}

    result = await session.execute(
        select(FoodUnit)
        .join(FoodItem, FoodItem.id == FoodUnit.food_item_id)
        .where(FoodItem.seed_key.is_not(None), FoodUnit.user_id.is_(None))
    )
    units_by_food: dict[str, list[FoodUnit]] = {}
    for unit in result.scalars().all():
        units_by_food.setdefault(unit.food_item_id, []).append(unit)

    added = 0
    updated = 0

    for row in COMMON_FOODS:
        sk = row["seed_key"]
        values = {field: row.get(field) for field in _FOOD_FIELDS}
        units = row.get("units", [])

        food = by_seed_key.get(sk)
        if food is None:
            food = FoodItem(id=generate_uuid(), seed_key=sk, **values)
            session.add(food)
            for spec in units:
                session.add(FoodUnit(food_item_id=food.id, name=spec["name"], grams=spec["grams"]))
            added += 1
            continue

        changed = False
        for field, value in values.items():
            if getattr(food, field) != value:
                setattr(food, field, value)
                changed = True
        to_delete, to_add, units_changed = _plan_seed_units(units, units_by_food.get(food.id, []))
        if units_changed:
            changed = True
            for unit in to_delete:
                await session.delete(unit)
            # Delete before insert: a renamed unit may reuse a deleted name.
            await session.flush()
            for spec in to_add:
                session.add(FoodUnit(food_item_id=food.id, name=spec["name"], grams=spec["grams"]))
        if changed:
            updated += 1

    if added > 0 or updated > 0:
        await session.commit()
        if added:
            logger.info("Seeded %d new foods", added)
        if updated:
            logger.info("Updated %d existing foods", updated)

    return added + updated


async def seed_default_splits(session: AsyncSession) -> int:
    """Seed default splits (insert-only, never overwrites user edits)."""
    result = await session.execute(select(Split.seed_key).where(Split.seed_key.isnot(None)))
    existing_keys = set(result.scalars().all())

    result = await session.execute(select(Exercise).where(Exercise.seed_key.isnot(None)))
    exercises_by_key = {e.seed_key: e for e in result.scalars().all()}

    added = 0
    for split_data in DEFAULT_SPLITS:
        if split_data["seed_key"] in existing_keys:
            continue

        color = split_data.get("color", "#06b6d4")
        split = Split(name=split_data["name"], seed_key=split_data["seed_key"], color=color)
        session.add(split)
        await session.flush()

        for day_data in split_data["days"]:
            day = SplitDay(
                split_id=split.id,
                name=day_data["name"],
                day_order=day_data["day_order"],
            )
            session.add(day)
            await session.flush()

            for order, ex_data in enumerate(day_data["exercises"]):
                exercise = exercises_by_key.get(ex_data["seed_key"])
                if not exercise:
                    logger.warning(
                        "Exercise with seed_key '%s' not found, skipping in day '%s'",
                        ex_data["seed_key"],
                        day_data["name"],
                    )
                    continue
                session.add(
                    SplitDayExercise(
                        day_id=day.id,
                        exercise_id=exercise.id,
                        order=order,
                    )
                )

        added += 1
        logger.info("Seeded default split: %s", split_data["name"])

    if added:
        await session.commit()
    return added


async def ensure_bootstrap_user(session: AsyncSession) -> None:
    """Bootstrap the first user on first run. Further users are created
    server-side via scripts/manage_users.py."""
    from app.core.config import settings
    from app.core.security import hash_password

    result = await session.execute(select(User).limit(1))
    if result.scalar_one_or_none() is not None:
        return

    if not settings.app_password:
        return

    admin = User(
        name=settings.admin_name,
        password_hash=hash_password(settings.app_password),
    )
    session.add(admin)
    await session.flush()

    # Assign orphan non-seed exercises to admin
    await session.execute(
        update(Exercise)
        .where(Exercise.seed_key.is_(None), Exercise.user_id.is_(None))
        .values(user_id=admin.id)
    )

    # Assign orphan non-seed splits to admin
    await session.execute(
        update(Split)
        .where(Split.seed_key.is_(None), Split.user_id.is_(None))
        .values(user_id=admin.id)
    )

    # Assign all orphan mesocycles to admin
    await session.execute(
        update(Mesocycle).where(Mesocycle.user_id.is_(None)).values(user_id=admin.id)
    )

    # Assign orphan custom food items to admin. Barcode foods are shared by
    # design (user_id NULL) and stay that way.
    await session.execute(
        update(FoodItem)
        .where(
            FoodItem.seed_key.is_(None),
            FoodItem.barcode.is_(None),
            FoodItem.user_id.is_(None),
        )
        .values(user_id=admin.id)
    )

    await session.commit()
