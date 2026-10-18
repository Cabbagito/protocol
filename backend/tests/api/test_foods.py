"""Food items: ownership, units, search, barcode sharing and lookup."""

import uuid
from datetime import date

from app.services import food_service, off_client

FOOD = {
    "name": "Overnight Oats",
    "brand": None,
    "kcal_per_100g": 150,
    "protein_per_100g": 6,
    "carbs_per_100g": 24,
    "fat_per_100g": 3,
    "units": [{"name": "jar", "grams": 250}],
}
BARCODE = "5000112637922"


async def _create(client, headers, **overrides):
    return await client.post("/api/foods", json={**FOOD, **overrides}, headers=headers)


async def _seeded_food(client, headers) -> dict:
    foods = (await client.get("/api/foods", headers=headers)).json()
    return next(f for f in foods if f["seeded"])


async def test_create_custom_food_is_private(client, user, other_user):
    resp = await _create(client, user.headers)
    assert resp.status_code == 201
    food = resp.json()
    assert food["user_id"] == user.id
    assert food["seeded"] is False

    theirs = (await client.get("/api/foods?q=Overnight", headers=other_user.headers)).json()
    assert theirs == []
    mine = (await client.get("/api/foods?q=overnight", headers=user.headers)).json()
    assert [f["id"] for f in mine] == [food["id"]]


async def test_search_treats_wildcards_literally(client, user):
    await _create(client, user.headers, name="100% Whey")
    await _create(client, user.headers, name="1000 Island")
    hits = (await client.get("/api/foods?q=100%25", headers=user.headers)).json()
    assert [f["name"] for f in hits] == ["100% Whey"]


