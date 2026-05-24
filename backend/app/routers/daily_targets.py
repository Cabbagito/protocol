from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.daily_targets import DailyTargetsResponse, DailyTargetsUpdate
from app.services import daily_targets_service

router = APIRouter()


@router.get("/daily-targets", response_model=DailyTargetsResponse)
async def get_daily_targets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await daily_targets_service.get_targets(db, current_user.id)


@router.put("/daily-targets", response_model=DailyTargetsResponse)
async def update_daily_targets(
    payload: DailyTargetsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await daily_targets_service.update_targets(
        db, current_user.id, data=payload
    )
