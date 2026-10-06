"""Smoke tests for the DB-backed harness itself: seeding, auth, isolation."""

from sqlalchemy import func, select

from app.core.seed import COMMON_EXERCISES, COMMON_FOODS, DEFAULT_SPLITS
from app.models.exercise import Exercise
from app.models.user import User


async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_requires_auth(client):
    resp = await client.get("/api/exercises")
    assert resp.status_code in (401, 403)


async def test_seed_data_visible_to_user(client, user):
    exercises = (await client.get("/api/exercises", headers=user.headers)).json()
    assert len(exercises) == len(COMMON_EXERCISES)

    foods = (await client.get("/api/foods", headers=user.headers)).json()
    assert len(foods) == min(50, len(COMMON_FOODS))

    splits = (await client.get("/api/splits", headers=user.headers)).json()
    assert len(splits) == len(DEFAULT_SPLITS)


async def test_writes_are_rolled_back_between_tests_part_1(client, user, db):
    resp = await client.post(
        "/api/exercises",
        json={"name": "Isolation Probe", "muscle_group": "chest", "equipment_type": "cable"},
        headers=user.headers,
    )
    assert resp.status_code == 201
    count = await db.scalar(select(func.count()).where(Exercise.name == "Isolation Probe"))
    assert count == 1


async def test_writes_are_rolled_back_between_tests_part_2(db):
    count = await db.scalar(select(func.count()).where(Exercise.name == "Isolation Probe"))
    assert count == 0
    assert await db.scalar(select(func.count()).select_from(User)) == 0
