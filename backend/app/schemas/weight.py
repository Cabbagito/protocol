from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class WeightLogCreate(BaseModel):
    logged_on: date
    weight_kg: float = Field(gt=0, lt=500)


class WeightLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    logged_on: date
    weight_kg: float
