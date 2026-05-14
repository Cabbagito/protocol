from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, generate_uuid


class Mesocycle(Base, TimestampMixin):
    __tablename__ = "mesocycles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    split_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("splits.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    started_at: Mapped[date] = mapped_column(Date, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    structure: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    split: Mapped["Split"] = relationship()


# Import to avoid circular import issues
from app.models.split import Split  # noqa: E402, F401
