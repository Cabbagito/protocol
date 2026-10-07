"""Workout endpoints against a real database: snapshot saves, ownership,
completion, and the exercise-list operations."""

from tests.api.helpers import full_session_snapshot, make_mesocycle, seeded_exercise_ids


def _snap(meso: dict, wi: int, si: int, exercises: list[dict], logged_on: str | None = None):
    body = {
        "mesocycle_id": meso["id"],
        "week_index": wi,
        "session_index": si,
        "exercises": exercises,
    }
    if logged_on:
        body["logged_on"] = logged_on
    return body


def _ex(exercise_id: str, sets: list[dict], skipped: bool = False) -> dict:
    return {"exercise_id": exercise_id, "skipped": skipped, "sets": sets}


async def _structure(client, user, meso_id: str) -> dict:
    resp = await client.get(f"/api/mesocycles/{meso_id}", headers=user.headers)
    assert resp.status_code == 200
    return resp.json()["structure"]


async def test_save_session_logs_sets_and_dates_from_client(client, user):
    meso = await make_mesocycle(client, user.headers)
    ex_id = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    resp = await client.put(
        "/api/workouts/session",
        json=_snap(
            meso,
            0,
            0,
            [_ex(ex_id, [{"weight": 100, "reps": 8, "logged": True}, {"weight": 100}, {}])],
            logged_on="2026-10-05",
        ),
        headers=user.headers,
    )
    assert resp.status_code == 200, resp.text
    session = resp.json()["session"]
    assert session["date"] == "2026-10-05"
    assert session["exercises"][0]["sets"][0]["logged"] is True
    # The response is exactly what is now stored.
    stored = (await _structure(client, user, meso["id"]))["weeks"][0]["sessions"][0]
    assert stored == session


async def test_save_session_is_idempotent(client, user):
    meso = await make_mesocycle(client, user.headers)
    body = full_session_snapshot(meso, 0, 0)
    first = await client.put("/api/workouts/session", json=body, headers=user.headers)
    second = await client.put("/api/workouts/session", json=body, headers=user.headers)
    assert first.json() == second.json()


async def test_logged_set_requires_weight_and_reps(client, user):
    meso = await make_mesocycle(client, user.headers)
    ex_id = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    resp = await client.put(
        "/api/workouts/session",
        json=_snap(meso, 0, 0, [_ex(ex_id, [{"weight": 100, "reps": 0, "logged": True}])]),
        headers=user.headers,
    )
    assert resp.status_code == 422


async def test_cannot_save_into_another_users_mesocycle(client, user, other_user):
    meso = await make_mesocycle(client, user.headers)
    resp = await client.put(
        "/api/workouts/session", json=full_session_snapshot(meso, 0, 0), headers=other_user.headers
    )
    assert resp.status_code == 404


async def test_invalid_position_is_rejected(client, user):
    meso = await make_mesocycle(client, user.headers)
    body = full_session_snapshot(meso, 0, 0)
    for wi, si in ((9, 0), (0, 9)):
        resp = await client.put(
            "/api/workouts/session",
            json={**body, "week_index": wi, "session_index": si},
            headers=user.headers,
        )
        assert resp.status_code == 400


async def test_skipped_sets_complete_the_session(client, user):
    meso = await make_mesocycle(client, user.headers, days=1, per_day=1, total_weeks=3)
    ex_id = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    await client.put(
        "/api/workouts/session",
        json=_snap(
            meso,
            0,
            0,
            [
                _ex(
                    ex_id,
                    [
                        {"weight": 60, "reps": 8, "logged": True},
                        {"skipped": True},
                        {"skipped": True},
                    ],
                )
            ],
        ),
        headers=user.headers,
    )
    detail = (await client.get(f"/api/mesocycles/{meso['id']}", headers=user.headers)).json()
    assert detail["workouts_completed"] == 1
    assert detail["current_week"] == 2


async def test_completing_and_reopening_tracks_completed_at(client, user, db):
    from sqlalchemy import select

    from app.models.mesocycle import Mesocycle

    meso = await make_mesocycle(client, user.headers, days=1, per_day=1, total_weeks=3)
    for wi in range(3):
        resp = await client.put(
            "/api/workouts/session", json=full_session_snapshot(meso, wi, 0), headers=user.headers
        )
        assert resp.status_code == 200
    completed = await db.scalar(select(Mesocycle.completed_at).where(Mesocycle.id == meso["id"]))
    assert completed is not None

    # Un-logging a set reopens the mesocycle.
    ex_id = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    await client.put(
        "/api/workouts/session",
        json=_snap(meso, 2, 0, [_ex(ex_id, [{"weight": 60, "reps": 8, "logged": True}, {}, {}])]),
        headers=user.headers,
    )
    db.expire_all()
    reopened = await db.scalar(select(Mesocycle.completed_at).where(Mesocycle.id == meso["id"]))
    assert reopened is None


