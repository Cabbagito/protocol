from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.schemas.daily_targets import DailyTargetsResponse


class MealItemIn(BaseModel):
    food_item_id: str | None = None
    name: str = Field(min_length=1, max_length=255)
    # How the amount was entered: unit_quantity of unit_name (None = grams).
    unit_name: str | None = Field(default=None, min_length=1, max_length=50)
    unit_quantity: float | None = Field(default=None, gt=0)
    quantity_g: float | None = Field(default=None, gt=0)
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class MealPut(BaseModel):
    """The client's full snapshot of a meal."""

    eaten_on: date
    eaten_at: time
    # A name the user typed; None leaves the meal to Claude's name.
    name: str | None = Field(default=None, max_length=255)
    items: list[MealItemIn] = Field(min_length=1, max_length=100)

    @field_validator("eaten_at")
    @classmethod
    def _minutes(cls, value: time) -> time:
        return value.replace(second=0, microsecond=0, tzinfo=None)

    @field_validator("name")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class MealItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    food_item_id: str | None
    name: str
    unit_name: str | None
    unit_quantity: float | None
    quantity_g: float | None
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float


class SummaryLine(BaseModel):
    """One line of the timeline card: a label for some of the meal's items,
    by their index in ``items``."""

    text: str
    items: list[int]


class MacroTotals(BaseModel):
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float


class MealResponse(BaseModel):
    id: str
    eaten_on: date
    eaten_at: time
    # None while Claude hasn't named the current items (or can't): the client
    # shows the food names instead.
    name: str | None
    name_source: Literal["auto", "user"]
    # None unless it describes the current items.
    summary: list[SummaryLine] | None
    totals: MacroTotals
    items: list[MealItemResponse]

    @field_serializer("eaten_at")
    def _hh_mm(self, value: time) -> str:
        return value.strftime("%H:%M")


class DayResponse(BaseModel):
    date: date
    totals: MacroTotals
    targets: DailyTargetsResponse
    meals: list[MealResponse]


class DayKcal(BaseModel):
    date: date
    kcal: float
