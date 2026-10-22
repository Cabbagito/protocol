"""Meals: snapshot saves, ownership, days, and Claude's names and summaries."""

import uuid
from datetime import date, time

import pytest

from app.models.meal import Meal, MealItem
from app.services import claude, meal_service, meal_summary

DAY = "2026-10-18"


def _item(name="Oats", grams=60.0, **overrides) -> dict:
    return {
        "food_item_id": None,
        "name": name,
        "unit_name": None,
        "unit_quantity": grams,
        "quantity_g": grams,
        "kcal": 228,
        "protein_g": 8,
        "carbs_g": 40,
        "fat_g": 4,
        **overrides,
    }


def _meal(*items, eaten_on=DAY, eaten_at="08:10", **extra) -> dict:
    return {"eaten_on": eaten_on, "eaten_at": eaten_at, "items": list(items) or [_item()], **extra}


async def _put(client, user, meal_id=None, **kwargs):
    meal_id = meal_id or str(uuid.uuid4())
    resp = await client.put(f"/api/meals/{meal_id}", json=_meal(**kwargs), headers=user.headers)
    return meal_id, resp


@pytest.fixture
def summaries(monkeypatch):
    """Stand in for Claude: records the foods asked about and answers with
    whatever the test sets."""
    calls: list[list[str]] = []
    answer: dict = {"value": None}

    async def _suggest(foods):
        calls.append(foods)
        return answer["value"]

    monkeypatch.setattr(claude, "get_client", lambda: object())
    monkeypatch.setattr(meal_summary, "suggest", _suggest)
    return calls, answer


def _summary(name, *lines):
    return meal_summary._Summary(
        name=name, lines=[meal_summary._Line(text=t, items=i) for t, i in lines]
    )


async def test_put_creates_then_replaces(client, user):
    meal_id, resp = await _put(client, user)
    assert resp.status_code == 200
    meal = resp.json()
    assert meal["id"] == meal_id
    assert meal["eaten_at"] == "08:10"
    assert meal["name"] is None
    assert meal["name_source"] == "auto"
    # Without an API key nobody will name it.
    assert meal["naming"] is False
    assert meal["totals"] == {"kcal": 228, "protein_g": 8, "carbs_g": 40, "fat_g": 4}

    items = [_item("Oats"), _item("Banana", 118, unit_name="medium", unit_quantity=1)]
    _, resp = await _put(client, user, meal_id, items=items, eaten_at="08:15:59")
    meal = resp.json()
    assert meal["eaten_at"] == "08:15"
    assert [(i["name"], i["unit_name"], i["unit_quantity"]) for i in meal["items"]] == [
        ("Oats", None, 60),
        ("Banana", "medium", 1),
    ]
    assert meal["totals"]["kcal"] == 456

    # The same snapshot again changes nothing.
    _, again = await _put(client, user, meal_id, items=items, eaten_at="08:15")
    assert [i["name"] for i in again.json()["items"]] == ["Oats", "Banana"]


async def test_meals_are_private(client, user, other_user):
    meal_id, _ = await _put(client, user)
    url = f"/api/meals/{meal_id}"
    assert (await client.get(url, headers=other_user.headers)).status_code == 404
    resp = await client.put(url, json=_meal(), headers=other_user.headers)
    assert resp.status_code == 404
    assert (await client.delete(url, headers=other_user.headers)).status_code == 404
    day = (await client.get(f"/api/meals?date={DAY}", headers=other_user.headers)).json()
    assert day["meals"] == []
    # Still the owner's.
    assert (await client.get(url, headers=user.headers)).status_code == 200


async def test_put_validates_the_snapshot(client, user):
    meal_id = str(uuid.uuid4())
    for body in (
        {**_meal(), "items": []},
        _meal(_item(kcal=-1)),
        _meal(_item(quantity_g=0)),
        {**_meal(), "eaten_at": "25:00"},
    ):
        resp = await client.put(f"/api/meals/{meal_id}", json=body, headers=user.headers)
        assert resp.status_code == 422, body
    resp = await client.put("/api/meals/not-a-uuid", json=_meal(), headers=user.headers)
    assert resp.status_code == 422


async def test_day_lists_meals_by_time_with_totals_and_targets(client, user):
    await _put(client, user, eaten_at="13:30", items=[_item("Salad", kcal=543, protein_g=57)])
    await _put(client, user, eaten_at="08:10")
    await _put(client, user, eaten_on="2026-10-17")

    day = (await client.get(f"/api/meals?date={DAY}", headers=user.headers)).json()
    assert day["date"] == DAY
    assert [m["eaten_at"] for m in day["meals"]] == ["08:10", "13:30"]
    assert day["totals"]["kcal"] == 228 + 543
    assert day["totals"]["protein_g"] == 8 + 57
    assert day["targets"]["kcal"] == 2270


