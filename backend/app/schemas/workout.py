from pydantic import BaseModel, Field


class SetLog(BaseModel):
    exercise_id: str
    set_num: int = Field(ge=1)
    weight: float = Field(ge=0)
    reps: int = Field(ge=0)
    rir: int | None = Field(default=None, ge=-1, le=5)
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


class WorkoutTemplateExercise(BaseModel):
    exercise_id: str
    exercise_name: str
    muscle_group: str
    equipment_type: str
    sets: list[dict]


class WorkoutTemplateResponse(BaseModel):
    session_name: str
    week_number: int
    target_rir: int
    exercises: list[WorkoutTemplateExercise]


class ProgressEntry(BaseModel):
    date: str
    week_number: int
    max_weight: float
    best_e1rm: float
    total_reps: int
    total_sets: int
    volume: float


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


class ReorderExerciseRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    exercise_index: int = Field(ge=0)
    direction: str = Field(pattern=r"^(up|down)$")
    apply_to_future: bool = True


class RemoveExerciseRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    exercise_id: str
    apply_to_future: bool = True
