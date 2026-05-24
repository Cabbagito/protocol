from pydantic import BaseModel, Field, computed_field


class DailyTargetsBase(BaseModel):
    protein_g: float = Field(gt=0)
    carbs_g: float = Field(gt=0)
    fat_g: float = Field(gt=0)


class DailyTargetsUpdate(DailyTargetsBase):
    pass


class DailyTargetsResponse(DailyTargetsBase):
    @computed_field  # type: ignore[prop-decorator]
    @property
    def kcal(self) -> float:
        return self.protein_g * 4 + self.carbs_g * 4 + self.fat_g * 9

    class Config:
        from_attributes = True
