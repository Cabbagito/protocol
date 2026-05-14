from datetime import date as date_type

from pydantic import BaseModel, Field


class MesocycleCreate(BaseModel):
    split_id: str
    name: str = Field(min_length=1, max_length=100)
    total_weeks: int = Field(default=4, ge=3, le=8)
    started_at: date_type | None = None


class MesocycleUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class MesocycleListItem(BaseModel):
    id: str
    name: str
    split_name: str
    split_color: str | None
    total_weeks: int
    current_week: int
    is_active: bool
    started_at: date_type
    workouts_completed: int
    total_workouts: int

    class Config:
        from_attributes = True


class MesocycleResponse(BaseModel):
    id: str
    name: str
    split_id: str
    split_name: str
    split_color: str | None
    total_weeks: int
    current_week: int
    is_active: bool
    started_at: date_type
    workouts_completed: int
    structure: dict

    class Config:
        from_attributes = True
