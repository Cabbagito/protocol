from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.schemas.user import UserCreate, UserCreateResponse, UserResponse
from app.services import user_service

router = APIRouter()


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return await user_service.list_users(db)


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user, password = await user_service.create_user(db, payload.name, payload.password)
    return UserCreateResponse(
        id=user.id,
        name=user.name,
        is_admin=user.is_admin,
        created_at=user.created_at,
        password=password,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    await user_service.delete_user(db, user_id, admin)