async def test_days_sums_kcal_per_day(client, user, other_user):
    await _put(client, user, eaten_on="2026-10-12")
    await _put(client, user, eaten_on="2026-10-12", items=[_item(kcal=100), _item(kcal=50)])
    await _put(client, user, eaten_on="2026-10-18")
    await _put(client, user, eaten_on="2026-10-19")
    await _put(client, other_user, eaten_on="2026-10-13")

    resp = await client.get("/api/meals/days?from=2026-10-12&to=2026-10-18", headers=user.headers)
    assert resp.json() == [
        {"date": "2026-10-12", "kcal": 228 + 150},
        {"date": "2026-10-18", "kcal": 228},
    ]
    bad = await client.get("/api/meals/days?from=2026-10-18&to=2026-10-12", headers=user.headers)
    assert bad.status_code == 422
    long = await client.get("/api/meals/days?from=2026-01-01&to=2026-12-31", headers=user.headers)
    assert long.status_code == 422


async def test_delete_meal(client, user):
    meal_id, _ = await _put(client, user)
    assert (await client.delete(f"/api/meals/{meal_id}", headers=user.headers)).status_code == 204
    assert (await client.get(f"/api/meals/{meal_id}", headers=user.headers)).status_code == 404


# --- names and summaries ---


async def test_claude_names_and_summarizes_after_a_save(client, user, summaries):
    calls, answer = summaries
    answer["value"] = _summary("Oats and banana", ("Oats", [1]), ("Banana", [2]))
    items = [_item("Oats"), _item("Banana", 118, unit_name="medium", unit_quantity=1)]
    meal_id, resp = await _put(client, user, items=items)
    # The response goes out before Claude has answered.
    assert resp.json()["name"] is None
    assert resp.json()["naming"] is True
    assert calls == [["Oats — 60 g", "Banana — 1 medium (118 g)"]]

    meal = (await client.get(f"/api/meals/{meal_id}", headers=user.headers)).json()
    assert meal["naming"] is False
    assert meal["name"] == "Oats and banana"
    assert meal["name_source"] == "auto"
    assert meal["summary"] == [{"text": "Oats", "items": [0]}, {"text": "Banana", "items": [1]}]

    # Saving the same items again doesn't ask again; changing them does, and
    # the old name and summary stop showing until the new ones arrive.
    _, resp = await _put(client, user, meal_id, items=items, eaten_at="09:00")
    assert len(calls) == 1
    assert resp.json()["naming"] is False
    answer["value"] = None  # Claude unavailable
    _, resp = await _put(client, user, meal_id, items=items[:1])
    assert len(calls) == 2
    assert resp.json()["name"] is None
    assert resp.json()["summary"] is None
    # Claude failed: the meal is no longer being named.
    meal = (await client.get(f"/api/meals/{meal_id}", headers=user.headers)).json()
    assert meal["naming"] is False
    assert meal["name"] is None


async def test_a_users_name_wins_and_can_be_handed_back(client, user, summaries):
    calls, answer = summaries
    answer["value"] = _summary("Oats", ("Oats", [1]))
    meal_id, _ = await _put(client, user, name="  Breakfast at work ")
    meal = (await client.get(f"/api/meals/{meal_id}", headers=user.headers)).json()
    assert meal["name"] == "Breakfast at work"
    assert meal["name_source"] == "user"
    # Claude still summarizes the items.
    assert meal["summary"] == [{"text": "Oats", "items": [0]}]

    # No name in the snapshot hands the meal back to Claude.
    _, resp = await _put(client, user, meal_id)
    assert resp.json()["name_source"] == "auto"
    assert len(calls) == 2
    meal = (await client.get(f"/api/meals/{meal_id}", headers=user.headers)).json()
    assert meal["name"] == "Oats"


async def test_summary_with_bad_lines_keeps_only_the_name(client, user, summaries):
    _, answer = summaries
    # Food 2 is left out: the card lists the foods instead.
    answer["value"] = _summary("Snack", ("Oats", [1]))
    meal_id, _ = await _put(client, user, items=[_item("Oats"), _item("Nuts")])
    meal = (await client.get(f"/api/meals/{meal_id}", headers=user.headers)).json()
    assert meal["name"] == "Snack"
    assert meal["summary"] is None


async def test_stale_summary_is_not_written(db, user, summaries):
    """Claude answered about items the meal no longer has."""
    apple = MealItem(
        position=0, name="Apple", quantity_g=182, kcal=95, protein_g=0.5, carbs_g=25, fat_g=0.3
    )
    meal = Meal(
        id=str(uuid.uuid4()),
        user_id=user.id,
        eaten_on=date(2026, 10, 18),
        eaten_at=time(8, 0),
        name_source="auto",
        items=[apple],
    )
    db.add(meal)
    await db.commit()
    job = meal_service.SummaryJob(meal_id=meal.id, key="something else", foods=["Apple"])
    assert not await meal_summary.apply(db, job, _summary("Apple", ("Apple", [1])))
    await db.refresh(meal)
    assert meal.name is None
