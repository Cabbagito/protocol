from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid


class Mesocycle(Base, TimestampMixin):
    __tablename__ = "mesocycles"
    __table_args__ = (
        # At most one active mesocycle per user.
        Index(
            "uq_mesocycles_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    # The structure is self-contained, so a mesocycle outlives its split.
    split_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("splits.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    started_at: Mapped[date] = mapped_column(Date, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    structure: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    split: Mapped["Split | None"] = relationship()


# Import to avoid circular import issues
from app.models.split import Split  # noqa: E402, F401
