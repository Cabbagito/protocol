"""Small API helpers shared by the DB-backed tests."""

from httpx import AsyncClient


async def seeded_exercise_ids(client: AsyncClient, headers: dict, count: int) -> list[str]:
    resp = await client.get("/api/exercises", headers=headers)
    assert resp.status_code == 200
    return [e["id"] for e in resp.json()][:count]


async def create_split(
    client: AsyncClient,
    headers: dict,
    *,
    name: str = "Test Split",
    days: list[list[str]],
) -> dict:
    payload = {
        "name": name,
        "days": [
            {"name": f"Day {i + 1}", "exercises": [{"exercise_id": eid} for eid in ids]}
            for i, ids in enumerate(days)
        ],
    }
    resp = await client.post("/api/splits", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def create_mesocycle(
    client: AsyncClient,
    headers: dict,
    split_id: str,
    *,
    name: str = "Block",
    total_weeks: int = 3,
) -> dict:
    resp = await client.post(
        "/api/mesocycles",
        json={"split_id": split_id, "name": name, "total_weeks": total_weeks},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def make_mesocycle(
    client: AsyncClient, headers: dict, *, days: int = 2, per_day: int = 2, total_weeks: int = 3
) -> dict:
    """A split of ``days`` x ``per_day`` seeded exercises and a mesocycle from it."""
    ids = await seeded_exercise_ids(client, headers, days * per_day)
    split = await create_split(
        client, headers, days=[ids[i * per_day : (i + 1) * per_day] for i in range(days)]
    )
    return await create_mesocycle(client, headers, split["id"], total_weeks=total_weeks)


def full_session_log(mesocycle: dict, week_index: int, session_index: int) -> dict:
    """A /api/workouts/log payload logging every set of one session and finishing it."""
    session = mesocycle["structure"]["weeks"][week_index]["sessions"][session_index]
    sets = [
        {"exercise_id": ex["exercise_id"], "set_num": s["set_num"], "weight": 60, "reps": 8}
        for ex in session["exercises"]
        for s in ex["sets"]
    ]
    return {
        "mesocycle_id": mesocycle["id"],
        "week_index": week_index,
        "session_index": session_index,
        "sets": sets,
        "complete": True,
    }
