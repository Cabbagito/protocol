"""Reading a product from photos of its pack, with Claude mocked."""

from types import SimpleNamespace

from app.services import claude, label_reader

URL = "/api/foods/read-label"
PHOTO = {"media_type": "image/jpeg", "data": "aGVsbG8="}


def _reading(**overrides):
    values = {
        "name": "Oat & chocolate cookies",
        "brand": "  Biscotti Co ",
        "kcal_per_100g": 480.04,
        "protein_per_100g": 7,
        "carbs_per_100g": 62,
        "fat_per_100g": None,
        "units": [
            label_reader._Unit(name="Cookie", grams=12.04),
            label_reader._Unit(name="pack", grams=200),
            label_reader._Unit(name="grams", grams=1),
            label_reader._Unit(name="crumb", grams=0),
        ],
    }
    return label_reader._Reading(**{**values, **overrides})


class _FakeClient:
    def __init__(self, response):
        self.calls: list[dict] = []
        self.messages = self
        self._response = response

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


async def test_reads_photos_into_a_draft(client, user, monkeypatch):
    fake = _FakeClient(SimpleNamespace(stop_reason="end_turn", parsed_output=_reading()))
    monkeypatch.setattr(claude, "get_client", lambda: fake)
    resp = await client.post(URL, json={"images": [PHOTO, PHOTO]}, headers=user.headers)
    assert resp.status_code == 200
    assert resp.json() == {
        "barcode": None,
        "name": "Oat & chocolate cookies",
        "brand": "Biscotti Co",
        "kcal_per_100g": 480.0,
        "protein_per_100g": 7,
        "carbs_per_100g": 62,
        "fat_per_100g": None,
        # Units that a typed-in food couldn't have are left out.
        "units": [{"name": "cookie", "grams": 12.0}, {"name": "pack", "grams": 200}],
    }
    [call] = fake.calls
    assert call["model"] == label_reader.MODEL
    images = [b for b in call["messages"][0]["content"] if b["type"] == "image"]
    assert len(images) == 2
    assert images[0]["source"] == {"type": "base64", "media_type": "image/jpeg", "data": "aGVsbG8="}


async def test_without_a_key_reading_is_unavailable(client, user):
    resp = await client.post(URL, json={"images": [PHOTO]}, headers=user.headers)
    assert resp.status_code == 503


async def test_refusal_is_a_failed_reading(client, user, monkeypatch):
    fake = _FakeClient(SimpleNamespace(stop_reason="refusal", parsed_output=None))
    monkeypatch.setattr(claude, "get_client", lambda: fake)
    resp = await client.post(URL, json={"images": [PHOTO]}, headers=user.headers)
    assert resp.status_code == 502


async def test_photos_are_validated(client, user):
    for body in (
        {"images": []},
        {"images": [PHOTO] * 5},
        {"images": [{"media_type": "image/gif", "data": "x"}]},
    ):
        assert (await client.post(URL, json=body, headers=user.headers)).status_code == 422


async def test_readings_are_limited_per_user(client, user, other_user, monkeypatch):
    fake = _FakeClient(SimpleNamespace(stop_reason="end_turn", parsed_output=_reading()))
    monkeypatch.setattr(claude, "get_client", lambda: fake)
    for _ in range(30):
        resp = await client.post(URL, json={"images": [PHOTO]}, headers=user.headers)
        assert resp.status_code == 200
    resp = await client.post(URL, json={"images": [PHOTO]}, headers=user.headers)
    assert resp.status_code == 429
    assert int(resp.headers["retry-after"]) > 0
    resp = await client.post(URL, json={"images": [PHOTO]}, headers=other_user.headers)
    assert resp.status_code == 200
