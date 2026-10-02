from datetime import date

from pydantic import BaseModel, Field


class SetLog(BaseModel):
    exercise_id: str
    set_num: int = Field(ge=1)
    weight: float = Field(ge=0)
    reps: int = Field(ge=0)
    set_type: str | None = None


class ExerciseUpdate(BaseModel):
    exercise_id: str
    skipped: bool | None = None


class SkippedSetInfo(BaseModel):
    exercise_id: str
    set_num: int


class DraftSetData(BaseModel):
    exercise_id: str
    set_num: int = Field(ge=1)
    weight: float | None = None
    reps: int | None = None


class LogSetsRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    # Client's local calendar date; the server's own "today" is UTC and can
    # be a day off for evening workouts.
    logged_on: date | None = None
    sets: list[SetLog]
    notes: str | None = None
    exercise_updates: list[ExerciseUpdate] | None = None
    skipped_sets: list[SkippedSetInfo] | None = None
    draft_sets: list[DraftSetData] | None = None
    complete: bool = False


class ModifySetsRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    exercise_id: str
    action: str = Field(pattern=r"^(add|remove)$")
    set_num: int | None = None


class ExerciseNoteRequest(BaseModel):
    mesocycle_id: str
    exercise_id: str
    note: str | None = None


class ReplaceExerciseRequest(BaseModel):
    mesocycle_id: str
    week_index: int
    session_index: int
    exercise_index: int
    old_exercise_id: str
    new_exercise_id: str
    apply_to_future: bool = True


class AddExerciseRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    exercise_id: str
    apply_to_future: bool = True


class ReorderExercisesRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    exercise_ids: list[str] = Field(min_length=1)
    apply_to_future: bool = True


class SkipSessionRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    skipped: bool = True


class RemoveExerciseRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    exercise_id: str
    apply_to_future: bool = True
