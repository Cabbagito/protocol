from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.weight import WeightLogCreate, WeightLogResponse
from app.services import weight_service

router = APIRouter()


@router.get("/weight-logs", response_model=list[WeightLogResponse])
async def list_weight_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await weight_service.list_weights(db, current_user.id)


@router.post(
    "/weight-logs",
    response_model=WeightLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_weight(
    payload: WeightLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await weight_service.log_weight(db, current_user.id, data=payload)


@router.delete("/weight-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await weight_service.delete_weight(db, log_id, current_user.id)
