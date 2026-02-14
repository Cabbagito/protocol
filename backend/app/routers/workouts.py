from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import cast, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle, WorkoutLog
from app.models.split import Session, SessionExercise

router = APIRouter()


# --- Pydantic Schemas ---


class SetData(BaseModel):
    exercise_id: str
    set_num: int = Field(ge=1)
    weight: float = Field(ge=0)
    reps: int = Field(ge=0)
    rir: int | None = Field(default=None, ge=-1, le=5)
    completed: bool = True


class WorkoutCreate(BaseModel):
    mesocycle_id: str
    session_id: str
    date: Optional[date_type] = None
    notes: str | None = None
    sets: list[SetData]


class WorkoutUpdate(BaseModel):
    notes: str | None = None
    sets: list[SetData] | None = None


class ExerciseInSession(BaseModel):
    exercise_id: str
    exercise_name: str
    muscle_groups: list[str] = []
    equipment_type: str = ""
    order: int
    target_sets: int
    target_rep_min: int
    target_rep_max: int
    last_weight: float | None = None
    suggested_weight: float | None = None
    progression_note: str | None = None


class WorkoutTemplate(BaseModel):
    session_id: str
    session_name: str
    week_number: int
    target_rir: int
    exercises: list[ExerciseInSession]


class SetInWorkout(BaseModel):
    exercise_id: str
    exercise_name: str
    set_num: int
    weight: float
    reps: int
    rir: int | None = None
    completed: bool


class WorkoutResponse(BaseModel):
    id: str
    mesocycle_id: str
    session_id: str | None
    session_name: str | None
    week_number: int
    date: date_type
    notes: str | None
    sets: list[SetInWorkout]

    class Config:
        from_attributes = True


class WorkoutListItem(BaseModel):
    id: str
    session_name: str | None
    week_number: int
    date: date_type
    total_sets: int
    total_volume: float  # sum of weight * reps

    class Config:
        from_attributes = True


# Weight increment defaults by equipment type
WEIGHT_INCREMENTS = {
    "barbell": 2.5,
    "dumbbell": 2.0,
    "machine": 5.0,
    "cable": 2.5,
    "bodyweight": 0.0,
}


# --- Endpoints ---


