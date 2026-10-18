"""Read a product's name, nutrition and units from photos of its pack.

One Claude call per reading (about 2-3 cents with Opus 5.5). Nothing is
saved: the user checks the values on the New product page first.
"""

import logging

import anthropic
from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from app.schemas.food import FoodDraft, FoodUnitCreate, LabelImage
from app.services import claude

logger = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"

PROMPT = """\
These are photos of one food product's packaging: usually the front and the \
nutrition table. Read them for a food log.

- name: the product's name as printed on the front, without the brand, in \
sentence case and in the language of the pack.
- brand: the brand, or null if none is printed.
- kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g: energy (kcal), \
protein, carbohydrate and fat per 100 g, or per 100 ml for drinks. If the \
table gives values only per serving or per piece and says what that weighs, \
convert them to 100 g. If energy is printed only in kJ, divide by 4.184. Use \
null for any value you cannot read.
- units: the amounts the pack names together with their weight in grams: a \
piece or serving ("cookie", 12; "bar", 45; "slice", 25) and the whole pack's \
net weight ("pack", 200). Use the pack's own word for a piece, singular and \
lowercase. Leave out any amount whose weight isn't printed.

If something is unclear in the photos, prefer null to a guess."""


class _Unit(BaseModel):
    name: str
    grams: float


class _Reading(BaseModel):
    name: str | None
    brand: str | None
    kcal_per_100g: float | None
    protein_per_100g: float | None
    carbs_per_100g: float | None
    fat_per_100g: float | None
    units: list[_Unit]


def _number(value: float | None) -> float | None:
    return round(value, 1) if value is not None and value >= 0 else None


def to_draft(reading: _Reading) -> FoodDraft:
    """Keep what passes the same checks as a food the user types in."""
    units: list[FoodUnitCreate] = []
    for unit in reading.units:
        try:
            parsed = FoodUnitCreate(name=unit.name.lower(), grams=round(unit.grams, 1))
        except ValidationError:
            continue
        if all(u.name != parsed.name for u in units):
            units.append(parsed)
    return FoodDraft(
        name=(reading.name or "").strip()[:255] or None,
        brand=(reading.brand or "").strip()[:100] or None,
        kcal_per_100g=_number(reading.kcal_per_100g),
        protein_per_100g=_number(reading.protein_per_100g),
        carbs_per_100g=_number(reading.carbs_per_100g),
        fat_per_100g=_number(reading.fat_per_100g),
        units=units,
    )


async def read_label(images: list[LabelImage]) -> FoodDraft:
    client = claude.get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Reading labels is not set up")
    content: list[dict] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": image.media_type, "data": image.data},
        }
        for image in images
    ]
    content.append({"type": "text", "text": PROMPT})
    try:
        response = await client.messages.parse(
            model=MODEL,
            # Thinking is always on with Opus 5.5 and counts towards this.
            max_tokens=8192,
            messages=[{"role": "user", "content": content}],
            output_format=_Reading,
        )
    except (anthropic.APIError, ValueError) as exc:
        logger.warning("Label reading failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not read the photos") from exc
    if response.stop_reason in ("refusal", "max_tokens") or response.parsed_output is None:
        logger.warning("Label reading stopped: %s", response.stop_reason)
        raise HTTPException(status_code=502, detail="Could not read the photos")
    return to_draft(response.parsed_output)
