from datetime import date, datetime

from pydantic import BaseModel, Field


class FoodItemCreate(BaseModel):
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

    class Config:
        from_attributes = True


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
