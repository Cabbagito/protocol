from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, computed_field


class FoodItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    kcal_per_100g: float = Field(ge=0)
    protein_per_100g: float = Field(ge=0)
    carbs_per_100g: float = Field(ge=0)
    fat_per_100g: float = Field(ge=0)
    default_serving_g: float | None = Field(default=None, gt=0)
    barcode: str | None = Field(default=None, min_length=8, max_length=32, pattern=r"^\d+$")


class FoodItemUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    kcal_per_100g: float = Field(ge=0)
    protein_per_100g: float = Field(ge=0)
    carbs_per_100g: float = Field(ge=0)
    fat_per_100g: float = Field(ge=0)
    default_serving_g: float | None = Field(default=None, gt=0)


class FoodItemResponse(BaseModel):
    id: str
    name: str
    brand: str | None
    kcal_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    default_serving_g: float | None
    barcode: str | None
    # Owner of a custom food; None for seeded and barcode (shared) foods,
    # which nobody can modify.
    user_id: str | None
    seed_key: str | None = Field(exclude=True)

    @computed_field
    @property
    def seeded(self) -> bool:
        return self.seed_key is not None

    class Config:
        from_attributes = True


class FoodDraft(BaseModel):
    barcode: str
    name: str | None = None
    brand: str | None = None
    kcal_per_100g: float | None = None
    protein_per_100g: float | None = None
    carbs_per_100g: float | None = None
    fat_per_100g: float | None = None
    default_serving_g: float | None = None


class BarcodeLookupResponse(BaseModel):
    status: Literal["found", "draft"]
    food: FoodItemResponse | None = None
    draft: FoodDraft | None = None


class FoodLogCreate(BaseModel):
    logged_on: date
    food_item_id: str | None = None
    quantity_g: float | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=255)
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class FoodLogResponse(BaseModel):
    id: str
    logged_on: date
    food_item_id: str | None
    name: str
    quantity_g: float | None
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    created_at: datetime

    class Config:
        from_attributes = True


class DailyTotals(BaseModel):
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float


class DailyLogResponse(BaseModel):
    date: date
    totals: DailyTotals
    entries: list[FoodLogResponse]
