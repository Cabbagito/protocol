"""Meal names and timeline lines from Claude Haiku.

Runs in the background after a meal is saved (about $0.00007 a meal). The
result is written only if the meal still has the items it was asked about,
and the name only while the meal is auto-named.
"""

import logging

import anthropic
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.meal import Meal
from app.services import claude
from app.services.meal_service import SummaryJob, items_key

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-5-5"

SYSTEM = """\
You name meals in a personal food log. You get the foods in one meal, \
numbered, with the amount of each.

name: what a person would call this meal, one to four words, sentence case, \
in the language of the food names, no emoji and no closing punctuation. A \
single food gets its plain name without preparation details ("Apple", \
"Greek yogurt", "Chicken breast"; a branded product keeps its product name). \
Several foods get the dish they obviously make up ("Protein salad", "Oats \
with whey and banana", "Spaghetti bolognese"), otherwise the main one or two \
foods ("Salmon and potatoes"). Use "Snack" only for a mix of unrelated small \
things.

lines: the foods grouped for a short summary card. With three foods or \
fewer, each food is its own line. With more, make two or three lines of \
foods that belong together (the protein, the vegetables, the dressing and \
toppings). Every food number appears in exactly one line. A line's text \
lists its foods plainly and briefly, without amounts ("Tofu and seitan", \
"Mushrooms, tomato, cucumber, lettuce")."""


class _Line(BaseModel):
    text: str
    items: list[int]


class _Summary(BaseModel):
    name: str
    lines: list[_Line]


async def suggest(foods: list[str]) -> _Summary | None:
    """Ask Claude for a name and lines; None without a key or on any failure."""
    client = claude.get_client()
    if client is None:
        return None
    prompt = "\n".join(f"{n}. {food}" for n, food in enumerate(foods, start=1))
    try:
        response = await client.messages.parse(
            model=MODEL,
            max_tokens=1024,
            thinking={"type": "disabled"},
            output_config={"effort": "low"},
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            output_format=_Summary,
        )
    except (anthropic.APIError, ValueError) as exc:
        logger.warning("Meal summary failed: %s", exc)
        return None
    if response.stop_reason in ("refusal", "max_tokens"):
        logger.warning("Meal summary stopped: %s", response.stop_reason)
        return None
    return response.parsed_output


def clean_lines(summary: _Summary, count: int) -> list[dict] | None:
    """Claude numbers foods from 1; store 0-based indexes. Every item must be
    in exactly one line, or the card lists the items instead."""
    seen: set[int] = set()
    lines = []
    for line in summary.lines:
        indexes = [n - 1 for n in line.items]
        text = line.text.strip()[:120]
        if not text or not indexes:
            continue
        if any(i < 0 or i >= count or i in seen for i in indexes):
            return None
        seen.update(indexes)
        lines.append({"text": text, "items": indexes})
    return lines if len(seen) == count else None


async def apply(db: AsyncSession, job: SummaryJob, summary: _Summary) -> bool:
    """Store the summary if the meal still has the items it describes."""
    meal = await db.get(Meal, job.meal_id, with_for_update=True)
    if meal is None or items_key(meal.items) != job.key:
        return False
    meal.summary = clean_lines(summary, len(meal.items))
    meal.summary_key = job.key
    if meal.name_source == "auto":
        meal.name = summary.name.strip()[:255] or None
    await db.commit()
    return True


async def refresh(session_factory: async_sessionmaker[AsyncSession], job: SummaryJob) -> None:
    """Background task: name and summarize a meal's current items."""
    summary = await suggest(job.foods)
    if summary is None:
        return
    async with session_factory() as db:
        await apply(db, job, summary)
