"""Workout service package — re-exports all public functions."""

from app.services.workout_service.exercise_ops import (
    add_exercise,
    remove_exercise,
    reorder_exercises,
    replace_exercise,
    update_exercise_note,
)
from app.services.workout_service.logging import save_session
from app.services.workout_service.queries import get_exercise_progress, get_workout_history
from app.services.workout_service.sessions import set_session_skipped

__all__ = [
    "add_exercise",
    "get_exercise_progress",
    "get_workout_history",
    "remove_exercise",
    "reorder_exercises",
    "replace_exercise",
    "save_session",
    "set_session_skipped",
    "update_exercise_note",
]
