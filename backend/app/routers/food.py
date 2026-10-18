from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import label_limiter
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.food import (
    BarcodeLookupResponse,
    FoodDraft,
    FoodItemCreate,
    FoodItemResponse,
    FoodItemUpdate,
    FoodUnitCreate,
    ReadLabelRequest,
)
from app.services import food_service, label_reader

router = APIRouter()


@router.get("/foods", response_model=list[FoodItemResponse])
async def list_foods(
    q: str | None = Query(default=None, max_length=100),
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
    return await food_service.lookup_barcode(db, barcode, current_user.id)


@router.post("/foods/read-label", response_model=FoodDraft)
async def read_label(
    payload: ReadLabelRequest,
    current_user: User = Depends(get_current_user),
):
    """Read name, brand, per-100 g values and units from photos of a pack.
    Saves nothing."""
    retry_after = label_limiter.retry_after(current_user.id)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many label readings, try again later",
            headers={"Retry-After": str(retry_after)},
        )
    label_limiter.record_failure(current_user.id)
    return await label_reader.read_label(payload.images)


@router.get("/foods/{food_id}", response_model=FoodItemResponse)
async def get_food(
    food_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await food_service.get_food(db, food_id, current_user.id)


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


@router.post(
    "/foods/{food_id}/units",
    response_model=FoodItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_unit(
    food_id: str,
    unit: FoodUnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a personal unit to a food; returns the food with its units."""
    return await food_service.add_unit(db, food_id, current_user.id, data=unit)


@router.delete("/foods/{food_id}/units/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unit(
    food_id: str,
    unit_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await food_service.delete_unit(db, food_id, unit_id, current_user.id)
