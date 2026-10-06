from datetime import date as date_type

from pydantic import BaseModel, ConfigDict, Field


class MesocycleCreate(BaseModel):
    split_id: str
    name: str = Field(min_length=1, max_length=100)
    total_weeks: int = Field(default=4, ge=3, le=8)
    started_at: date_type | None = None


class MesocycleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


# split_id / split_name / split_color are null once the source split is deleted;
# the mesocycle's structure is self-contained and keeps working.


class MesocycleListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    split_name: str | None
    split_color: str | None
    total_weeks: int
    current_week: int
    is_active: bool
    started_at: date_type
    workouts_completed: int
    total_workouts: int


class MesocycleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    split_id: str | None
    split_name: str | None
    split_color: str | None
    total_weeks: int
    current_week: int
    is_active: bool
    started_at: date_type
    workouts_completed: int
    structure: dict
