from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.workout import (
    AddExerciseRequest,
    ExerciseNoteRequest,
    RemoveExerciseRequest,
    ReorderExercisesRequest,
    ReplaceExerciseRequest,
    SaveSessionRequest,
    SkipSessionRequest,
)
from app.services import workout_service

router = APIRouter()


@router.put("/session")
async def save_session(
    data: SaveSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.save_session(db, current_user.id, data)


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


@router.post("/reorder-exercises")
async def reorder_exercises(
    data: ReorderExercisesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.reorder_exercises(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        exercise_ids=data.exercise_ids,
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


@router.post("/skip-session")
async def skip_session(
    data: SkipSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await workout_service.set_session_skipped(
        db,
        current_user.id,
        mesocycle_id=data.mesocycle_id,
        week_index=data.week_index,
        session_index=data.session_index,
        skipped=data.skipped,
    )
