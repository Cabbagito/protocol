from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, generate_uuid


class FoodLog(Base, TimestampMixin):
    __tablename__ = "food_logs"
    __table_args__ = (
        Index("ix_food_logs_user_date", "user_id", "logged_on"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    logged_on: Mapped[date] = mapped_column(Date, nullable=False)
    food_item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("food_items.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    kcal: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False)
