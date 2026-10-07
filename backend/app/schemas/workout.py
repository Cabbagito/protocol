from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

SetType = Literal["straight", "myorep", "myorep_match"]


class SnapshotSet(BaseModel):
    weight: float | None = Field(default=None, ge=0, le=2000)
    reps: int | None = Field(default=None, ge=0, le=1000)
    set_type: SetType | None = None
    logged: bool = False
    skipped: bool = False

    @model_validator(mode="after")
    def logged_needs_values(self) -> "SnapshotSet":
        if self.logged and (self.weight is None or self.reps is None or self.reps < 1):
            raise ValueError("a logged set needs a weight and at least 1 rep")
        return self


class SnapshotExercise(BaseModel):
    exercise_id: str
    skipped: bool = False
    sets: list[SnapshotSet] = Field(min_length=1, max_length=30)


class SaveSessionRequest(BaseModel):
    """The client's full current state of one session (idempotent).

    Sending the same snapshot twice is harmless, so clients can retry freely.
    """

    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    # Client's local calendar date of the session's first logged set; the
    # server's own "today" is UTC and the save may arrive days later (offline).
    logged_on: date | None = None
    exercises: list[SnapshotExercise]
    # False when correcting a past session: set-count changes then stay in
    # this session instead of resizing later, unstarted ones.
    apply_to_future: bool = True


class ExerciseNoteRequest(BaseModel):
    mesocycle_id: str
    exercise_id: str
    note: str | None = Field(default=None, max_length=2000)


class ReplaceExerciseRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    exercise_index: int = Field(ge=0)
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
