from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import get_db, get_session_factory
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.meal import DayKcal, DayResponse, MealPut, MealResponse
from app.services import meal_service, meal_summary

router = APIRouter()


@router.get("", response_model=DayResponse)
async def get_day(
    date_: date = Query(alias="date"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One day: its meals by time, totals and the user's targets."""
    return await meal_service.get_day(db, current_user.id, date_)


@router.get("/days", response_model=list[DayKcal])
async def list_days(
    from_: date = Query(alias="from"),
    to: date = Query(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kcal per day for the days with meals between two dates (inclusive)."""
    return await meal_service.list_days(db, current_user.id, from_, to)


@router.get("/{meal_id}", response_model=MealResponse)
async def get_meal(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await meal_service.get_meal(db, str(meal_id), current_user.id)


@router.put("/{meal_id}", response_model=MealResponse)
async def save_meal(
    meal_id: UUID,
    payload: MealPut,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    session_factory: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
    current_user: User = Depends(get_current_user),
):
    """Create or replace a meal from the client's full snapshot. Claude names
    and summarizes it in the background."""
    meal, job = await meal_service.save_meal(db, str(meal_id), current_user.id, data=payload)
    if job is not None:
        background.add_task(meal_summary.refresh, session_factory, job)
    return meal


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await meal_service.delete_meal(db, str(meal_id), current_user.id)
