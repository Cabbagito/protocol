from datetime import UTC, datetime
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.seed import compute_progression, get_current_position, handle_weight_bump
from app.models.base import generate_uuid
from app.models.exercise import Exercise
from app.models.exercise_performance import ExercisePerformance
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


# --- Helpers ---


async def update_exercise_performances(db: AsyncSession, user_id: str, session: dict) -> None:
    """Upsert exercise_performances for each non-skipped exercise in a completed session."""
    for exercise in session.get("exercises", []):
        if exercise.get("skipped", False):
            continue

        logged_sets = [
            s for s in exercise.get("sets", [])
            if s.get("logged") and not s.get("skipped")
        ]
        if not logged_sets:
            continue

        working_weight = max((s.get("weight") or 0) for s in logged_sets)
        working_reps = logged_sets[0].get("target_reps", 10)
        num_sets = len(logged_sets)

        if working_weight == 0:
            continue

        now = datetime.now(UTC)
        stmt = pg_insert(ExercisePerformance).values(
            id=generate_uuid(),
            user_id=user_id,
            exercise_id=exercise["exercise_id"],
            working_weight=working_weight,
            working_reps=working_reps,
            num_sets=num_sets,
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_exercise_performances_user_exercise",
            set_={
                "working_weight": stmt.excluded.working_weight,
                "working_reps": stmt.excluded.working_reps,
                "num_sets": stmt.excluded.num_sets,
                "updated_at": now,
            },
        )
        await db.execute(stmt)


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

    # Build skipped sets lookup
    skipped_set_keys: set[tuple[str, int]] = set()
    if data.skipped_sets:
        skipped_set_keys = {(s.exercise_id, s.set_num) for s in data.skipped_sets}

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
            set_data["skipped"] = key in skipped_set_keys

    # Only compute progression on explicit end-of-workout
    if data.complete:
        handle_weight_bump(structure, data.week_index, data.session_index)
        compute_progression(structure, data.week_index, data.session_index)
        await update_exercise_performances(db, current_user.id, session)

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

    # Look up performance data for the new exercise
    perf_result = await db.execute(
        select(ExercisePerformance).where(
            ExercisePerformance.user_id == current_user.id,
            ExercisePerformance.exercise_id == data.new_exercise_id,
        )
    )
    perf = perf_result.scalar_one_or_none()

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

        current_sets = ex_data.get("sets", [])
        logged_count = sum(1 for s in current_sets if s.get("logged"))
        unlogged_count = len(current_sets) - logged_count

        # Adjust set count to match performance data (only unlogged sets)
        desired_sets = perf.num_sets if perf and perf.num_sets else unlogged_count
        target_reps = perf.working_reps if perf and perf.working_reps else 10
        suggested = perf.working_weight if perf else None

        if desired_sets > unlogged_count:
            # Add missing sets
            last_num = current_sets[-1]["set_num"] if current_sets else 0
            for i in range(desired_sets - unlogged_count):
                current_sets.append({
                    "set_num": last_num + 1 + i,
                    "weight": None,
                    "reps": None,
                    "target_reps": target_reps,
                    "suggested_weight": suggested,
                    "rir": None,
                    "logged": False,
                    "set_type": None,
                })
            ex_data["sets"] = current_sets
        elif desired_sets < unlogged_count:
            # Remove excess unlogged sets from the end
            to_remove = unlogged_count - desired_sets
            new_sets = []
            removed = 0
            for s in reversed(current_sets):
                if not s.get("logged") and removed < to_remove:
                    removed += 1
                else:
                    new_sets.append(s)
            new_sets.reverse()
            # Renumber
            for i, s in enumerate(new_sets):
                s["set_num"] = i + 1
            ex_data["sets"] = new_sets
            current_sets = new_sets

        for s in current_sets:
            if not s.get("logged"):
                s["weight"] = None
                s["reps"] = None
                s["suggested_weight"] = suggested
                s["target_reps"] = target_reps

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

    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {"status": "ok"}


@router.post("/modify-sets")
async def modify_sets(
    data: ModifySetsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add or remove a set from an exercise, propagating to future unlogged weeks."""
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
    session_name = session["session_name"]
    day_order = session["day_order"]

    # Find the target exercise
    target_exercise = None
    for ex in session.get("exercises", []):
        if ex["exercise_id"] == data.exercise_id:
            target_exercise = ex
            break

    if not target_exercise:
        raise HTTPException(status_code=404, detail="Exercise not found in session")

    sets_list = target_exercise.get("sets", [])

    if data.action == "add":
        # Clone from last set
        last_set = sets_list[-1] if sets_list else {}
        new_set = {
            "set_num": len(sets_list) + 1,
            "weight": None,
            "reps": None,
            "target_reps": last_set.get("target_reps", 10),
            "suggested_weight": last_set.get("suggested_weight"),
            "rir": None,
            "logged": False,
            "set_type": None,
        }
        sets_list.append(new_set)
        target_exercise["sets"] = sets_list
        new_set_count = len(sets_list)

        # Propagate to future weeks
        for wi in range(data.week_index + 1, len(weeks)):
            future_week = weeks[wi]
            for future_session in future_week.get("sessions", []):
                if (
                    future_session["session_name"] == session_name
                    and future_session["day_order"] == day_order
                ):
                    for fe in future_session.get("exercises", []):
                        if fe["exercise_id"] == data.exercise_id:
                            future_sets = fe.get("sets", [])
                            has_logged = any(s.get("logged") for s in future_sets)
                            if not has_logged and len(future_sets) < new_set_count:
                                last_fs = future_sets[-1] if future_sets else {}
                                future_sets.append({
                                    "set_num": len(future_sets) + 1,
                                    "weight": None,
                                    "reps": None,
                                    "target_reps": last_fs.get("target_reps", 10),
                                    "suggested_weight": last_fs.get("suggested_weight"),
                                    "rir": None,
                                    "logged": False,
                                    "set_type": None,
                                })
                                fe["sets"] = future_sets

    elif data.action == "remove":
        if data.set_num is None:
            raise HTTPException(status_code=400, detail="set_num required for remove action")

        if len(sets_list) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the only set")

        target_set = None
        for s in sets_list:
            if s["set_num"] == data.set_num:
                target_set = s
                break

        if not target_set:
            raise HTTPException(status_code=400, detail="Set not found")

        if target_set.get("logged"):
            raise HTTPException(status_code=400, detail="Cannot remove a logged set")

        sets_list.remove(target_set)
        # Renumber
        for i, s in enumerate(sets_list):
            s["set_num"] = i + 1
        target_exercise["sets"] = sets_list
        new_set_count = len(sets_list)

        # Propagate to future weeks
        for wi in range(data.week_index + 1, len(weeks)):
            future_week = weeks[wi]
            for future_session in future_week.get("sessions", []):
                if (
                    future_session["session_name"] == session_name
                    and future_session["day_order"] == day_order
                ):
                    for fe in future_session.get("exercises", []):
                        if fe["exercise_id"] == data.exercise_id:
                            future_sets = fe.get("sets", [])
                            has_logged = any(s.get("logged") for s in future_sets)
                            if not has_logged and len(future_sets) > new_set_count:
                                # Remove last unlogged set
                                future_sets.pop()
                                for i, s in enumerate(future_sets):
                                    s["set_num"] = i + 1
                                fe["sets"] = future_sets

    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(mesocycle, "structure")
    await db.commit()

    return {
        "status": "ok",
        "exercise_id": data.exercise_id,
        "sets": target_exercise["sets"],
    }


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
