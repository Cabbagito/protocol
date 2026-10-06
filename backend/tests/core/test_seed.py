"""First-run bootstrap user."""

from sqlalchemy import select

from app.core import seed
from app.core.config import settings
from app.models.food_item import FoodItem
from app.models.user import User


def _food(name: str, **kwargs) -> FoodItem:
    return FoodItem(
        name=name,
        kcal_per_100g=100,
        protein_per_100g=10,
        carbs_per_100g=10,
        fat_per_100g=1,
        **kwargs,
    )


async def test_bootstrap_adopts_orphans_but_keeps_barcode_foods_shared(db, monkeypatch):
    monkeypatch.setattr(settings, "app_password", "bootstrap-password")
    monkeypatch.setattr(settings, "admin_name", "Boss")
    db.add_all([_food("Orphan custom"), _food("Shared scan", barcode="4006381333931")])
    await db.commit()

    await seed.ensure_bootstrap_user(db)

    admin = (await db.execute(select(User))).scalar_one()
    assert admin.name == "Boss"
    owners = dict(
        (
            await db.execute(
                select(FoodItem.name, FoodItem.user_id).where(FoodItem.seed_key.is_(None))
            )
        )
        .tuples()
        .all()
    )
    assert owners == {"Orphan custom": admin.id, "Shared scan": None}


async def test_bootstrap_skipped_when_users_exist(db, monkeypatch, user):
    monkeypatch.setattr(settings, "app_password", "bootstrap-password")
    await seed.ensure_bootstrap_user(db)
    assert len((await db.execute(select(User))).scalars().all()) == 1


async def test_bootstrap_skipped_without_password(db, monkeypatch):
    monkeypatch.setattr(settings, "app_password", "")
    await seed.ensure_bootstrap_user(db)
    assert (await db.execute(select(User))).first() is None