async def test_added_set_propagates_to_future_weeks(client, user):
    meso = await make_mesocycle(client, user.headers, days=1, per_day=1, total_weeks=3)
    ex_id = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    await client.put(
        "/api/workouts/session",
        json=_snap(meso, 0, 0, [_ex(ex_id, [{}, {}, {}, {}])]),
        headers=user.headers,
    )
    weeks = (await _structure(client, user, meso["id"]))["weeks"]
    assert [len(w["sessions"][0]["exercises"][0]["sets"]) for w in weeks] == [4, 4, 4]


async def test_set_count_change_can_stay_in_its_session(client, user):
    meso = await make_mesocycle(client, user.headers, days=1, per_day=1, total_weeks=3)
    ex_id = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    body = _snap(meso, 0, 0, [_ex(ex_id, [{}, {}, {}, {}])])
    body["apply_to_future"] = False
    await client.put("/api/workouts/session", json=body, headers=user.headers)
    weeks = (await _structure(client, user, meso["id"]))["weeks"]
    assert [len(w["sessions"][0]["exercises"][0]["sets"]) for w in weeks] == [4, 3, 3]


async def test_add_exercise_rejects_duplicates_and_skips_started_sessions(client, user):
    meso = await make_mesocycle(client, user.headers, days=1, per_day=1, total_weeks=3)
    first = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    # Week 2 is already started (one set logged out of order).
    await client.put(
        "/api/workouts/session",
        json=_snap(meso, 1, 0, [_ex(first, [{"weight": 50, "reps": 5, "logged": True}, {}, {}])]),
        headers=user.headers,
    )
    pos = {"mesocycle_id": meso["id"], "week_index": 0, "session_index": 0}

    dup = await client.post(
        "/api/workouts/add-exercise", json={**pos, "exercise_id": first}, headers=user.headers
    )
    assert dup.status_code == 409

    other = (await seeded_exercise_ids(client, user.headers, 10))[-1]
    resp = await client.post(
        "/api/workouts/add-exercise", json={**pos, "exercise_id": other}, headers=user.headers
    )
    assert resp.status_code == 200
    weeks = (await _structure(client, user, meso["id"]))["weeks"]
    counts = [len(w["sessions"][0]["exercises"]) for w in weeks]
    assert counts == [2, 1, 2]  # not added to the started week 2


async def test_replace_keeps_logged_sets_on_the_original_exercise(client, user):
    meso = await make_mesocycle(client, user.headers, days=1, per_day=1, total_weeks=3)
    old = meso["structure"]["weeks"][0]["sessions"][0]["exercises"][0]["exercise_id"]
    await client.put(
        "/api/workouts/session",
        json=_snap(meso, 0, 0, [_ex(old, [{"weight": 50, "reps": 5, "logged": True}, {}, {}])]),
        headers=user.headers,
    )
    new = (await seeded_exercise_ids(client, user.headers, 10))[-1]
    resp = await client.post(
        "/api/workouts/replace-exercise",
        json={
            "mesocycle_id": meso["id"],
            "week_index": 0,
            "session_index": 0,
            "exercise_index": 0,
            "old_exercise_id": old,
            "new_exercise_id": new,
        },
        headers=user.headers,
    )
    assert resp.status_code == 200, resp.text
    weeks = (await _structure(client, user, meso["id"]))["weeks"]
    w1 = weeks[0]["sessions"][0]["exercises"]
    assert [(e["exercise_id"], len(e["sets"])) for e in w1] == [(old, 1), (new, 2)]
    assert w1[0]["sets"][0]["logged"] is True
    # Future weeks swap in place.
    assert [e["exercise_id"] for e in weeks[1]["sessions"][0]["exercises"]] == [new]


async def test_history_reports_session_position(client, user):
    meso = await make_mesocycle(client, user.headers, days=2, per_day=1, total_weeks=3)
    ex_id = meso["structure"]["weeks"][0]["sessions"][1]["exercises"][0]["exercise_id"]
    await client.put(
        "/api/workouts/session", json=full_session_snapshot(meso, 0, 1), headers=user.headers
    )
    history = (await client.get(f"/api/exercises/{ex_id}/history", headers=user.headers)).json()
    assert [(h["week_index"], h["session_index"]) for h in history] == [(0, 1)]
