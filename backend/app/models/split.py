from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid


class Split(Base, TimestampMixin):
    __tablename__ = "splits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    seed_key: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    days: Mapped[list["SplitDay"]] = relationship(
        back_populates="split",
        cascade="all, delete-orphan",
        order_by="SplitDay.day_order",
    )


class SplitDay(Base, TimestampMixin):
    __tablename__ = "split_days"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    split_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("splits.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    day_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    split: Mapped["Split"] = relationship(back_populates="days")
    exercises: Mapped[list["SplitDayExercise"]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        order_by="SplitDayExercise.order",
    )


class SplitDayExercise(Base, TimestampMixin):
    __tablename__ = "split_day_exercises"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    day_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("split_days.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    day: Mapped["SplitDay"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship()


from app.models.exercise import Exercise  # noqa: E402, F401
