"""Read-only workout queries — history, detail, exercise progress."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mesocycle import Mesocycle
from app.services.common import get_user_mesocycle
from app.services.workout_service._helpers import get_session_from_structure


async def get_exercise_progress(db: AsyncSession, user_id: str, exercise_id: str) -> list[dict]:
    """Get weight progression for an exercise by scanning all mesocycle structures."""
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.user_id == user_id).order_by(Mesocycle.started_at.asc())
    )
    mesocycles = result.scalars().all()

    progress = []
    for meso in mesocycles:
        for week in meso.structure.get("weeks", []):
            for session in week.get("sessions", []):
                for exercise in session.get("exercises", []):
                    if exercise["exercise_id"] != exercise_id:
                        continue
                    logged_sets = [s for s in exercise.get("sets", []) if s.get("logged")]
                    if not logged_sets:
                        continue
                    max_weight = max(s.get("weight", 0) or 0 for s in logged_sets)
                    best_e1rm = max(
                        (s.get("weight", 0) or 0) * (1 + (s.get("reps", 0) or 0) / 30)
                        for s in logged_sets
                    )
                    total_reps = sum(s.get("reps", 0) or 0 for s in logged_sets)
                    total_sets = len(logged_sets)
                    volume = sum(
                        (s.get("weight", 0) or 0) * (s.get("reps", 0) or 0) for s in logged_sets
                    )
                    progress.append(
                        {
                            "date": session.get("date") or meso.started_at.isoformat(),
                            "week_number": week["week_number"],
                            "max_weight": max_weight,
                            "best_e1rm": round(best_e1rm, 1),
                            "total_reps": total_reps,
                            "total_sets": total_sets,
                            "volume": volume,
                        }
                    )

    return progress


async def get_workout_history(db: AsyncSession, mesocycle_id: str, user_id: str) -> list[dict]:
    """Get list of completed workouts from the mesocycle structure."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id)

    workouts = []
    for wi, week in enumerate(mesocycle.structure.get("weeks", [])):
        for si, session in enumerate(week.get("sessions", [])):
            logged_sets = [
                s
                for ex in session.get("exercises", [])
                for s in ex.get("sets", [])
                if s.get("logged")
            ]
            if not logged_sets:
                continue
            total_volume = sum(
                (s.get("weight", 0) or 0) * (s.get("reps", 0) or 0) for s in logged_sets
            )
            workouts.append(
                {
                    "week_index": wi,
                    "session_index": si,
                    "session_name": session["session_name"],
                    "week_number": week["week_number"],
                    "date": session.get("date"),
                    "total_sets": len(logged_sets),
                    "total_volume": total_volume,
                }
            )

    return workouts


async def get_workout_detail(
    db: AsyncSession, mesocycle_id: str, user_id: str, week_index: int, session_index: int
) -> dict:
    """Get detailed workout data for a specific session in the structure."""
    mesocycle = await get_user_mesocycle(db, mesocycle_id, user_id)
    week, session = get_session_from_structure(mesocycle.structure, week_index, session_index)

    return {
        "session_name": session["session_name"],
        "week_number": week["week_number"],
        "date": session.get("date"),
        "notes": session.get("notes"),
        "exercises": session["exercises"],
        "exercise_notes": mesocycle.structure.get("exercise_notes", {}),
    }
