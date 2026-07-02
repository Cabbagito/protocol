"""Open Food Facts lookup client.

Any failure (network, timeout, non-200, unknown product) degrades to None so
a scan falls back to manual entry instead of erroring.
"""

import logging

import httpx

from app.schemas.food import FoodDraft

logger = logging.getLogger(__name__)

_BASE_URL = "https://world.openfoodfacts.org/api/v2/product"
_FIELDS = "product_name,brands,nutriments,serving_quantity"
_TIMEOUT = 5.0
# OFF asks API consumers to identify themselves.
_USER_AGENT = "Protocol/1.0 (personal fitness tracker)"


async def fetch_product(barcode: str) -> dict | None:
    """Fetch a product from Open Food Facts. Returns None on any failure."""
    url = f"{_BASE_URL}/{barcode}.json"
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT, headers={"User-Agent": _USER_AGENT}
        ) as client:
            response = await client.get(url, params={"fields": _FIELDS})
    except httpx.HTTPError as exc:
        logger.warning("OFF lookup failed for %s: %s", barcode, exc)
        return None

    if response.status_code != 200:
        return None
    body = response.json()
    if body.get("status") != 1:
        return None
    return body.get("product") or None


def _as_float(value: object) -> float | None:
    try:
        result = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return result if result >= 0 else None


def map_product(product: dict, barcode: str) -> FoodDraft:
    """Map an OFF product payload onto our per-100g food shape."""
    name = (product.get("product_name") or "").strip() or None

    brand = None
    brands = (product.get("brands") or "").strip()
    if brands:
        brand = brands.split(",")[0].strip()[:100] or None

    nutriments = product.get("nutriments") or {}
    kcal = _as_float(nutriments.get("energy-kcal_100g"))
    protein = _as_float(nutriments.get("proteins_100g"))
    carbs = _as_float(nutriments.get("carbohydrates_100g"))
    fat = _as_float(nutriments.get("fat_100g"))
    if kcal is None and None not in (protein, carbs, fat):
        kcal = round(4 * protein + 4 * carbs + 9 * fat, 1)

    serving = _as_float(product.get("serving_quantity"))
    if serving is not None and serving <= 0:
        serving = None

    return FoodDraft(
        barcode=barcode,
        name=name,
        brand=brand,
        kcal_per_100g=kcal,
        protein_per_100g=protein,
        carbs_per_100g=carbs,
        fat_per_100g=fat,
        default_serving_g=serving,
    )


def is_complete(draft: FoodDraft) -> bool:
    """A draft may be persisted as a shared food only when fully resolved."""
    return None not in (
        draft.name,
        draft.kcal_per_100g,
        draft.protein_per_100g,
        draft.carbs_per_100g,
        draft.fat_per_100g,
    )