async def test_update_own_food(client, user):
    food = (await _create(client, user.headers)).json()
    resp = await client.put(
        f"/api/foods/{food['id']}", json={**FOOD, "name": "Oats v2"}, headers=user.headers
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Oats v2"


async def test_cannot_touch_other_users_food(client, user, other_user):
    food = (await _create(client, user.headers)).json()
    resp = await client.put(
        f"/api/foods/{food['id']}", json={**FOOD, "name": "Mine"}, headers=other_user.headers
    )
    assert resp.status_code == 404
    resp = await client.delete(f"/api/foods/{food['id']}", headers=other_user.headers)
    assert resp.status_code == 404
    # Unchanged for the owner.
    mine = (await client.get("/api/foods?q=Overnight", headers=user.headers)).json()
    assert mine[0]["name"] == FOOD["name"]


async def test_seeded_foods_are_read_only(client, user):
    seeded = await _seeded_food(client, user.headers)
    assert seeded["user_id"] is None
    resp = await client.put(f"/api/foods/{seeded['id']}", json=FOOD, headers=user.headers)
    assert resp.status_code == 403
    resp = await client.delete(f"/api/foods/{seeded['id']}", headers=user.headers)
    assert resp.status_code == 403


async def test_barcode_foods_are_shared_and_correctable_by_anyone(client, user, other_user):
    resp = await _create(client, user.headers, barcode=BARCODE)
    assert resp.status_code == 201
    food = resp.json()
    assert food["user_id"] is None
    assert food["barcode"] == BARCODE
    assert food["editable"] is True

    # Visible to everyone ...
    theirs = (await client.get("/api/foods?q=Overnight", headers=other_user.headers)).json()
    assert [f["id"] for f in theirs] == [food["id"]]

    # ... correctable by anyone (a typo from the first scan isn't forever) ...
    resp = await client.put(
        f"/api/foods/{food['id']}",
        json={**FOOD, "kcal_per_100g": 160, "units": [{"name": "pot", "grams": 200}]},
        headers=other_user.headers,
    )
    assert resp.status_code == 200
    assert resp.json()["kcal_per_100g"] == 160
    assert [(u["name"], u["grams"]) for u in resp.json()["units"]] == [("pot", 200)]
    assert resp.json()["barcode"] == BARCODE

    # ... and deletable by no one, since others may have logged it.
    for headers in (user.headers, other_user.headers):
        resp = await client.delete(f"/api/foods/{food['id']}", headers=headers)
        assert resp.status_code == 403


async def test_creating_existing_barcode_returns_existing_food(client, user, other_user):
    first = (await _create(client, user.headers, barcode=BARCODE)).json()

    resp = await _create(
        client, other_user.headers, barcode=BARCODE, name="Different", kcal_per_100g=999
    )
    assert resp.status_code == 200
    assert resp.json() == first

    foods = (await client.get("/api/foods?q=Different", headers=user.headers)).json()
    assert foods == []


async def test_barcode_insert_race_returns_existing_food(client, user, other_user, monkeypatch):
    """If another request inserts the barcode between our check and insert,
    the unique index fires and we return their row."""
    first = (await _create(client, user.headers, barcode=BARCODE)).json()

    real_get = food_service._get_by_barcode
    calls = {"n": 0}

    async def _miss_once(db, barcode):
        calls["n"] += 1
        if calls["n"] == 1:
            return None
        return await real_get(db, barcode)

    monkeypatch.setattr(food_service, "_get_by_barcode", _miss_once)
    resp = await _create(client, other_user.headers, barcode=BARCODE, name="Racer")
    assert resp.status_code == 200
    assert resp.json()["id"] == first["id"]


def _meal(food: dict, **item) -> dict:
    return {
        "eaten_on": date.today().isoformat(),
        "eaten_at": "08:30",
        "items": [
            {
                "food_item_id": food["id"],
                "name": food["name"],
                "unit_name": None,
                "unit_quantity": 250,
                "quantity_g": 250,
                "kcal": 375,
                "protein_g": 15,
                "carbs_g": 60,
                "fat_g": 7.5,
                **item,
            }
        ],
    }


async def test_delete_own_food_keeps_meal_items(client, user):
    food = (await _create(client, user.headers)).json()
    meal_id = str(uuid.uuid4())
    resp = await client.put(f"/api/meals/{meal_id}", json=_meal(food), headers=user.headers)
    assert resp.status_code == 200

    resp = await client.delete(f"/api/foods/{food['id']}", headers=user.headers)
    assert resp.status_code == 204

    meal = (await client.get(f"/api/meals/{meal_id}", headers=user.headers)).json()
    [item] = meal["items"]
    assert item["food_item_id"] is None
    assert item["name"] == "Overnight Oats"
    assert item["kcal"] == 375
    assert meal["totals"]["protein_g"] == 15


async def test_cannot_log_other_users_food(client, user, other_user):
    food = (await _create(client, user.headers)).json()
    resp = await client.put(
        f"/api/meals/{uuid.uuid4()}", json=_meal(food), headers=other_user.headers
    )
    assert resp.status_code == 404


# --- units ---


async def test_food_units_come_with_the_food(client, user):
    food = (await _create(client, user.headers)).json()
    assert [(u["name"], u["grams"], u["user_id"]) for u in food["units"]] == [("jar", 250, None)]


async def test_unit_names_are_validated(client, user):
    for units in (
        [{"name": "grams", "grams": 1}],
        [{"name": "cup", "grams": 0}],
        [{"name": "cup", "grams": 90}, {"name": "Cup", "grams": 91}],
        [{"name": "  ", "grams": 5}],
    ):
        resp = await _create(client, user.headers, units=units)
        assert resp.status_code == 422, units


async def test_personal_units_are_private(client, user, other_user):
    seeded = await _seeded_food(client, user.headers)
    resp = await client.post(
        f"/api/foods/{seeded['id']}/units",
        json={"name": "My bowl", "grams": 320},
        headers=user.headers,
    )
    assert resp.status_code == 201
    mine = [u for u in resp.json()["units"] if u["user_id"] == user.id]
    assert [(u["name"], u["grams"]) for u in mine] == [("My bowl", 320)]

    theirs = (await client.get(f"/api/foods/{seeded['id']}", headers=other_user.headers)).json()
    assert all(u["user_id"] is None for u in theirs["units"])

    # The same name again (any case) is a conflict.
    resp = await client.post(
        f"/api/foods/{seeded['id']}/units",
        json={"name": "my BOWL", "grams": 300},
        headers=user.headers,
    )
    assert resp.status_code == 409

    # Others can't delete it; the owner can.
    unit_id = mine[0]["id"]
    url = f"/api/foods/{seeded['id']}/units/{unit_id}"
    assert (await client.delete(url, headers=other_user.headers)).status_code == 404
    assert (await client.delete(url, headers=user.headers)).status_code == 204


async def test_seeded_food_units_are_read_only(client, user):
    seeded = next(
        f
        for f in (await client.get("/api/foods?q=banana", headers=user.headers)).json()
        if f["seeded"]
    )
    [unit] = seeded["units"]
    assert (unit["name"], unit["grams"]) == ("medium", 118)
    resp = await client.delete(
        f"/api/foods/{seeded['id']}/units/{unit['id']}", headers=user.headers
    )
    assert resp.status_code == 403


async def test_updating_a_food_keeps_personal_units(client, user):
    food = (await _create(client, user.headers)).json()
    await client.post(
        f"/api/foods/{food['id']}/units", json={"name": "spoon", "grams": 15}, headers=user.headers
    )
    resp = await client.put(
        f"/api/foods/{food['id']}",
        json={**FOOD, "units": [{"name": "jar", "grams": 300}, {"name": "cup", "grams": 240}]},
        headers=user.headers,
    )
    assert sorted((u["name"], u["grams"]) for u in resp.json()["units"]) == [
        ("cup", 240),
        ("jar", 300),
        ("spoon", 15),
    ]


# --- search ---


async def test_search_puts_recent_foods_first_with_last_amount(client, user):
    oats = (await _create(client, user.headers, name="Steel cut oats")).json()
    await _create(client, user.headers, name="Oat milk barista")
    await client.put(
        f"/api/meals/{uuid.uuid4()}",
        json=_meal(oats, unit_name="jar", unit_quantity=0.5, quantity_g=125),
        headers=user.headers,
    )
    hits = (await client.get("/api/foods?q=oat", headers=user.headers)).json()
    assert hits[0]["id"] == oats["id"]
    assert hits[0]["last_used"] == {"unit_name": "jar", "unit_quantity": 0.5, "quantity_g": 125}
    assert all(h["last_used"] is None for h in hits[1:])


async def test_search_matches_every_word_in_name_or_brand(client, user):
    await _create(client, user.headers, name="Protein bar", brand="Barebells")
    await _create(client, user.headers, name="Protein pudding")
    hits = (await client.get("/api/foods?q=barebells protein", headers=user.headers)).json()
    assert [h["name"] for h in hits] == ["Protein bar"]


async def test_search_prefers_names_starting_with_the_query(client, user):
    await _create(client, user.headers, name="Zzz apple pie")
    hits = (await client.get("/api/foods?q=apple", headers=user.headers)).json()
    names = [h["name"] for h in hits]
    assert names.index("Apple, raw") < names.index("Zzz apple pie")


# --- barcode lookup ---


def _fail_if_called(*args, **kwargs):
    raise AssertionError("Open Food Facts must not be queried")


async def test_lookup_known_barcode_skips_open_food_facts(client, user, monkeypatch):
    food = (await _create(client, user.headers, barcode=BARCODE)).json()
    monkeypatch.setattr(off_client, "fetch_product", _fail_if_called)
    resp = await client.get(f"/api/foods/by-barcode/{BARCODE}", headers=user.headers)
    assert resp.status_code == 200
    assert resp.json() == {"status": "found", "food": food, "draft": None}


async def test_lookup_creates_shared_food_from_open_food_facts(client, user, monkeypatch):
    async def _product(barcode):
        return {
            "product_name": "Nutella",
            "brands": "Ferrero",
            "nutriments": {
                "energy-kcal_100g": 539,
                "proteins_100g": 6.3,
                "carbohydrates_100g": 57.5,
                "fat_100g": 30.9,
            },
            "serving_quantity": 15,
            "product_quantity": 400,
        }

    monkeypatch.setattr(off_client, "fetch_product", _product)
    resp = await client.get(f"/api/foods/by-barcode/{BARCODE}", headers=user.headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "found"
    assert body["food"]["name"] == "Nutella"
    assert body["food"]["user_id"] is None
    assert [(u["name"], u["grams"]) for u in body["food"]["units"]] == [
        ("serving", 15),
        ("pack", 400),
    ]


async def test_lookup_unknown_barcode_returns_draft(client, user, monkeypatch):
    async def _none(barcode):
        return None

    monkeypatch.setattr(off_client, "fetch_product", _none)
    resp = await client.get(f"/api/foods/by-barcode/{BARCODE}", headers=user.headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"
    assert resp.json()["draft"]["barcode"] == BARCODE


class _RecordingSession:
    """Minimal stand-in that records the order of DB calls."""

    def __init__(self, events: list[str]):
        self.events = events

    async def execute(self, stmt):
        self.events.append("select")

        class _Result:
            def scalar_one_or_none(self):
                return None

        return _Result()

    async def commit(self):
        self.events.append("commit")


async def test_lookup_releases_transaction_before_http_call(monkeypatch):
    events: list[str] = []

    async def _fetch(barcode):
        events.append("http")
        return None

    monkeypatch.setattr(off_client, "fetch_product", _fetch)
    result = await food_service.lookup_barcode(_RecordingSession(events), BARCODE, "user")
    assert result.status == "draft"
    assert events == ["select", "commit", "http"]