@router.get("/template/{mesocycle_id}/{session_id}", response_model=WorkoutTemplate)
async def get_workout_template(
    mesocycle_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get workout template with last weights and progression suggestions."""
    # Get mesocycle
    result = await db.execute(select(Mesocycle).where(Mesocycle.id == mesocycle_id))
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    # Get session with exercises
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.exercises).selectinload(SessionExercise.exercise))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get previous workout logs for this session to find last weights
    result = await db.execute(
        select(WorkoutLog)
        .where(
            WorkoutLog.mesocycle_id == mesocycle_id,
            WorkoutLog.session_id == session_id,
        )
        .order_by(WorkoutLog.date.desc())
        .limit(1)
    )
    last_workout = result.scalar_one_or_none()

    # Build exercise list with progression suggestions
    exercises = []
    for se in sorted(session.exercises, key=lambda x: x.order):
        last_weight = None
        suggested_weight = None
        progression_note = None

        if last_workout and last_workout.sets:
            # Find last weight for this exercise
            exercise_sets = [s for s in last_workout.sets if s.get("exercise_id") == se.exercise_id]
            if exercise_sets:
                completed_sets = [s for s in exercise_sets if s.get("completed")]
                if completed_sets:
                    last_weight = max(s.get("weight", 0) for s in completed_sets)

                    # Check if all sets hit rep_max for progression
                    all_hit_max = all(s.get("reps", 0) >= se.rep_max for s in completed_sets)
                    if all_hit_max:
                        increment = WEIGHT_INCREMENTS.get(se.exercise.equipment_type, 2.5)
                        if increment > 0:
                            suggested_weight = last_weight + increment
                            progression_note = (
                                f"All sets hit {se.rep_max} reps. Increase by {increment}kg."
                            )
                        else:
                            progression_note = (
                                f"All sets hit {se.rep_max} reps. Progress to harder variation."
                            )
                    else:
                        suggested_weight = last_weight

        exercises.append(
            ExerciseInSession(
                exercise_id=se.exercise_id,
                exercise_name=se.exercise.name,
                muscle_groups=se.exercise.muscle_groups,
                equipment_type=se.exercise.equipment_type,
                order=se.order,
                target_sets=se.sets,
                target_rep_min=se.rep_min,
                target_rep_max=se.rep_max,
                last_weight=last_weight,
                suggested_weight=suggested_weight or last_weight,
                progression_note=progression_note,
            )
        )

    target_rir = mesocycle.rir_scheme[mesocycle.current_week - 1] if mesocycle.rir_scheme else 0

    return WorkoutTemplate(
        session_id=session.id,
        session_name=session.name,
        week_number=mesocycle.current_week,
        target_rir=target_rir,
        exercises=exercises,
    )


@router.post("", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
async def create_workout(
    data: WorkoutCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Log a completed workout."""
    # Verify mesocycle exists
    result = await db.execute(select(Mesocycle).where(Mesocycle.id == data.mesocycle_id))
    mesocycle = result.scalar_one_or_none()
    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    # Get session for name
    session_name = None
    if data.session_id:
        result = await db.execute(select(Session).where(Session.id == data.session_id))
        session = result.scalar_one_or_none()
        if session:
            session_name = session.name

    # Get exercise names for the response
    exercise_ids = list(set(s.exercise_id for s in data.sets))
    result = await db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
    exercises_map = {ex.id: ex.name for ex in result.scalars().all()}

    workout = WorkoutLog(
        mesocycle_id=data.mesocycle_id,
        session_id=data.session_id,
        week_number=mesocycle.current_week,
        date=data.date or date_type.today(),
        notes=data.notes,
        sets=[s.model_dump() for s in data.sets],
    )
    db.add(workout)
    await db.commit()
    await db.refresh(workout)

    return _workout_to_response(workout, session_name, exercises_map)


@router.get("", response_model=list[WorkoutListItem])
async def list_workouts(
    mesocycle_id: str | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """List workout logs."""
    query = select(WorkoutLog).options(selectinload(WorkoutLog.session))

    if mesocycle_id:
        query = query.where(WorkoutLog.mesocycle_id == mesocycle_id)

    query = query.order_by(WorkoutLog.date.desc()).limit(limit)

    result = await db.execute(query)
    workouts = result.scalars().all()

    return [
        WorkoutListItem(
            id=w.id,
            session_name=w.session.name if w.session else None,
            week_number=w.week_number,
            date=w.date,
            total_sets=len([s for s in w.sets if s.get("completed")]),
            total_volume=sum(
                s.get("weight", 0) * s.get("reps", 0) for s in w.sets if s.get("completed")
            ),
        )
        for w in workouts
    ]


@router.get("/{workout_id}", response_model=WorkoutResponse)
async def get_workout(
    workout_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get a specific workout log."""
    result = await db.execute(
        select(WorkoutLog)
        .options(selectinload(WorkoutLog.session))
        .where(WorkoutLog.id == workout_id)
    )
    workout = result.scalar_one_or_none()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    # Get exercise names
    exercise_ids = list(set(s.get("exercise_id") for s in workout.sets if s.get("exercise_id")))
    result = await db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
    exercises_map = {ex.id: ex.name for ex in result.scalars().all()}

    session_name = workout.session.name if workout.session else None
    return _workout_to_response(workout, session_name, exercises_map)


@router.put("/{workout_id}", response_model=WorkoutResponse)
async def update_workout(
    workout_id: str,
    data: WorkoutUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Update a workout log."""
    result = await db.execute(
        select(WorkoutLog)
        .options(selectinload(WorkoutLog.session))
        .where(WorkoutLog.id == workout_id)
    )
    workout = result.scalar_one_or_none()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    if data.notes is not None:
        workout.notes = data.notes

    if data.sets is not None:
        workout.sets = [s.model_dump() for s in data.sets]

    await db.commit()
    await db.refresh(workout)

    # Get exercise names
    exercise_ids = list(set(s.get("exercise_id") for s in workout.sets if s.get("exercise_id")))
    result = await db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
    exercises_map = {ex.id: ex.name for ex in result.scalars().all()}

    session_name = workout.session.name if workout.session else None
    return _workout_to_response(workout, session_name, exercises_map)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(
    workout_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Delete a workout log."""
    result = await db.execute(select(WorkoutLog).where(WorkoutLog.id == workout_id))
    workout = result.scalar_one_or_none()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    await db.delete(workout)
    await db.commit()


@router.get("/progress/{exercise_id}", response_model=list[dict])
async def get_exercise_progress(
    exercise_id: str,
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Get weight progression for a specific exercise."""
    # Filter at DB level: only fetch workouts that contain this exercise in their JSONB sets
    result = await db.execute(
        select(WorkoutLog)
        .where(
            WorkoutLog.sets.op("@>")(
                cast(f'[{{"exercise_id": "{exercise_id}"}}]', type_=WorkoutLog.sets.type)
            )
        )
        .order_by(WorkoutLog.date.desc())
        .limit(limit)
    )
    workouts = result.scalars().all()

    progress = []
    for w in workouts:
        exercise_sets = [
            s for s in w.sets if s.get("exercise_id") == exercise_id and s.get("completed")
        ]
        if exercise_sets:
            max_weight = max(s.get("weight", 0) for s in exercise_sets)
            total_reps = sum(s.get("reps", 0) for s in exercise_sets)
            total_sets = len(exercise_sets)
            progress.append(
                {
                    "date": w.date.isoformat(),
                    "week_number": w.week_number,
                    "max_weight": max_weight,
                    "total_reps": total_reps,
                    "total_sets": total_sets,
                    "volume": sum(s.get("weight", 0) * s.get("reps", 0) for s in exercise_sets),
                }
            )

    # Reverse to chronological order
    return list(reversed(progress))


# --- Helper Functions ---


def _workout_to_response(
    workout: WorkoutLog,
    session_name: str | None,
    exercises_map: dict,
) -> dict:
    return {
        "id": workout.id,
        "mesocycle_id": workout.mesocycle_id,
        "session_id": workout.session_id,
        "session_name": session_name,
        "week_number": workout.week_number,
        "date": workout.date,
        "notes": workout.notes,
        "sets": [
            SetInWorkout(
                exercise_id=s.get("exercise_id"),
                exercise_name=exercises_map.get(s.get("exercise_id"), "Unknown"),
                set_num=s.get("set_num", 0),
                weight=s.get("weight", 0),
                reps=s.get("reps", 0),
                rir=s.get("rir"),
                completed=s.get("completed", False),
            )
            for s in workout.sets
        ],
    }
