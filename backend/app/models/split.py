
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid


class Split(Base, TimestampMixin):
    __tablename__ = "splits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    seed_key: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)

    sessions: Mapped[list["Session"]] = relationship(
        back_populates="split",
        cascade="all, delete-orphan",
        order_by="Session.day_order",
    )


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    split_id: Mapped[str] = mapped_column(String(36), ForeignKey("splits.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    day_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_rest_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    split: Mapped["Split"] = relationship(back_populates="sessions")
    exercises: Mapped[list["SessionExercise"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionExercise.order",
    )


class SessionExercise(Base, TimestampMixin):
    __tablename__ = "session_exercises"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    exercise_id: Mapped[str] = mapped_column(String(36), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sets: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    session: Mapped["Session"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship()


from app.models.exercise import Exercise  # noqa: E402, F401
