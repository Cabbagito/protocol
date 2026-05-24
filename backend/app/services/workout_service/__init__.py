"""Workout service package — re-exports all public functions."""

from app.services.workout_service.exercise_ops import (
    add_exercise,
    modify_sets,
    remove_exercise,
    reorder_exercise,
    replace_exercise,
    update_exercise_note,
)
from app.services.workout_service.logging import log_sets
from app.services.workout_service.queries import (
    get_exercise_progress,
    get_workout_detail,
    get_workout_history,
)
from app.services.workout_service.templates import get_next_template, get_specific_template

__all__ = [
    "add_exercise",
    "get_exercise_progress",
    "get_next_template",
    "get_specific_template",
    "get_workout_detail",
    "get_workout_history",
    "log_sets",
    "modify_sets",
    "remove_exercise",
    "reorder_exercise",
    "replace_exercise",
    "update_exercise_note",
]
