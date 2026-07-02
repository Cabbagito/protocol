from datetime import date

from pydantic import BaseModel, Field


class WeightLogCreate(BaseModel):
    logged_on: date
    weight_kg: float = Field(gt=0, lt=500)


class WeightLogResponse(BaseModel):
    id: str
    logged_on: date
    weight_kg: float

    class Config:
        from_attributes = True
