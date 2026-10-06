"""Daily macro targets and body weight: upserts, validation, isolation."""

import pytest

from app.services import daily_targets_service

TARGETS = "/api/me/daily-targets"


async def test_targets_default_on_first_read(client, user):
    resp = await client.get(TARGETS, headers=user.headers)
    assert resp.status_code == 200
    assert resp.json() == {"protein_g": 160, "carbs_g": 250, "fat_g": 70, "kcal": 2270}
    # Second read returns the same row.
    assert (await client.get(TARGETS, headers=user.headers)).json() == resp.json()


async def test_update_targets_without_prior_read(client, user):
    resp = await client.put(
        TARGETS, json={"protein_g": 180, "carbs_g": 200, "fat_g": 60}, headers=user.headers
    )
    assert resp.status_code == 200
    assert resp.json()["kcal"] == 180 * 4 + 200 * 4 + 60 * 9
    assert (await client.get(TARGETS, headers=user.headers)).json() == resp.json()


async def test_update_targets_overwrites(client, user, other_user):
    await client.get(TARGETS, headers=user.headers)
    resp = await client.put(
        TARGETS, json={"protein_g": 200, "carbs_g": 100, "fat_g": 80}, headers=user.headers
    )
    assert resp.status_code == 200
    assert resp.json()["protein_g"] == 200
    # Other users keep their own targets.
    theirs = (await client.get(TARGETS, headers=other_user.headers)).json()
    assert theirs["protein_g"] == 160


async def test_zero_carbs_and_fat_allowed(client, user):
    resp = await client.put(
        TARGETS, json={"protein_g": 150, "carbs_g": 0, "fat_g": 0}, headers=user.headers
    )
    assert resp.status_code == 200
    assert resp.json()["kcal"] == 600


@pytest.mark.parametrize(
    "payload",
    [
        {"protein_g": 0, "carbs_g": 100, "fat_g": 50},
        {"protein_g": 150, "carbs_g": -1, "fat_g": 50},
        {"protein_g": 150, "carbs_g": 100, "fat_g": -0.5},
    ],
)
async def test_invalid_targets_rejected(client, user, payload):
    resp = await client.put(TARGETS, json=payload, headers=user.headers)
    assert resp.status_code == 422


async def test_first_read_race_does_not_fail(client, user, monkeypatch):
    """Another request inserts the defaults between our SELECT and INSERT."""
    await client.put(
        TARGETS, json={"protein_g": 190, "carbs_g": 210, "fat_g": 65}, headers=user.headers
    )

    real_select = daily_targets_service._select
    calls = {"n": 0}

    async def _stale_first(db, user_id):
        calls["n"] += 1
        return None if calls["n"] == 1 else await real_select(db, user_id)

    monkeypatch.setattr(daily_targets_service, "_select", _stale_first)
    resp = await client.get(TARGETS, headers=user.headers)
    assert resp.status_code == 200
    # The concurrent writer's row wins; defaults don't overwrite it.
    assert resp.json()["protein_g"] == 190


# --- body weight ---


async def test_weigh_in_twice_same_day_replaces(client, user):
    first = await client.post(
        "/api/weight-logs",
        json={"logged_on": "2026-06-01", "weight_kg": 82.4},
        headers=user.headers,
    )
    assert first.status_code == 201
    second = await client.post(
        "/api/weight-logs",
        json={"logged_on": "2026-06-01", "weight_kg": 81.9},
        headers=user.headers,
    )
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["weight_kg"] == 81.9

    logs = (await client.get("/api/weight-logs", headers=user.headers)).json()
    assert [(w["logged_on"], w["weight_kg"]) for w in logs] == [("2026-06-01", 81.9)]


async def test_weights_are_per_user_and_ordered(client, user, other_user):
    for day, kg in (("2026-06-03", 81.0), ("2026-06-01", 82.0)):
        await client.post(
            "/api/weight-logs", json={"logged_on": day, "weight_kg": kg}, headers=user.headers
        )
    await client.post(
        "/api/weight-logs",
        json={"logged_on": "2026-06-01", "weight_kg": 60.0},
        headers=other_user.headers,
    )

    mine = (await client.get("/api/weight-logs", headers=user.headers)).json()
    assert [w["logged_on"] for w in mine] == ["2026-06-01", "2026-06-03"]
    theirs = (await client.get("/api/weight-logs", headers=other_user.headers)).json()
    assert [w["weight_kg"] for w in theirs] == [60.0]

    resp = await client.delete(f"/api/weight-logs/{mine[0]['id']}", headers=other_user.headers)
    assert resp.status_code == 404
    resp = await client.delete(f"/api/weight-logs/{mine[0]['id']}", headers=user.headers)
    assert resp.status_code == 204


@pytest.mark.parametrize("kg", [0, -1, 500])
async def test_weight_bounds(client, user, kg):
    resp = await client.post(
        "/api/weight-logs", json={"logged_on": "2026-06-01", "weight_kg": kg}, headers=user.headers
    )
    assert resp.status_code == 422
