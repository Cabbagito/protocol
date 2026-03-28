from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.split import SplitCreate, SplitListItem, SplitResponse
from app.services import split_service

router = APIRouter()


@router.get("", response_model=list[SplitListItem])
async def list_splits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await split_service.list_splits(db, current_user.id)


@router.post("", response_model=SplitResponse, status_code=status.HTTP_201_CREATED)
async def create_split(
    split_data: SplitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await split_service.create_split(db, current_user.id, data=split_data)


@router.get("/{split_id}", response_model=SplitResponse)
async def get_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await split_service.get_split(db, split_id, current_user.id)


@router.put("/{split_id}", response_model=SplitResponse)
async def update_split(
    split_id: str,
    split_data: SplitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await split_service.update_split(db, split_id, current_user.id, data=split_data)


@router.delete("/{split_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_split(
    split_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await split_service.delete_split(db, split_id, current_user.id)
