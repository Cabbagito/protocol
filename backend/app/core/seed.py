from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise

COMMON_EXERCISES = [
    # Chest
    {"name": "Barbell Bench Press", "muscle_groups": ["chest", "shoulders", "triceps"], "equipment_type": "barbell"},
    {"name": "Incline Barbell Press", "muscle_groups": ["chest", "shoulders", "triceps"], "equipment_type": "barbell"},
    {"name": "Dumbbell Bench Press", "muscle_groups": ["chest", "shoulders", "triceps"], "equipment_type": "dumbbell"},
    {"name": "Incline Dumbbell Press", "muscle_groups": ["chest", "shoulders", "triceps"], "equipment_type": "dumbbell"},
    {"name": "Cable Fly", "muscle_groups": ["chest"], "equipment_type": "cable"},
    {"name": "Pec Deck", "muscle_groups": ["chest"], "equipment_type": "machine"},
    {"name": "Push Up", "muscle_groups": ["chest", "shoulders", "triceps"], "equipment_type": "bodyweight"},
    {"name": "Dips", "muscle_groups": ["chest", "triceps", "shoulders"], "equipment_type": "bodyweight"},
    # Back
    {"name": "Barbell Row", "muscle_groups": ["back", "biceps"], "equipment_type": "barbell"},
    {"name": "Dumbbell Row", "muscle_groups": ["back", "biceps"], "equipment_type": "dumbbell"},
    {"name": "Pull Up", "muscle_groups": ["back", "biceps"], "equipment_type": "bodyweight"},
    {"name": "Chin Up", "muscle_groups": ["back", "biceps"], "equipment_type": "bodyweight"},
    {"name": "Lat Pulldown", "muscle_groups": ["back", "biceps"], "equipment_type": "cable"},
    {"name": "Seated Cable Row", "muscle_groups": ["back", "biceps"], "equipment_type": "cable"},
    {"name": "T-Bar Row", "muscle_groups": ["back", "biceps"], "equipment_type": "barbell"},
    {"name": "Deadlift", "muscle_groups": ["back", "hamstrings", "glutes"], "equipment_type": "barbell"},
    {"name": "Romanian Deadlift", "muscle_groups": ["hamstrings", "back", "glutes"], "equipment_type": "barbell"},
    # Shoulders
    {"name": "Overhead Press", "muscle_groups": ["shoulders", "triceps"], "equipment_type": "barbell"},
    {"name": "Dumbbell Shoulder Press", "muscle_groups": ["shoulders", "triceps"], "equipment_type": "dumbbell"},
    {"name": "Lateral Raise", "muscle_groups": ["shoulders"], "equipment_type": "dumbbell"},
    {"name": "Cable Lateral Raise", "muscle_groups": ["shoulders"], "equipment_type": "cable"},
    {"name": "Rear Delt Fly", "muscle_groups": ["shoulders", "back"], "equipment_type": "dumbbell"},
    {"name": "Face Pull", "muscle_groups": ["shoulders", "back"], "equipment_type": "cable"},
    {"name": "Upright Row", "muscle_groups": ["shoulders", "traps"], "equipment_type": "barbell"},
    # Arms
    {"name": "Barbell Curl", "muscle_groups": ["biceps"], "equipment_type": "barbell"},
    {"name": "Dumbbell Curl", "muscle_groups": ["biceps"], "equipment_type": "dumbbell"},
    {"name": "Hammer Curl", "muscle_groups": ["biceps", "forearms"], "equipment_type": "dumbbell"},
    {"name": "Preacher Curl", "muscle_groups": ["biceps"], "equipment_type": "machine"},
    {"name": "Cable Curl", "muscle_groups": ["biceps"], "equipment_type": "cable"},
    {"name": "Tricep Pushdown", "muscle_groups": ["triceps"], "equipment_type": "cable"},
    {"name": "Overhead Tricep Extension", "muscle_groups": ["triceps"], "equipment_type": "cable"},
    {"name": "Skull Crusher", "muscle_groups": ["triceps"], "equipment_type": "barbell"},
    {"name": "Close Grip Bench Press", "muscle_groups": ["triceps", "chest"], "equipment_type": "barbell"},
    # Legs
    {"name": "Barbell Squat", "muscle_groups": ["quads", "glutes", "hamstrings"], "equipment_type": "barbell"},
    {"name": "Front Squat", "muscle_groups": ["quads", "glutes"], "equipment_type": "barbell"},
    {"name": "Leg Press", "muscle_groups": ["quads", "glutes"], "equipment_type": "machine"},
    {"name": "Hack Squat", "muscle_groups": ["quads", "glutes"], "equipment_type": "machine"},
    {"name": "Bulgarian Split Squat", "muscle_groups": ["quads", "glutes"], "equipment_type": "dumbbell"},
    {"name": "Lunges", "muscle_groups": ["quads", "glutes"], "equipment_type": "dumbbell"},
    {"name": "Leg Extension", "muscle_groups": ["quads"], "equipment_type": "machine"},
    {"name": "Leg Curl", "muscle_groups": ["hamstrings"], "equipment_type": "machine"},
    {"name": "Calf Raise", "muscle_groups": ["calves"], "equipment_type": "machine"},
    {"name": "Seated Calf Raise", "muscle_groups": ["calves"], "equipment_type": "machine"},
    {"name": "Hip Thrust", "muscle_groups": ["glutes", "hamstrings"], "equipment_type": "barbell"},
    # Core
    {"name": "Plank", "muscle_groups": ["core"], "equipment_type": "bodyweight"},
    {"name": "Hanging Leg Raise", "muscle_groups": ["core"], "equipment_type": "bodyweight"},
    {"name": "Cable Crunch", "muscle_groups": ["core"], "equipment_type": "cable"},
    {"name": "Ab Wheel Rollout", "muscle_groups": ["core"], "equipment_type": "bodyweight"},
]


async def seed_exercises(session: AsyncSession) -> int:
    """Seed common exercises if they don't exist. Returns count of added exercises."""
    result = await session.execute(select(Exercise.name))
    existing_names = {row[0] for row in result.all()}

    added = 0
    for ex_data in COMMON_EXERCISES:
        if ex_data["name"] not in existing_names:
            exercise = Exercise(**ex_data)
            session.add(exercise)
            added += 1

    if added > 0:
        await session.commit()

    return added
