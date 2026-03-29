from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.workout import (
    AddExerciseRequest,
    ExerciseNoteRequest,
    LogSetsRequest,
    ModifySetsRequest,
    RemoveExerciseRequest,
    ReorderExerciseRequest,
    ReplaceExerciseRequest,
)
from app.services import workout_service

router = APIRouter()


@router.get("/template/{mesocycle_id}")
async def get_workout_template(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.get_next_template(db, mesocycle_id, current_user.id)


@router.get("/template/{mesocycle_id}/{week_index}/{session_index}")
async def get_specific_template(
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.get_specific_template(
        db, mesocycle_id, current_user.id, week_index, session_index
    )


@router.post("/log")
async def log_sets(
    data: LogSetsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    return await workout_service.get_exercise_progress(db, current_user.id, exercise_id)


@router.patch("/exercise-note")
async def update_exercise_note(
    data: ExerciseNoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.post("/add-exercise")
async def add_exercise(
    data: AddExerciseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.add_exercise(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        exercise_id=data.exercise_id,
        apply_to_future=data.apply_to_future,
    )


@router.post("/reorder-exercise")
async def reorder_exercise(
    data: ReorderExerciseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.reorder_exercise(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        exercise_index=data.exercise_index,
        direction=data.direction,
        apply_to_future=data.apply_to_future,
    )


@router.post("/remove-exercise")
async def remove_exercise(
    data: RemoveExerciseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.remove_exercise(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        exercise_id=data.exercise_id,
        apply_to_future=data.apply_to_future,
    )


@router.post("/modify-sets")
async def modify_sets(
    data: ModifySetsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    return await workout_service.get_workout_history(db, mesocycle_id, current_user.id)


@router.get("/detail/{mesocycle_id}/{week_index}/{session_index}")
async def get_workout_detail(
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.get_workout_detail(
        db, mesocycle_id, current_user.id, week_index, session_index
    )
