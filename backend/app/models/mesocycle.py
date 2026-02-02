from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid


class Mesocycle(Base, TimestampMixin):
    __tablename__ = "mesocycles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    split_id: Mapped[str] = mapped_column(String(36), ForeignKey("splits.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_weeks: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    rir_scheme: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    current_week: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    started_at: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    split: Mapped["Split"] = relationship()
    workout_logs: Mapped[list["WorkoutLog"]] = relationship(
        back_populates="mesocycle",
        cascade="all, delete-orphan",
        order_by="WorkoutLog.date.desc()",
    )


class WorkoutLog(Base, TimestampMixin):
    __tablename__ = "workout_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    mesocycle_id: Mapped[str] = mapped_column(String(36), ForeignKey("mesocycles.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sets: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    # sets format: [{exercise_id, set_num, weight, reps, rir, completed}]

    mesocycle: Mapped["Mesocycle"] = relationship(back_populates="workout_logs")
    session: Mapped[Optional["Session"]] = relationship()


# Import to avoid circular import issues
from app.models.split import Split, Session  # noqa: E402, F401
