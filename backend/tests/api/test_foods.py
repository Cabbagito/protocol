"""Food items: ownership, deletion, barcode sharing and lookup."""

from datetime import date

from app.services import food_service, off_client

FOOD = {
    "name": "Overnight Oats",
    "brand": None,
    "kcal_per_100g": 150,
    "protein_per_100g": 6,
    "carbs_per_100g": 24,
    "fat_per_100g": 3,
    "default_serving_g": 250,
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


async def test_barcode_foods_are_shared_and_read_only(client, user, other_user):
    resp = await _create(client, user.headers, barcode=BARCODE)
    assert resp.status_code == 201
    food = resp.json()
    assert food["user_id"] is None
    assert food["barcode"] == BARCODE

    # Visible to everyone ...
    theirs = (await client.get("/api/foods?q=Overnight", headers=other_user.headers)).json()
    assert [f["id"] for f in theirs] == [food["id"]]

    # ... editable by no one, not even its creator.
    for headers in (user.headers, other_user.headers):
        resp = await client.put(
            f"/api/foods/{food['id']}", json={**FOOD, "kcal_per_100g": 1}, headers=headers
        )
        assert resp.status_code == 403
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


async def test_delete_own_food_keeps_log_entries(client, user):
    food = (await _create(client, user.headers)).json()
    today = date.today().isoformat()
    log = {
        "logged_on": today,
        "food_item_id": food["id"],
        "name": food["name"],
        "quantity_g": 250,
        "kcal": 375,
        "protein_g": 15,
        "carbs_g": 60,
        "fat_g": 7.5,
    }
    assert (await client.post("/api/food-logs", json=log, headers=user.headers)).status_code == 201

    resp = await client.delete(f"/api/foods/{food['id']}", headers=user.headers)
    assert resp.status_code == 204

    day = (await client.get(f"/api/food-logs?date={today}", headers=user.headers)).json()
    assert len(day["entries"]) == 1
    entry = day["entries"][0]
    assert entry["food_item_id"] is None
    assert entry["name"] == "Overnight Oats"
    assert entry["kcal"] == 375
    assert day["totals"]["protein_g"] == 15


async def test_cannot_log_other_users_food(client, user, other_user):
    food = (await _create(client, user.headers)).json()
    log = {
        "logged_on": date.today().isoformat(),
        "food_item_id": food["id"],
        "name": "x",
        "kcal": 1,
        "protein_g": 0,
        "carbs_g": 0,
        "fat_g": 0,
    }
    resp = await client.post("/api/food-logs", json=log, headers=other_user.headers)
    assert resp.status_code == 404


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
        }

    monkeypatch.setattr(off_client, "fetch_product", _product)
    resp = await client.get(f"/api/foods/by-barcode/{BARCODE}", headers=user.headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "found"
    assert body["food"]["name"] == "Nutella"
    assert body["food"]["user_id"] is None


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
    result = await food_service.lookup_barcode(_RecordingSession(events), BARCODE)
    assert result.status == "draft"
    assert events == ["select", "commit", "http"]
