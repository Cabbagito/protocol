from pydantic import BaseModel, Field


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
    id: str
    exercise_id: str
    exercise_name: str
    muscle_group: str
    order: int

    class Config:
        from_attributes = True


class DayResponse(BaseModel):
    id: str
    name: str
    day_order: int
    exercises: list[DayExerciseResponse]

    class Config:
        from_attributes = True


class SplitResponse(BaseModel):
    id: str
    name: str
    color: str | None
    days: list[DayResponse]

    class Config:
        from_attributes = True


class SplitListItem(BaseModel):
    id: str
    name: str
    color: str | None
    day_count: int
    exercise_count: int

    class Config:
        from_attributes = True
