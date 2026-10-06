from pydantic import BaseModel, ConfigDict, Field


class DayExerciseInput(BaseModel):
    exercise_id: str


class DayInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    exercises: list[DayExerciseInput] = []


class SplitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    days: list[DayInput] = []


class DayExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    exercise_id: str
    exercise_name: str
    muscle_group: str
    order: int


class DayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    day_order: int
    exercises: list[DayExerciseResponse]


class SplitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    color: str | None
    # Owner; None for the shared seeded templates (read-only).
    user_id: str | None
    days: list[DayResponse]


class SplitListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    color: str | None
    user_id: str | None
    day_count: int
    exercise_count: int
