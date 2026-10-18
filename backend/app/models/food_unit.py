from sqlalchemy import Float, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, generate_uuid


class FoodUnit(Base, TimestampMixin):
    """A named amount of a food ("cookie" = 12 g, "cup" = 91 g).

    ``user_id`` NULL marks the food's own units (from the label, the seed data
    or whoever may edit the food), visible to everyone who sees the food. A
    user id marks a unit that user added for themselves, on any food they see.
    """

    __tablename__ = "food_units"
    __table_args__ = (
        # One unit per name (any case) per owner per food; NULL owners compare
        # equal, so a food's own units are unique too.
        Index(
            "uq_food_units_food_owner_name",
            "food_item_id",
            "user_id",
            text("lower(name)"),
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    food_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("food_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    grams: Mapped[float] = mapped_column(Float, nullable=False)
