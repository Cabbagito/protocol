from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.food import (
    BarcodeLookupResponse,
    DailyLogResponse,
    FoodItemCreate,
    FoodItemResponse,
    FoodItemUpdate,
    FoodLogCreate,
    FoodLogResponse,
)
from app.services import food_service

router = APIRouter()


@router.get("/foods", response_model=list[FoodItemResponse])
async def list_foods(
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await food_service.list_foods(db, current_user.id, q=q)


@router.get("/foods/by-barcode/{barcode}", response_model=BarcodeLookupResponse)
async def lookup_barcode(
    barcode: str = Path(pattern=r"^\d{8,14}$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await food_service.lookup_barcode(db, barcode)


@router.post(
    "/foods",
    response_model=FoodItemResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_200_OK: {
            "model": FoodItemResponse,
            "description": "A food with this barcode already exists. It is returned "
            "unchanged and the submitted values are ignored.",
        }
    },
)
async def create_food(
    food: FoodItemCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item, created = await food_service.create_food(db, current_user.id, data=food)
    if not created:
        response.status_code = status.HTTP_200_OK
    return item


@router.put("/foods/{food_id}", response_model=FoodItemResponse)
async def update_food(
    food_id: str,
    food: FoodItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await food_service.update_food(db, food_id, current_user.id, data=food)


@router.delete("/foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food(
    food_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await food_service.delete_food(db, food_id, current_user.id)


@router.get("/food-logs", response_model=DailyLogResponse)
async def get_daily_log(
    date_: date | None = Query(default=None, alias="date"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = date_ or datetime.now(UTC).date()
    return await food_service.get_daily_log(db, current_user.id, target)


@router.post("/food-logs", response_model=FoodLogResponse, status_code=status.HTTP_201_CREATED)
async def create_log(
    log: FoodLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await food_service.create_log(db, current_user.id, data=log)


@router.delete("/food-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await food_service.delete_log(db, log_id, current_user.id)
