from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mesocycle import Mesocycle, WorkoutLog
from app.models.split import Split

router = APIRouter()


def calculate_rir_scheme(total_weeks: int) -> list[int]:
    """Calculate RiR scheme based on total weeks.

    Standard approach:
    - 4 weeks: [3, 2, 1, 0] (week 4 = deload at RiR 0)
    - 5 weeks: [3, 2, 1, 0, deload]
    - 6 weeks: [3, 2, 2, 1, 0, deload]

    The last week is always a deload week (marked as -1).
    """
    if total_weeks <= 1:
        return [0]

    if total_weeks == 2:
        return [2, -1]  # -1 = deload

    if total_weeks == 3:
        return [3, 1, -1]

    if total_weeks == 4:
        return [3, 2, 1, -1]

    if total_weeks == 5:
        return [3, 2, 1, 0, -1]

    # 6+ weeks: start at RiR 3, gradually decrease, end with deload
    training_weeks = total_weeks - 1  # Last week is deload
    scheme = []
    for i in range(training_weeks):
        # Linearly decrease from 3 to 0
        rir = max(0, 3 - int(i * 4 / training_weeks))
        scheme.append(rir)
    scheme.append(-1)  # Deload week
    return scheme


# --- Pydantic Schemas ---

class MesocycleCreate(BaseModel):
    split_id: str
    name: str = Field(min_length=1, max_length=100)
    total_weeks: int = Field(default=4, ge=1, le=12)
    started_at: Optional[date] = None


class MesocycleUpdate(BaseModel):
    name: Optional[str] = None
    current_week: Optional[int] = None
    is_active: Optional[bool] = None


class MesocycleListItem(BaseModel):
    id: str
    name: str
    split_name: str
    total_weeks: int
    current_week: int
    is_active: bool
    started_at: date

    class Config:
        from_attributes = True


class MesocycleResponse(BaseModel):
    id: str
    name: str
    split_id: str
    split_name: str
    total_weeks: int
    rir_scheme: list[int]
    current_week: int
    current_rir: int
    is_active: bool
    started_at: date
    workouts_completed: int

    class Config:
        from_attributes = True


# --- Endpoints ---

@router.get("", response_model=list[MesocycleListItem])
async def list_mesocycles(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    query = select(Mesocycle).options(selectinload(Mesocycle.split))
    if active_only:
        query = query.where(Mesocycle.is_active == True)
    query = query.order_by(Mesocycle.is_active.desc(), Mesocycle.started_at.desc())

    result = await db.execute(query)
    mesocycles = result.scalars().all()

    return [
        {
            "id": m.id,
            "name": m.name,
            "split_name": m.split.name,
            "total_weeks": m.total_weeks,
            "current_week": m.current_week,
            "is_active": m.is_active,
            "started_at": m.started_at,
        }
        for m in mesocycles
    ]


@router.post("", response_model=MesocycleResponse, status_code=status.HTTP_201_CREATED)
async def create_mesocycle(
    data: MesocycleCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    # Verify split exists
    result = await db.execute(select(Split).where(Split.id == data.split_id))
    split = result.scalar_one_or_none()
    if not split:
        raise HTTPException(status_code=404, detail="Split not found")

    # Deactivate any currently active mesocycle
    result = await db.execute(select(Mesocycle).where(Mesocycle.is_active == True))
    active_mesocycles = result.scalars().all()
    for m in active_mesocycles:
        m.is_active = False

    # Calculate RiR scheme
    rir_scheme = calculate_rir_scheme(data.total_weeks)

    mesocycle = Mesocycle(
        split_id=data.split_id,
        name=data.name,
        total_weeks=data.total_weeks,
        rir_scheme=rir_scheme,
        current_week=1,
        started_at=data.started_at or date.today(),
        is_active=True,
    )
    db.add(mesocycle)
    await db.commit()
    await db.refresh(mesocycle)

    return _mesocycle_to_response(mesocycle, split.name, 0)


@router.get("/active", response_model=Optional[MesocycleResponse])
async def get_active_mesocycle(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split), selectinload(Mesocycle.workout_logs))
        .where(Mesocycle.is_active == True)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        return None

    return _mesocycle_to_response(
        mesocycle,
        mesocycle.split.name,
        len(mesocycle.workout_logs),
    )


@router.get("/{mesocycle_id}", response_model=MesocycleResponse)
async def get_mesocycle(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split), selectinload(Mesocycle.workout_logs))
        .where(Mesocycle.id == mesocycle_id)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    return _mesocycle_to_response(
        mesocycle,
        mesocycle.split.name,
        len(mesocycle.workout_logs),
    )


@router.put("/{mesocycle_id}", response_model=MesocycleResponse)
async def update_mesocycle(
    mesocycle_id: str,
    data: MesocycleUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split), selectinload(Mesocycle.workout_logs))
        .where(Mesocycle.id == mesocycle_id)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    if data.name is not None:
        mesocycle.name = data.name

    if data.current_week is not None:
        if data.current_week < 1 or data.current_week > mesocycle.total_weeks:
            raise HTTPException(status_code=400, detail="Invalid week number")
        mesocycle.current_week = data.current_week

    if data.is_active is not None:
        if data.is_active:
            # Deactivate any other active mesocycle
            other_result = await db.execute(
                select(Mesocycle).where(Mesocycle.is_active == True, Mesocycle.id != mesocycle_id)
            )
            for m in other_result.scalars().all():
                m.is_active = False
        mesocycle.is_active = data.is_active

    await db.commit()
    await db.refresh(mesocycle)

    return _mesocycle_to_response(
        mesocycle,
        mesocycle.split.name,
        len(mesocycle.workout_logs),
    )


@router.post("/{mesocycle_id}/advance-week", response_model=MesocycleResponse)
async def advance_week(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Mesocycle)
        .options(selectinload(Mesocycle.split), selectinload(Mesocycle.workout_logs))
        .where(Mesocycle.id == mesocycle_id)
    )
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    if mesocycle.current_week >= mesocycle.total_weeks:
        raise HTTPException(status_code=400, detail="Already at final week")

    mesocycle.current_week += 1
    await db.commit()
    await db.refresh(mesocycle)

    return _mesocycle_to_response(
        mesocycle,
        mesocycle.split.name,
        len(mesocycle.workout_logs),
    )


@router.delete("/{mesocycle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mesocycle(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await db.execute(select(Mesocycle).where(Mesocycle.id == mesocycle_id))
    mesocycle = result.scalar_one_or_none()

    if not mesocycle:
        raise HTTPException(status_code=404, detail="Mesocycle not found")

    await db.delete(mesocycle)
    await db.commit()


# --- Helper Functions ---

def _mesocycle_to_response(mesocycle: Mesocycle, split_name: str, workouts_completed: int) -> dict:
    if mesocycle.rir_scheme and mesocycle.current_week <= len(mesocycle.rir_scheme):
        current_rir = mesocycle.rir_scheme[mesocycle.current_week - 1]
    else:
        current_rir = 0
    return {
        "id": mesocycle.id,
        "name": mesocycle.name,
        "split_id": mesocycle.split_id,
        "split_name": split_name,
        "total_weeks": mesocycle.total_weeks,
        "rir_scheme": mesocycle.rir_scheme,
        "current_week": mesocycle.current_week,
        "current_rir": current_rir,
        "is_active": mesocycle.is_active,
        "started_at": mesocycle.started_at,
        "workouts_completed": workouts_completed,
    }
