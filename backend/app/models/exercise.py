
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, generate_uuid


class Exercise(Base, TimestampMixin):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    muscle_groups: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    equipment_type: Mapped[str] = mapped_column(String(50), nullable=False)
    seed_key: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
