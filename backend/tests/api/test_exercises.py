"""Custom exercise CRUD, ownership, validation and delete protection."""

import pytest

from tests.api.helpers import create_mesocycle, create_split, seeded_exercise_ids

CUSTOM = {"name": "Cable Y-Raise", "muscle_group": "side delt", "equipment_type": "cable"}


async def _create(client, headers, **overrides) -> dict:
    resp = await client.post("/api/exercises", json={**CUSTOM, **overrides}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_custom_exercise(client, user, other_user):
    ex = await _create(client, user.headers)
    assert ex["name"] == CUSTOM["name"]
    assert ex["muscle_group"] == "side delt"
    assert ex["equipment_type"] == "cable"
    assert ex["user_id"] == user.id

    mine = (await client.get("/api/exercises", headers=user.headers)).json()
    assert ex["id"] in {e["id"] for e in mine}
    theirs = (await client.get("/api/exercises", headers=other_user.headers)).json()
    assert ex["id"] not in {e["id"] for e in theirs}

    resp = await client.get(f"/api/exercises/{ex['id']}", headers=user.headers)
    assert resp.status_code == 200
    resp = await client.get(f"/api/exercises/{ex['id']}", headers=other_user.headers)
    assert resp.status_code == 404


async def test_seeded_exercises_report_no_owner(client, user):
    exercises = (await client.get("/api/exercises", headers=user.headers)).json()
    assert all(e["user_id"] is None for e in exercises)


async def test_custom_exercise_usable_in_split_and_mesocycle(client, user):
    ex = await _create(client, user.headers)
    split = await create_split(client, user.headers, days=[[ex["id"]]])
    meso = await create_mesocycle(client, user.headers, split["id"])
    first = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]
    assert first["exercise_id"] == ex["id"]


async def test_other_users_cannot_use_custom_exercise(client, user, other_user):
    ex = await _create(client, user.headers)
    resp = await client.post(
        "/api/splits",
        json={"name": "Steal", "days": [{"name": "D", "exercises": [{"exercise_id": ex["id"]}]}]},
        headers=other_user.headers,
    )
    assert resp.status_code == 400


async def test_update_own_exercise(client, user):
    ex = await _create(client, user.headers)
    resp = await client.put(
        f"/api/exercises/{ex['id']}",
        json={"name": "Lean-Away Raise", "muscle_group": "side delt", "equipment_type": "dumbbell"},
        headers=user.headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Lean-Away Raise"
    assert resp.json()["equipment_type"] == "dumbbell"


async def test_cannot_modify_other_users_exercise(client, user, other_user):
    ex = await _create(client, user.headers)
    resp = await client.put(f"/api/exercises/{ex['id']}", json=CUSTOM, headers=other_user.headers)
    assert resp.status_code == 404
    resp = await client.delete(f"/api/exercises/{ex['id']}", headers=other_user.headers)
    assert resp.status_code == 404


async def test_cannot_modify_seeded_exercise(client, user):
    [seeded_id] = await seeded_exercise_ids(client, user.headers, 1)
    resp = await client.put(f"/api/exercises/{seeded_id}", json=CUSTOM, headers=user.headers)
    assert resp.status_code == 403
    resp = await client.delete(f"/api/exercises/{seeded_id}", headers=user.headers)
    assert resp.status_code == 403


async def test_delete_unused_exercise(client, user):
    ex = await _create(client, user.headers)
    resp = await client.delete(f"/api/exercises/{ex['id']}", headers=user.headers)
    assert resp.status_code == 204
    resp = await client.get(f"/api/exercises/{ex['id']}", headers=user.headers)
    assert resp.status_code == 404


async def test_delete_blocked_while_split_uses_exercise(client, user):
    ex = await _create(client, user.headers)
    split = await create_split(client, user.headers, days=[[ex["id"]]])

    resp = await client.delete(f"/api/exercises/{ex['id']}", headers=user.headers)
    assert resp.status_code == 409
    assert "1 split(s)" in resp.json()["detail"]
    # The split was not silently changed.
    days = (await client.get(f"/api/splits/{split['id']}", headers=user.headers)).json()["days"]
    assert [e["exercise_id"] for e in days[0]["exercises"]] == [ex["id"]]

    # Once the split no longer uses it, deletion works.
    resp = await client.put(
        f"/api/splits/{split['id']}",
        json={"name": "Test Split", "days": [{"name": "Day 1", "exercises": []}]},
        headers=user.headers,
    )
    assert resp.status_code == 200
    resp = await client.delete(f"/api/exercises/{ex['id']}", headers=user.headers)
    assert resp.status_code == 204


async def test_delete_blocked_while_mesocycle_uses_exercise(client, user):
    ex = await _create(client, user.headers)
    split = await create_split(client, user.headers, days=[[ex["id"]]])
    meso = await create_mesocycle(client, user.headers, split["id"])
    # Removing the split leaves the exercise referenced only by the mesocycle JSON.
    assert (
        await client.delete(f"/api/splits/{split['id']}", headers=user.headers)
    ).status_code == 204

    resp = await client.delete(f"/api/exercises/{ex['id']}", headers=user.headers)
    assert resp.status_code == 409
    assert "0 split(s) and 1 mesocycle(s)" in resp.json()["detail"]

    assert (
        await client.delete(f"/api/mesocycles/{meso['id']}", headers=user.headers)
    ).status_code == 204
    resp = await client.delete(f"/api/exercises/{ex['id']}", headers=user.headers)
    assert resp.status_code == 204


@pytest.mark.parametrize(
    "field,value",
    [
        ("muscle_group", "Chest"),
        ("muscle_group", "neck"),
        ("muscle_group", ""),
        ("equipment_type", "kettlebell"),
        ("equipment_type", ""),
        ("name", ""),
        ("name", "x" * 101),
    ],
)
async def test_create_validates_fields(client, user, field, value):
    resp = await client.post("/api/exercises", json={**CUSTOM, field: value}, headers=user.headers)
    assert resp.status_code == 422


async def test_update_validates_fields(client, user):
    ex = await _create(client, user.headers)
    resp = await client.put(
        f"/api/exercises/{ex['id']}",
        json={**CUSTOM, "muscle_group": "wings"},
        headers=user.headers,
    )
    assert resp.status_code == 422


async def test_every_seeded_muscle_group_and_equipment_is_accepted(client, user):
    from app.core.seed import COMMON_EXERCISES

    groups = {e["muscle_group"] for e in COMMON_EXERCISES}
    equipment = {e["equipment_type"] for e in COMMON_EXERCISES}
    for group in sorted(groups):
        await _create(client, user.headers, muscle_group=group)
    for kind in sorted(equipment):
        await _create(client, user.headers, equipment_type=kind)


def test_vocabularies_cover_seed_data():
    from typing import get_args

    from app.core.seed import COMMON_EXERCISES
    from app.schemas.exercise import EquipmentType, MuscleGroup

    assert {e["muscle_group"] for e in COMMON_EXERCISES} == set(get_args(MuscleGroup))
    assert {e["equipment_type"] for e in COMMON_EXERCISES} == set(get_args(EquipmentType))
