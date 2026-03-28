from pydantic import BaseModel, Field


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    muscle_group: str = Field(min_length=1)
    equipment_type: str = Field(min_length=1)


class ExerciseResponse(BaseModel):
    id: str
    name: str
    muscle_group: str
    equipment_type: str

    class Config:
        from_attributes = True
