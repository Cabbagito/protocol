from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.seed import build_mesocycle_structure, get_current_position
from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle
from app.models.split import Split, SplitDay, SplitDayExercise
from app.models.user import User

router = APIRouter()


# --- Pydantic Schemas ---


class MesocycleCreate(BaseModel):
    split_id: str
    name: str = Field(min_length=1, max_length=100)
    total_weeks: int = Field(default=4, ge=3, le=8)
    started_at: date_type | None = None


class MesocycleUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class MesocycleListItem(BaseModel):
    id: str
    name: str
    split_name: str
    split_color: str | None
    total_weeks: int
    current_week: int
    current_rir: int
    is_active: bool
    started_at: date_type
    workouts_completed: int
    total_workouts: int

    class Config:
        from_attributes = True


class MesocycleResponse(BaseModel):
    id: str
    name: str
    split_id: str
    split_name: str
    split_color: str | None
    total_weeks: int
    rir_scheme: list[int]
    current_week: int
    current_rir: int
    is_active: bool
    started_at: date_type
    workouts_completed: int
    structure: dict

    class Config:
        from_attributes = True


# --- Endpoints ---


@router.get("", response_model=list[MesocycleListItem])
async def list_mesocycles(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.user_id == current_user.id)
    )
    if active_only:
        query = query.where(Mesocycle.is_active.is_(True))
    query = query.order_by(Mesocycle.is_active.desc(), Mesocycle.started_at.desc())

    result = await db.execute(query)
    mesocycles = result.scalars().all()

    return [_mesocycle_to_list_item(m) for m in mesocycles]


@router.post("", response_model=MesocycleResponse, status_code=status.HTTP_201_CREATED)
async def create_mesocycle(
    data: MesocycleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify split exists and is visible to user, load sessions with exercises
    result = await db.execute(
        select(Split)
        .options(
            selectinload(Split.days)
            .selectinload(SplitDay.exercises)
            .selectinload(SplitDayExercise.exercise)
        )
        .where(
            Split.id == data.split_id,
            or_(Split.user_id == current_user.id, Split.user_id.is_(None)),
        )
    )
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    # Bulk-deactivate only this user's active mesocycles
    await db.execute(
        update(Mesocycle)
        .where(Mesocycle.is_active.is_(True), Mesocycle.user_id == current_user.id)
        .values(is_active=False)
    )

    # Build exercise lookup by id
    exercise_ids = [de.exercise_id for d in split.days for de in d.exercises]
    if exercise_ids:
        result = await db.execute(select(Exercise).where(Exercise.id.in_(exercise_ids)))
        exercises_by_id = {e.id: e for e in result.scalars().all()}
    else:
        exercises_by_id = {}

    # Build the JSONB structure
    structure = build_mesocycle_structure(split.days, exercises_by_id, data.total_weeks)

    mesocycle = Mesocycle(
        split_id=data.split_id,
        user_id=current_user.id,
        name=data.name,
        started_at=data.started_at or date_type.today(),
        is_active=True,
        structure=structure,
    )
    db.add(mesocycle)
    await db.commit()
    await db.refresh(mesocycle)

    return _mesocycle_to_response(mesocycle, split.name, split.color)


@router.get("/active", response_model=MesocycleResponse | None)
async def get_active_mesocycle(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.is_active.is_(True), Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        return None

    return _mesocycle_to_response(mesocycle, mesocycle.split.name, mesocycle.split.color)


@router.get("/{mesocycle_id}", response_model=MesocycleResponse)
async def get_mesocycle(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    return _mesocycle_to_response(mesocycle, mesocycle.split.name, mesocycle.split.color)


@router.put("/{mesocycle_id}", response_model=MesocycleResponse)
async def update_mesocycle(
    mesocycle_id: str,
    data: MesocycleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split))
        .where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    if data.name is not None:
        mesocycle.name = data.name

    if data.is_active is not None:
        if data.is_active:
            await db.execute(
                update(Mesocycle)
                .where(
                    Mesocycle.is_active.is_(True),
                    Mesocycle.id != mesocycle_id,
                    Mesocycle.user_id == current_user.id,
                )
                .values(is_active=False)
            )
        mesocycle.is_active = data.is_active

    await db.commit()
    await db.refresh(mesocycle)

    return _mesocycle_to_response(mesocycle, mesocycle.split.name, mesocycle.split.color)


@router.delete("/{mesocycle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mesocycle(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle).where(Mesocycle.id == mesocycle_id, Mesocycle.user_id == current_user.id)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    await db.delete(mesocycle)
    await db.commit()


# --- Helper Functions ---


def _derive_fields(structure: dict) -> dict:
    """Derive total_weeks, current_week, rir_scheme, workouts_completed from structure."""
    weeks = structure.get("weeks", [])
    total_weeks = len(weeks)
    rir_scheme = [w.get("rir", 0) for w in weeks]

    pos = get_current_position(structure)
    if pos.get("completed"):
        current_week = total_weeks
    else:
        current_week = pos["week_index"] + 1

    current_rir = rir_scheme[current_week - 1] if rir_scheme else 0

    # Count fully-logged sessions (respecting skipped exercises)
    workouts_completed = 0
    for week in weeks:
        for session in week.get("sessions", []):
            non_skipped = [
                ex for ex in session.get("exercises", []) if not ex.get("skipped", False)
            ]
            if not non_skipped:
                continue
            all_logged = all(s["logged"] for ex in non_skipped for s in ex.get("sets", []))
            if all_logged:
                workouts_completed += 1

    return {
        "total_weeks": total_weeks,
        "rir_scheme": rir_scheme,
        "current_week": current_week,
        "current_rir": current_rir,
        "workouts_completed": workouts_completed,
    }


def _mesocycle_to_response(
    mesocycle: Mesocycle, split_name: str, split_color: str | None = None
) -> dict:
    derived = _derive_fields(mesocycle.structure)
    return {
        "id": mesocycle.id,
        "name": mesocycle.name,
        "split_id": mesocycle.split_id,
        "split_name": split_name,
        "split_color": split_color,
        "total_weeks": derived["total_weeks"],
        "rir_scheme": derived["rir_scheme"],
        "current_week": derived["current_week"],
        "current_rir": derived["current_rir"],
        "is_active": mesocycle.is_active,
        "started_at": mesocycle.started_at,
        "workouts_completed": derived["workouts_completed"],
        "structure": mesocycle.structure,
    }


def _mesocycle_to_list_item(mesocycle: Mesocycle) -> dict:
    derived = _derive_fields(mesocycle.structure)
    weeks = mesocycle.structure.get("weeks", [])
    total_workouts = sum(
        1
        for week in weeks
        for session in week.get("sessions", [])
        if any(not ex.get("skipped", False) for ex in session.get("exercises", []))
    )
    return {
        "id": mesocycle.id,
        "name": mesocycle.name,
        "split_name": mesocycle.split.name,
        "split_color": mesocycle.split.color if mesocycle.split else None,
        "total_weeks": derived["total_weeks"],
        "current_week": derived["current_week"],
        "current_rir": derived["current_rir"],
        "is_active": mesocycle.is_active,
        "started_at": mesocycle.started_at,
        "workouts_completed": derived["workouts_completed"],
        "total_workouts": total_workouts,
    }
