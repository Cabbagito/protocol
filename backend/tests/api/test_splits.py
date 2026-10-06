"""Split CRUD and ownership."""

from tests.api.helpers import create_split, seeded_exercise_ids


def _days_payload(*days: list[str]) -> list[dict]:
    return [
        {"name": f"Day {i + 1}", "exercises": [{"exercise_id": eid} for eid in ids]}
        for i, ids in enumerate(days)
    ]


async def test_update_split_keeping_exercises(client, user):
    ids = await seeded_exercise_ids(client, user.headers, 2)
    split = await create_split(client, user.headers, days=[ids])
    resp = await client.put(
        f"/api/splits/{split['id']}",
        json={"name": "Renamed", "days": _days_payload(ids)},
        headers=user.headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Renamed"


async def test_update_split_changing_exercises(client, user):
    """Regression: the reload after an update reused the stale identity-mapped
    days (whose exercises weren't loaded) and 500'd with MissingGreenlet."""
    ids = await seeded_exercise_ids(client, user.headers, 4)
    split = await create_split(client, user.headers, days=[ids[:2]])

    resp = await client.put(
        f"/api/splits/{split['id']}",
        json={"name": "Test Split", "days": _days_payload([ids[2]], [ids[3], ids[0]])},
        headers=user.headers,
    )
    assert resp.status_code == 200, resp.text
    days = resp.json()["days"]
    assert [[e["exercise_id"] for e in d["exercises"]] for d in days] == [
        [ids[2]],
        [ids[3], ids[0]],
    ]

    resp = await client.put(
        f"/api/splits/{split['id']}",
        json={"name": "Test Split", "days": _days_payload([])},
        headers=user.headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["days"][0]["exercises"] == []


async def test_splits_are_private(client, user, other_user):
    ids = await seeded_exercise_ids(client, user.headers, 1)
    split = await create_split(client, user.headers, days=[ids])

    listing = (await client.get("/api/splits", headers=other_user.headers)).json()
    assert split["id"] not in {s["id"] for s in listing}
    for method in ("get", "delete"):
        resp = await getattr(client, method)(
            f"/api/splits/{split['id']}", headers=other_user.headers
        )
        assert resp.status_code == 404
    resp = await client.put(
        f"/api/splits/{split['id']}",
        json={"name": "Mine now", "days": []},
        headers=other_user.headers,
    )
    assert resp.status_code == 404


async def test_seeded_splits_are_read_only(client, user):
    seeded = (await client.get("/api/splits", headers=user.headers)).json()[0]
    resp = await client.get(f"/api/splits/{seeded['id']}", headers=user.headers)
    assert resp.status_code == 200
    resp = await client.delete(f"/api/splits/{seeded['id']}", headers=user.headers)
    assert resp.status_code == 404
