"""Mesocycle lifecycle against a real database: completion, split deletion,
the one-active-per-user invariant."""

from datetime import date

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models.mesocycle import Mesocycle
from app.services import mesocycle_service
from tests.api.helpers import full_session_log, make_mesocycle


async def _active_count(db, user_id: str) -> int:
    return await db.scalar(
        select(func.count())
        .select_from(Mesocycle)
        .where(Mesocycle.user_id == user_id, Mesocycle.is_active.is_(True))
    )


async def test_finishing_final_workout_sets_completed_at(client, user, db):
    """Regression: completed_at was a naive column while the code assigns an
    aware datetime, so the last workout of a mesocycle 500'd under asyncpg."""
    meso = await make_mesocycle(client, user.headers, days=2, total_weeks=3)
    weeks = meso["structure"]["weeks"]

    for wi, week in enumerate(weeks):
        for si in range(len(week["sessions"])):
            resp = await client.post(
                "/api/workouts/log", json=full_session_log(meso, wi, si), headers=user.headers
            )
            assert resp.status_code == 200, resp.text

    completed_at = await db.scalar(select(Mesocycle.completed_at).where(Mesocycle.id == meso["id"]))
    assert completed_at is not None
    assert completed_at.tzinfo is not None

    detail = (await client.get(f"/api/mesocycles/{meso['id']}", headers=user.headers)).json()
    assert detail["workouts_completed"] == 6


async def test_deleting_split_keeps_its_mesocycles(client, user):
    meso = await make_mesocycle(client, user.headers)
    split_id = meso["split_id"]
    assert meso["split_name"] == "Test Split"

    # Log one workout so there is history to lose.
    resp = await client.post(
        "/api/workouts/log", json=full_session_log(meso, 0, 0), headers=user.headers
    )
    assert resp.status_code == 200

    resp = await client.delete(f"/api/splits/{split_id}", headers=user.headers)
    assert resp.status_code == 204

    detail = await client.get(f"/api/mesocycles/{meso['id']}", headers=user.headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["split_id"] is None
    assert body["split_name"] is None
    assert body["split_color"] is None
    assert body["workouts_completed"] == 1

    listing = (await client.get("/api/mesocycles", headers=user.headers)).json()
    assert [m["id"] for m in listing] == [meso["id"]]
    assert listing[0]["split_name"] is None

    active = (await client.get("/api/mesocycles/active", headers=user.headers)).json()
    assert active["id"] == meso["id"]

    # The workout flow keeps working without the split.
    template = await client.get(f"/api/workouts/template/{meso['id']}", headers=user.headers)
    assert template.status_code == 200
    resp = await client.post(
        "/api/workouts/log", json=full_session_log(meso, 0, 1), headers=user.headers
    )
    assert resp.status_code == 200

    renamed = await client.put(
        f"/api/mesocycles/{meso['id']}", json={"name": "Renamed"}, headers=user.headers
    )
    assert renamed.status_code == 200
    assert renamed.json()["split_name"] is None


async def test_creating_mesocycle_deactivates_previous(client, user, db):
    first = await make_mesocycle(client, user.headers)
    second = await make_mesocycle(client, user.headers)

    listing = (await client.get("/api/mesocycles", headers=user.headers)).json()
    active = {m["id"]: m["is_active"] for m in listing}
    assert active == {first["id"]: False, second["id"]: True}
    assert await _active_count(db, user.id) == 1

    # Re-activating the first deactivates the second.
    resp = await client.put(
        f"/api/mesocycles/{first['id']}", json={"is_active": True}, headers=user.headers
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True
    current = (await client.get("/api/mesocycles/active", headers=user.headers)).json()
    assert current["id"] == first["id"]
    assert await _active_count(db, user.id) == 1


async def test_active_mesocycles_are_per_user(client, user, other_user, db):
    await make_mesocycle(client, user.headers)
    await make_mesocycle(client, other_user.headers)
    assert await _active_count(db, user.id) == 1
    assert await _active_count(db, other_user.id) == 1


async def test_database_rejects_second_active_mesocycle(client, user, db):
    meso = await make_mesocycle(client, user.headers)
    db.add(
        Mesocycle(
            split_id=meso["split_id"],
            user_id=user.id,
            name="Sneaky",
            started_at=date.fromisoformat(meso["started_at"]),
            is_active=True,
            structure={"weeks": []},
        )
    )
    with pytest.raises(IntegrityError):
        await db.commit()
    await db.rollback()


async def test_concurrent_activation_returns_409(client, user, db, monkeypatch):
    """If another request activates a mesocycle between our deactivate and
    insert, the unique index fires; the API must answer 409, not 500."""
    first = await make_mesocycle(client, user.headers)

    async def _lost_race(*args, **kwargs):
        return None

    monkeypatch.setattr(mesocycle_service, "deactivate_user_mesos", _lost_race)

    resp = await client.post(
        "/api/mesocycles",
        json={"split_id": first["split_id"], "name": "Racer", "total_weeks": 3},
        headers=user.headers,
    )
    assert resp.status_code == 409

    # Nothing was written by the failed request.
    listing = (await client.get("/api/mesocycles", headers=user.headers)).json()
    assert [m["id"] for m in listing] == [first["id"]]

    # Same for re-activating through update.
    db.add(
        Mesocycle(
            split_id=first["split_id"],
            user_id=user.id,
            name="Inactive",
            started_at=date.fromisoformat(first["started_at"]),
            is_active=False,
            structure={"weeks": []},
        )
    )
    await db.commit()
    inactive_id = await db.scalar(select(Mesocycle.id).where(Mesocycle.name == "Inactive"))
    resp = await client.put(
        f"/api/mesocycles/{inactive_id}", json={"is_active": True}, headers=user.headers
    )
    assert resp.status_code == 409
    assert await _active_count(db, user.id) == 1


async def test_mesocycle_update_rejects_empty_name(client, user):
    meso = await make_mesocycle(client, user.headers)
    resp = await client.put(
        f"/api/mesocycles/{meso['id']}", json={"name": ""}, headers=user.headers
    )
    assert resp.status_code == 422


async def test_mesocycles_are_private(client, user, other_user):
    meso = await make_mesocycle(client, user.headers)
    resp = await client.get(f"/api/mesocycles/{meso['id']}", headers=other_user.headers)
    assert resp.status_code == 404
    resp = await client.delete(f"/api/mesocycles/{meso['id']}", headers=other_user.headers)
    assert resp.status_code == 404
