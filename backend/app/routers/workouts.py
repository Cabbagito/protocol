from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.seed import compute_progression, get_current_position
from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle
from app.models.user import User

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


class LogSetsRequest(BaseModel):
    mesocycle_id: str
    week_index: int = Field(ge=0)
    session_index: int = Field(ge=0)
    sets: list[SetLog]
    notes: str | None = None
    exercise_updates: list[ExerciseUpdate] | None = None


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


# --- Endpoints ---


@router.get("/template/{mesocycle_id}")
async def get_workout_template(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current workout template from the mesocycle structure."""
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

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


@router.get("/template/{mesocycle_id}/{week_index}/{session_index}")
async def get_specific_template(
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific workout template by week and session index."""
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    structure = mesocycle.structure
    weeks = structure.get("weeks", [])

    if week_index >= len(weeks):
        raise HTTPException(status_code=400, detail="Invalid week index")

    week = weeks[week_index]
    sessions = week.get("sessions", [])

    if session_index >= len(sessions):
        raise HTTPException(status_code=400, detail="Invalid session index")

    session = sessions[session_index]

    return {
        "session_name": session["session_name"],
        "week_number": week["week_number"],
        "target_rir": week["rir"],
        "week_index": week_index,
        "session_index": session_index,
        "exercises": session["exercises"],
        "exercise_notes": structure.get("exercise_notes", {}),
    }


@router.post("/log")
async def log_sets(
    data: LogSetsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log sets into the mesocycle structure."""
    result = await db.execute(
        select(Mesocycle)
        .where(Mesocycle.id == data.mesocycle_id, Mesocycle.user_id == current_user.id)
        .with_for_update()
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    structure = mesocycle.structure
    weeks = structure.get("weeks", [])

    if data.week_index >= len(weeks):
        raise HTTPException(status_code=400, detail="Invalid week index")

    week = weeks[data.week_index]
    sessions = week.get("sessions", [])

    if data.session_index >= len(sessions):
        raise HTTPException(status_code=400, detail="Invalid session index")

    session = sessions[data.session_index]

    # Update the session date and notes
    session["date"] = date_type.today().isoformat()
    if data.notes is not None:
        session["notes"] = data.notes

    # Apply exercise updates (skip/unskip)
    if data.exercise_updates:
        ex_update_map = {eu.exercise_id: eu for eu in data.exercise_updates}
        for exercise in session.get("exercises", []):
            eu = ex_update_map.get(exercise["exercise_id"])
            if eu and eu.skipped is not None:
                exercise["skipped"] = eu.skipped

    # Build a lookup of logged sets
    logged_map: dict[tuple[str, int], SetLog] = {}
    for s in data.sets:
        logged_map[(s.exercise_id, s.set_num)] = s

    # Apply logged data to the structure (and un-log sets not in payload)
    for exercise in session.get("exercises", []):
        for set_data in exercise.get("sets", []):
            key = (exercise["exercise_id"], set_data["set_num"])
            if key in logged_map:
                log = logged_map[key]
                set_data["weight"] = log.weight
                set_data["reps"] = log.reps
                set_data["rir"] = log.rir
                set_data["logged"] = True
                if log.set_type:
                    set_data["set_type"] = log.set_type
            else:
                set_data["logged"] = False

    # Recompute progression for future weeks
    compute_progression(structure)

    # Mark structure as modified for SQLAlchemy to detect the change
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(mesocycle, "structure")

    await db.commit()

    return {"status": "ok", "session_name": session["session_name"]}


@router.get("/progress/{exercise_id}")
async def get_exercise_progress(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get weight progression for an exercise by scanning all mesocycle structures."""
    result = await db.execute(
        select(Mesocycle)
        .where(Mesocycle.user_id == current_user.id)
        .order_by(Mesocycle.started_at.asc())
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


class ExerciseNoteRequest(BaseModel):
    mesocycle_id: str
    exercise_id: str
    note: str | None = None


@router.patch("/exercise-note")
async def update_exercise_note(
    data: ExerciseNoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update or remove a meso-wide exercise note."""
    result = await db.execute(
        select(Mesocycle)
        .where(Mesocycle.id == data.mesocycle_id, Mesocycle.user_id == current_user.id)
        .with_for_update()
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    structure = mesocycle.structure
    if "exercise_notes" not in structure:
        structure["exercise_notes"] = {}

    if data.note:
        structure["exercise_notes"][data.exercise_id] = data.note
    else:
        structure["exercise_notes"].pop(data.exercise_id, None)

    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}


class ReplaceExerciseRequest(BaseModel):
    mesocycle_id: str
    week_index: int
    session_index: int
    exercise_index: int
    old_exercise_id: str
    new_exercise_id: str
    apply_to_future: bool = True


@router.post("/replace-exercise")
async def replace_exercise(
    data: ReplaceExerciseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace an exercise in the mesocycle structure."""
    result = await db.execute(
        select(Mesocycle)
        .where(Mesocycle.id == data.mesocycle_id, Mesocycle.user_id == current_user.id)
        .with_for_update()
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    # Look up new exercise (scoped to visible exercises)
    ex_result = await db.execute(
        select(Exercise).where(
            Exercise.id == data.new_exercise_id,
            or_(Exercise.user_id == current_user.id, Exercise.user_id.is_(None)),
        )
    )
    new_exercise = ex_result.scalar_one_or_none()
    if not new_exercise:
        raise HTTPException(status_code=404, detail="New exercise not found")

    structure = mesocycle.structure
    weeks = structure.get("weeks", [])

    if data.week_index >= len(weeks):
        raise HTTPException(status_code=400, detail="Invalid week index")

    week = weeks[data.week_index]
    sessions = week.get("sessions", [])

    if data.session_index >= len(sessions):
        raise HTTPException(status_code=400, detail="Invalid session index")

    session = sessions[data.session_index]
    exercises = session.get("exercises", [])

    if data.exercise_index >= len(exercises):
        raise HTTPException(status_code=400, detail="Invalid exercise index")

    target_ex = exercises[data.exercise_index]
    if target_ex["exercise_id"] != data.old_exercise_id:
        raise HTTPException(status_code=400, detail="Exercise ID mismatch")

    session_name = session["session_name"]
    day_order = session["day_order"]

    def replace_in_exercise(ex_data: dict) -> None:
        ex_data["exercise_id"] = new_exercise.id
        ex_data["exercise_name"] = new_exercise.name
        ex_data["muscle_group"] = new_exercise.muscle_group
        ex_data["equipment_type"] = new_exercise.equipment_type
        for s in ex_data.get("sets", []):
            if not s.get("logged"):
                s["weight"] = None
                s["reps"] = None
                s["suggested_weight"] = None

    # Replace in current week
    replace_in_exercise(target_ex)

    # If apply_to_future, replace in all subsequent weeks
    if data.apply_to_future:
        for wi in range(data.week_index + 1, len(weeks)):
            future_week = weeks[wi]
            for future_session in future_week.get("sessions", []):
                if (
                    future_session["session_name"] == session_name
                    and future_session["day_order"] == day_order
                ):
                    for fe in future_session.get("exercises", []):
                        if fe["exercise_id"] == data.old_exercise_id:
                            replace_in_exercise(fe)

    # Re-run progression
    compute_progression(structure)

    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}


@router.get("/history/{mesocycle_id}")
async def get_workout_history(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of completed workouts from the mesocycle structure."""
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

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


@router.get("/detail/{mesocycle_id}/{week_index}/{session_index}")
async def get_workout_detail(
    mesocycle_id: str,
    week_index: int,
    session_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed workout data for a specific session in the structure."""
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    structure = mesocycle.structure
    weeks = structure.get("weeks", [])

    if week_index >= len(weeks):
        raise HTTPException(status_code=400, detail="Invalid week index")

    week = weeks[week_index]
    sessions = week.get("sessions", [])

    if session_index >= len(sessions):
        raise HTTPException(status_code=400, detail="Invalid session index")

    session = sessions[session_index]

    return {
        "session_name": session["session_name"],
        "week_number": week["week_number"],
        "date": session.get("date"),
        "notes": session.get("notes"),
        "exercises": session["exercises"],
        "exercise_notes": structure.get("exercise_notes", {}),
    }
