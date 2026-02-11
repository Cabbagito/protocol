from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.split import Split, Session, SessionExercise
from app.models.exercise import Exercise

router = APIRouter()


# --- Pydantic Schemas ---

class SessionExerciseCreate(BaseModel):
    exercise_id: str
    order: int = Field(ge=0)
    sets: int = Field(default=3, ge=1, le=10)
    rep_min: int = Field(default=8, ge=1, le=100)
    rep_max: int = Field(default=12, ge=1, le=100)


class SessionExerciseResponse(BaseModel):
    id: str
    exercise_id: str
    exercise_name: str
    order: int
    sets: int
    rep_min: int
    rep_max: int

    class Config:
        from_attributes = True


class SessionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_rest_day: bool = False
    exercises: list[SessionExerciseCreate] = []


class SessionUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_rest_day: bool = False
    exercises: list[SessionExerciseCreate] = []


class SessionResponse(BaseModel):
    id: str
    name: str
    day_order: int
    is_rest_day: bool
    exercises: list[SessionExerciseResponse]

    class Config:
        from_attributes = True


class SplitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class SplitUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class SplitListItem(BaseModel):
    id: str
    name: str
    session_count: int

    class Config:
        from_attributes = True


class SplitResponse(BaseModel):
    id: str
    name: str
    sessions: list[SessionResponse]

    class Config:
        from_attributes = True


class SessionReorder(BaseModel):
    session_ids: list[str]


# --- Split Endpoints ---

@router.get("", response_model=list[SplitListItem])
async def list_splits(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Split.id, Split.name, func.count(Session.id).label("session_count"))
        .outerjoin(Session)
        .group_by(Split.id)
        .order_by(Split.name)
    )
    splits = result.all()
    return [{"id": s.id, "name": s.name, "session_count": s.session_count} for s in splits]


@router.post("", response_model=SplitResponse, status_code=status.HTTP_201_CREATED)
async def create_split(
    split: SplitCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    db_split = Split(name=split.name)
    db.add(db_split)
    await db.commit()
    await db.refresh(db_split)
    return {"id": db_split.id, "name": db_split.name, "sessions": []}


@router.get("/{split_id}", response_model=SplitResponse)
async def get_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.sessions).selectinload(Session.exercises).selectinload(SessionExercise.exercise)
        )
        .where(Split.id == split_id)
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    return _split_to_response(split)


@router.put("/{split_id}", response_model=SplitResponse)
async def update_split(
    split_id: str,
    split_update: SplitUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.sessions).selectinload(Session.exercises).selectinload(SessionExercise.exercise)
        )
        .where(Split.id == split_id)
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    split.name = split_update.name
    await db.commit()
    await db.refresh(split)
    return _split_to_response(split)


@router.delete("/{split_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Split).where(Split.id == split_id))
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    await db.delete(split)
    await db.commit()


# --- Session Endpoints ---

@router.post("/{split_id}/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def add_session(
    split_id: str,
    session: SessionCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Split).where(Split.id == split_id))
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    # Get next day_order
    max_order_result = await db.execute(
        select(func.coalesce(func.max(Session.day_order), -1))
        .where(Session.split_id == split_id)
    )
    next_order = max_order_result.scalar() + 1

    db_session = Session(
        split_id=split_id,
        name=session.name,
        day_order=next_order,
        is_rest_day=session.is_rest_day,
    )
    db.add(db_session)
    await db.flush()

    # Add exercises
    for ex in session.exercises:
        exercise_result = await db.execute(select(Exercise).where(Exercise.id == ex.exercise_id))
        exercise = exercise_result.scalar_one_or_none()
        if not exercise:
            raise HTTPException(status_code=400, detail=f"Exercise {ex.exercise_id} not found")

        db_exercise = SessionExercise(
            session_id=db_session.id,
            exercise_id=ex.exercise_id,
            order=ex.order,
            sets=ex.sets,
            rep_min=ex.rep_min,
            rep_max=ex.rep_max,
        )
        db.add(db_exercise)

    await db.commit()

    # Reload with exercises
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.exercises).selectinload(SessionExercise.exercise))
        .where(Session.id == db_session.id)
    )
    db_session = result.scalar_one()
    return _session_to_response(db_session)


@router.put("/{split_id}/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    split_id: str,
    session_id: str,
    session_update: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.exercises))
        .where(Session.id == session_id, Session.split_id == split_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.name = session_update.name
    session.is_rest_day = session_update.is_rest_day

    # Replace exercises: delete existing and add new ones
    for ex in session.exercises:
        await db.delete(ex)

    for ex in session_update.exercises:
        exercise_result = await db.execute(select(Exercise).where(Exercise.id == ex.exercise_id))
        exercise = exercise_result.scalar_one_or_none()
        if not exercise:
            raise HTTPException(status_code=400, detail=f"Exercise {ex.exercise_id} not found")

        db_exercise = SessionExercise(
            session_id=session.id,
            exercise_id=ex.exercise_id,
            order=ex.order,
            sets=ex.sets,
            rep_min=ex.rep_min,
            rep_max=ex.rep_max,
        )
        db.add(db_exercise)

    await db.commit()

    # Reload with exercises
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.exercises).selectinload(SessionExercise.exercise))
        .where(Session.id == session_id)
    )
    session = result.scalar_one()
    return _session_to_response(session)


@router.delete("/{split_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    split_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.split_id == split_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.commit()


@router.put("/{split_id}/sessions/reorder", response_model=list[SessionResponse])
async def reorder_sessions(
    split_id: str,
    reorder: SessionReorder,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Split).where(Split.id == split_id))
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    # Update order for each session (validate all IDs belong to this split)
    for i, session_id in enumerate(reorder.session_ids):
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.split_id == split_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=400,
                detail=f"Session {session_id} not found in this split",
            )
        session.day_order = i

    await db.commit()

    # Return updated sessions
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.exercises).selectinload(SessionExercise.exercise))
        .where(Session.split_id == split_id)
        .order_by(Session.day_order)
    )
    sessions = result.scalars().all()
    return [_session_to_response(s) for s in sessions]


# --- Helper Functions ---

def _session_to_response(session: Session) -> dict:
    return {
        "id": session.id,
        "name": session.name,
        "day_order": session.day_order,
        "is_rest_day": session.is_rest_day,
        "exercises": [
            {
                "id": ex.id,
                "exercise_id": ex.exercise_id,
                "exercise_name": ex.exercise.name,
                "order": ex.order,
                "sets": ex.sets,
                "rep_min": ex.rep_min,
                "rep_max": ex.rep_max,
            }
            for ex in session.exercises
        ],
    }


def _split_to_response(split: Split) -> dict:
    return {
        "id": split.id,
        "name": split.name,
        "sessions": [_session_to_response(s) for s in split.sessions],
    }
