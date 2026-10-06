from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# The vocabularies used by the seeded exercises (app/core/seed_data/exercises.json).
MuscleGroup = Literal[
    "back",
    "biceps",
    "front delt",
    "rear delt",
    "side delt",
    "chest",
    "triceps",
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "abs",
    "traps",
    "forearms",
    "obliques",
]
EquipmentType = Literal["barbell", "dumbbell", "machine", "cable", "bodyweight"]


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    muscle_group: MuscleGroup
    equipment_type: EquipmentType


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    muscle_group: str
    equipment_type: str
    # None for built-in exercises; the owner's id for custom ones.
    user_id: str | None
