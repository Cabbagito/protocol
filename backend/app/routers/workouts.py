from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services import workout_service

router = APIRouter()


# --- Pydantic Schemas ---


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


class LogSetsRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    sets: list[SetLog]
    notes: str | None = None
    exercise_updates: list[ExerciseUpdate] | None = None
    skipped_sets: list[SkippedSetInfo] | None = None
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


# --- Endpoints ---


@router.get("/template/{mesocycle_id}")
async def get_workout_template(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current workout template from the mesocycle structure."""
    return await workout_service.get_next_template(db, mesocycle_id, current_user.id)


@router.get("/template/{mesocycle_id}/{week_index}/{session_index}")
async def get_specific_template(
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific workout template by week and session index."""
    return await workout_service.get_specific_template(
        db, mesocycle_id, current_user.id, week_index, session_index
    )


@router.post("/log")
async def log_sets(
    data: LogSetsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log sets into the mesocycle structure."""
    return await workout_service.log_sets(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        sets=data.sets,
        notes=data.notes,
        exercise_updates=data.exercise_updates,
        skipped_sets=data.skipped_sets,
        complete=data.complete,
    )


@router.get("/progress/{exercise_id}")
async def get_exercise_progress(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get weight progression for an exercise by scanning all mesocycle structures."""
    return await workout_service.get_exercise_progress(db, current_user.id, exercise_id)


@router.patch("/exercise-note")
async def update_exercise_note(
    data: ExerciseNoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update or remove a meso-wide exercise note."""
    return await workout_service.update_exercise_note(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        exercise_id=data.exercise_id,
        note=data.note,
    )


@router.post("/replace-exercise")
async def replace_exercise(
    data: ReplaceExerciseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace an exercise in the mesocycle structure."""
    return await workout_service.replace_exercise(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        exercise_index=data.exercise_index,
        old_exercise_id=data.old_exercise_id,
        new_exercise_id=data.new_exercise_id,
        apply_to_future=data.apply_to_future,
    )


@router.post("/modify-sets")
async def modify_sets(
    data: ModifySetsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add or remove a set from an exercise, propagating to future unlogged weeks."""
    return await workout_service.modify_sets(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        exercise_id=data.exercise_id,
        action=data.action,
        set_num=data.set_num,
    )


@router.get("/history/{mesocycle_id}")
async def get_workout_history(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of completed workouts from the mesocycle structure."""
    return await workout_service.get_workout_history(db, mesocycle_id, current_user.id)


@router.get("/detail/{mesocycle_id}/{week_index}/{session_index}")
async def get_workout_detail(
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed workout data for a specific session in the structure."""
    return await workout_service.get_workout_detail(
        db, mesocycle_id, current_user.id, week_index, session_index
    )
