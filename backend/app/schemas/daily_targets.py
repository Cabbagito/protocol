from pydantic import BaseModel, ConfigDict, Field, computed_field


class DailyTargetsBase(BaseModel):
    protein_g: float = Field(gt=0)
    # Zero is a legitimate target for carbs (keto) or fat.
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class DailyTargetsUpdate(DailyTargetsBase):
    pass


class DailyTargetsResponse(DailyTargetsBase):
    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def kcal(self) -> float:
        return self.protein_g * 4 + self.carbs_g * 4 + self.fat_g * 9
