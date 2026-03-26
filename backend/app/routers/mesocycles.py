from datetime import date as date_type

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services import mesocycle_service

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
    return await mesocycle_service.list_mesocycles(db, current_user.id, active_only=active_only)


@router.post("", response_model=MesocycleResponse, status_code=status.HTTP_201_CREATED)
async def create_mesocycle(
    data: MesocycleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await mesocycle_service.create_mesocycle(
        db,
        current_user.id,
        split_id=data.split_id,
        name=data.name,
        total_weeks=data.total_weeks,
        started_at=data.started_at,
    )


@router.get("/active", response_model=MesocycleResponse | None)
async def get_active_mesocycle(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await mesocycle_service.get_active(db, current_user.id)


@router.get("/{mesocycle_id}", response_model=MesocycleResponse)
async def get_mesocycle(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await mesocycle_service.get_detail(db, mesocycle_id, current_user.id)


@router.put("/{mesocycle_id}", response_model=MesocycleResponse)
async def update_mesocycle(
    mesocycle_id: str,
    data: MesocycleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await mesocycle_service.update_mesocycle(
        db,
        mesocycle_id,
        current_user.id,
        name=data.name,
        is_active=data.is_active,
    )


@router.delete("/{mesocycle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mesocycle(
    mesocycle_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await mesocycle_service.delete_mesocycle(db, mesocycle_id, current_user.id)
