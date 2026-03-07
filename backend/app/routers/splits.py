from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.exercise import Exercise
from app.models.split import Session, SessionExercise, Split
from app.models.user import User

router = APIRouter()


# --- Pydantic Schemas ---


class SessionExerciseCreate(BaseModel):
    exercise_id: str
    order: int = Field(ge=0)
    sets: int = Field(default=3, ge=1, le=10)


class SessionExerciseResponse(BaseModel):
    id: str
    exercise_id: str
    exercise_name: str
    order: int
    sets: int

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
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class SplitUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class SplitListItem(BaseModel):
    id: str
    name: str
    color: str | None
    session_count: int
    exercise_count: int

    class Config:
        from_attributes = True


class SplitResponse(BaseModel):
    id: str
    name: str
    color: str | None
    sessions: list[SessionResponse]

    class Config:
        from_attributes = True


class SessionReorder(BaseModel):
    session_ids: list[str]


# --- Split Endpoints ---


@router.get("", response_model=list[SplitListItem])
async def list_splits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exercise_count_subq = (
        select(func.count(SessionExercise.id))
        .join(Session, SessionExercise.session_id == Session.id)
        .where(Session.split_id == Split.id)
        .correlate(Split)
        .scalar_subquery()
        .label("exercise_count")
    )
    result = await db.execute(
        select(
            Split.id,
            Split.name,
            Split.color,
            func.count(Session.id).label("session_count"),
            exercise_count_subq,
        )
        .outerjoin(Session)
        .where(or_(Split.user_id == current_user.id, Split.user_id.is_(None)))
        .group_by(Split.id)
        .order_by(Split.name)
    )
    splits = result.all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "color": s.color,
            "session_count": s.session_count,
            "exercise_count": s.exercise_count or 0,
        }
        for s in splits
    ]


@router.post("", response_model=SplitResponse, status_code=status.HTTP_201_CREATED)
async def create_split(
    split: SplitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_split = Split(name=split.name, color=split.color, user_id=current_user.id)
    db.add(db_split)
    await db.commit()
    await db.refresh(db_split)
    return {"id": db_split.id, "name": db_split.name, "color": db_split.color, "sessions": []}


@router.get("/{split_id}", response_model=SplitResponse)
async def get_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.sessions)
            .selectinload(Session.exercises)
            .selectinload(SessionExercise.exercise)
        )
        .where(
            Split.id == split_id,
            or_(Split.user_id == current_user.id, Split.user_id.is_(None)),
        )
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
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.sessions)
            .selectinload(Session.exercises)
            .selectinload(SessionExercise.exercise)
        )
        .where(Split.id == split_id, Split.user_id == current_user.id)
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    split.name = split_update.name
    split.color = split_update.color
    await db.commit()
    await db.refresh(split)
    return _split_to_response(split)


@router.delete("/{split_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Split).where(Split.id == split_id, Split.user_id == current_user.id)
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    await db.delete(split)
    await db.commit()


# --- Session Endpoints ---


@router.post(
    "/{split_id}/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_session(
    split_id: str,
    session: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Split).where(Split.id == split_id, Split.user_id == current_user.id)
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    # Get next day_order
    max_order_result = await db.execute(
        select(func.coalesce(func.max(Session.day_order), -1)).where(Session.split_id == split_id)
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

    # Batch-validate all exercise IDs (scoped to visible exercises)
    if session.exercises:
        exercise_ids = [ex.exercise_id for ex in session.exercises]
        result = await db.execute(
            select(Exercise.id).where(
                Exercise.id.in_(exercise_ids),
                or_(Exercise.user_id == current_user.id, Exercise.user_id.is_(None)),
            )
        )
        found_ids = set(row[0] for row in result.all())
        missing = set(exercise_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Exercise(s) not found: {', '.join(missing)}",
            )

        for ex in session.exercises:
            db_exercise = SessionExercise(
                session_id=db_session.id,
                exercise_id=ex.exercise_id,
                order=ex.order,
                sets=ex.sets,
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
    current_user: User = Depends(get_current_user),
):
    # Verify parent split belongs to current user
    result = await db.execute(
        select(Split).where(Split.id == split_id, Split.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Split not found")

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

    # Batch-validate all exercise IDs (scoped to visible exercises)
    if session_update.exercises:
        exercise_ids = [ex.exercise_id for ex in session_update.exercises]
        result = await db.execute(
            select(Exercise.id).where(
                Exercise.id.in_(exercise_ids),
                or_(Exercise.user_id == current_user.id, Exercise.user_id.is_(None)),
            )
        )
        found_ids = set(row[0] for row in result.all())
        missing = set(exercise_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Exercise(s) not found: {', '.join(missing)}",
            )

        for ex in session_update.exercises:
            db_exercise = SessionExercise(
                session_id=session.id,
                exercise_id=ex.exercise_id,
                order=ex.order,
                sets=ex.sets,
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
    current_user: User = Depends(get_current_user),
):
    # Verify parent split belongs to current user
    result = await db.execute(
        select(Split).where(Split.id == split_id, Split.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Split not found")

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
    current_user: User = Depends(get_current_user),
):
    # Verify parent split belongs to current user
    result = await db.execute(
        select(Split).where(Split.id == split_id, Split.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Split not found")

    # Fetch all sessions for this split in one query, then validate and reorder
    result = await db.execute(select(Session).where(Session.split_id == split_id))
    sessions_by_id = {s.id: s for s in result.scalars().all()}

    for i, session_id in enumerate(reorder.session_ids):
        session = sessions_by_id.get(session_id)
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
            }
            for ex in session.exercises
        ],
    }


def _split_to_response(split: Split) -> dict:
    return {
        "id": split.id,
        "name": split.name,
        "color": split.color,
        "sessions": [_session_to_response(s) for s in split.sessions],
    }
