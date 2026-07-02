"""Tests for the Open Food Facts client mapping and fetch behavior."""

import httpx
import pytest

from app.services.off_client import fetch_product, is_complete, map_product

BARCODE = "3017620422003"


def _product(**overrides):
    product = {
        "product_name": "Nutella",
        "brands": "Ferrero",
        "nutriments": {
            "energy-kcal_100g": 539,
            "proteins_100g": 6.3,
            "carbohydrates_100g": 57.5,
            "fat_100g": 30.9,
        },
        "serving_quantity": 15,
    }
    product.update(overrides)
    return product


def test_map_product_full_payload():
    draft = map_product(_product(), BARCODE)
    assert draft.barcode == BARCODE
    assert draft.name == "Nutella"
    assert draft.brand == "Ferrero"
    assert draft.kcal_per_100g == 539
    assert draft.protein_per_100g == 6.3
    assert draft.carbs_per_100g == 57.5
    assert draft.fat_per_100g == 30.9
    assert draft.default_serving_g == 15
    assert is_complete(draft)


def test_map_product_derives_kcal_from_macros():
    product = _product(
        nutriments={
            "proteins_100g": 10,
            "carbohydrates_100g": 20,
            "fat_100g": 5,
        }
    )
    draft = map_product(product, BARCODE)
    assert draft.kcal_per_100g == 4 * 10 + 4 * 20 + 9 * 5
    assert is_complete(draft)


def test_map_product_takes_first_brand():
    draft = map_product(_product(brands="Ferrero, Nutella brand"), BARCODE)
    assert draft.brand == "Ferrero"


def test_map_product_missing_fields_yields_incomplete_draft():
    product = _product(product_name="", nutriments={"proteins_100g": 10})
    draft = map_product(product, BARCODE)
    assert draft.name is None
    assert draft.kcal_per_100g is None
    assert not is_complete(draft)


def test_map_product_rejects_bad_values():
    product = _product(
        nutriments={
            "energy-kcal_100g": "not-a-number",
            "proteins_100g": -5,
            "carbohydrates_100g": None,
            "fat_100g": 3,
        },
        serving_quantity=0,
    )
    draft = map_product(product, BARCODE)
    assert draft.kcal_per_100g is None
    assert draft.protein_per_100g is None
    assert draft.carbs_per_100g is None
    assert draft.fat_per_100g == 3
    assert draft.default_serving_g is None


def _fetch_with_handler(handler):
    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def patched_client(**kwargs):
        return real_client(transport=transport, **kwargs)

    return patched_client


@pytest.fixture
def patch_client(monkeypatch):
    def _patch(handler):
        monkeypatch.setattr(
            "app.services.off_client.httpx.AsyncClient", _fetch_with_handler(handler)
        )

    return _patch


async def test_fetch_product_success(patch_client):
    def handler(request):
        return httpx.Response(200, json={"status": 1, "product": _product()})

    patch_client(handler)
    product = await fetch_product(BARCODE)
    assert product is not None
    assert product["product_name"] == "Nutella"


async def test_fetch_product_unknown_barcode(patch_client):
    def handler(request):
        return httpx.Response(200, json={"status": 0})

    patch_client(handler)
    assert await fetch_product(BARCODE) is None


async def test_fetch_product_http_error_status(patch_client):
    def handler(request):
        return httpx.Response(404)

    patch_client(handler)
    assert await fetch_product(BARCODE) is None


async def test_fetch_product_network_failure(patch_client):
    def handler(request):
        raise httpx.ConnectTimeout("timed out")

    patch_client(handler)
    assert await fetch_product(BARCODE) is None
