from sqlalchemy import Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, generate_uuid


class ExercisePerformance(Base, TimestampMixin):
    __tablename__ = "exercise_performances"
    __table_args__ = (
        UniqueConstraint("user_id", "exercise_id", name="uq_exercise_performances_user_exercise"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False
    )
    working_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    working_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    num_sets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_increment: Mapped[float | None] = mapped_column(Float, nullable=True)
