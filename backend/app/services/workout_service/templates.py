"""Workout template retrieval — get_next_template, get_specific_template."""

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.progression import get_current_position
from app.services.common import get_user_mesocycle
from app.services.workout_service._helpers import get_session_from_structure


async def get_next_template(db: AsyncSession, mesocycle_id: str, user_id: str) -> dict:
    """Get the current workout template, auto-detecting next session."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id)

    structure = mesocycle.structure
    pos = get_current_position(structure)

    if pos.get("completed"):
        raise HTTPException(status_code=400, detail="Mesocycle is fully completed")

    week = structure["weeks"][pos["week_index"]]
    session = week["sessions"][pos["session_index"]]

    return {
        "session_name": session["session_name"],
        "week_number": week["week_number"],
        "target_rir": week["rir"],
        "week_index": pos["week_index"],
        "session_index": pos["session_index"],
        "exercises": session["exercises"],
        "exercise_notes": structure.get("exercise_notes", {}),
    }


async def get_specific_template(
    db: AsyncSession, mesocycle_id: str, user_id: str, week_index: int, session_index: int
) -> dict:
    """Get a specific workout template by week and session index."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id)
    week, session = get_session_from_structure(mesocycle.structure, week_index, session_index)

    return {
        "session_name": session["session_name"],
        "week_number": week["week_number"],
        "target_rir": week["rir"],
        "week_index": week_index,
        "session_index": session_index,
        "exercises": session["exercises"],
        "exercise_notes": mesocycle.structure.get("exercise_notes", {}),
    }
