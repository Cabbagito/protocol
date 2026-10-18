from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    field_validator,
)

UnitName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]

# Grams are always available, so a unit may not be called that.
_GRAM_NAMES = {"g", "gram", "grams"}


class FoodUnitCreate(BaseModel):
    name: UnitName
    grams: float = Field(gt=0, le=100_000)

    @field_validator("name")
    @classmethod
    def _not_grams(cls, name: str) -> str:
        if name.lower() in _GRAM_NAMES:
            raise ValueError("grams are always available")
        return name


class FoodUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    grams: float
    # None: the food's own unit; a user id: that user's personal unit.
    user_id: str | None


class FoodItemUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    kcal_per_100g: float = Field(ge=0)
    protein_per_100g: float = Field(ge=0)
    carbs_per_100g: float = Field(ge=0)
    fat_per_100g: float = Field(ge=0)
    # The food's own units; an update replaces them. Personal units are
    # managed under /foods/{id}/units.
    units: list[FoodUnitCreate] = Field(default_factory=list, max_length=20)

    @field_validator("units")
    @classmethod
    def _unique_unit_names(cls, units: list[FoodUnitCreate]) -> list[FoodUnitCreate]:
        names = [u.name.lower() for u in units]
        if len(names) != len(set(names)):
            raise ValueError("unit names must be unique")
        return units


class FoodItemCreate(FoodItemUpdate):
    barcode: str | None = Field(default=None, min_length=8, max_length=32, pattern=r"^\d+$")


class LastUsed(BaseModel):
    """How much of a food the user logged the last time."""

    unit_name: str | None
    unit_quantity: float | None
    quantity_g: float | None


class FoodItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    brand: str | None
    kcal_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    barcode: str | None
    # Owner of a custom food; None for seeded and barcode (shared) foods.
    user_id: str | None
    seed_key: str | None = Field(exclude=True)
    units: list[FoodUnitResponse] = Field(default_factory=list)
    last_used: LastUsed | None = None

    @computed_field
    @property
    def seeded(self) -> bool:
        return self.seed_key is not None

    @computed_field
    @property
    def editable(self) -> bool:
        # Seeded foods are read-only. Everything else a user can see is
        # theirs or a shared barcode product, which anyone may correct.
        return self.seed_key is None


class FoodDraft(BaseModel):
    """A product that isn't in the database yet, as far as it is known."""

    barcode: str | None = None
    name: str | None = None
    brand: str | None = None
    kcal_per_100g: float | None = None
    protein_per_100g: float | None = None
    carbs_per_100g: float | None = None
    fat_per_100g: float | None = None
    units: list[FoodUnitCreate] = Field(default_factory=list)


class BarcodeLookupResponse(BaseModel):
    status: Literal["found", "draft"]
    food: FoodItemResponse | None = None
    draft: FoodDraft | None = None


class LabelImage(BaseModel):
    media_type: Literal["image/jpeg", "image/png", "image/webp"]
    # Base64, without a data: prefix. About 2 MB of image at most.
    data: str = Field(min_length=1, max_length=2_800_000)


class ReadLabelRequest(BaseModel):
    images: list[LabelImage] = Field(min_length=1, max_length=4)
