from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.mesocycle import (
    MesocycleCreate,
    MesocycleListItem,
    MesocycleResponse,
    MesocycleUpdate,
)
from app.services import mesocycle_service

router = APIRouter()


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
