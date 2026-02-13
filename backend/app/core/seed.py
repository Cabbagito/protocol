import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
from app.models.split import Session, SessionExercise, Split

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Exercise seed data (seed_key is the stable identifier, never changes)
# --------------------------------------------------------------------------
COMMON_EXERCISES = [
    # Chest
    {
        "seed_key": "barbell_bench_press",
        "name": "Barbell Bench Press",
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "incline_barbell_press",
        "name": "Incline Barbell Press",
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "decline_barbell_bench_press",
        "name": "Decline Barbell Bench Press",
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_bench_press",
        "name": "Dumbbell Bench Press",
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "incline_dumbbell_press",
        "name": "Incline Dumbbell Press",
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "dumbbell_flye",
        "name": "Dumbbell Flye",
        "muscle_groups": ["chest"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "cable_fly",
        "name": "Cable Fly",
        "muscle_groups": ["chest"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "pec_deck",
        "name": "Pec Deck",
        "muscle_groups": ["chest"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "push_up",
        "name": "Push Up",
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "dips",
        "name": "Dips",
        "muscle_groups": ["chest", "triceps", "shoulders"],
        "equipment_type": "bodyweight",
    },
    # Back
    {
        "seed_key": "barbell_row",
        "name": "Barbell Row",
        "muscle_groups": ["back", "biceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_row",
        "name": "Dumbbell Row",
        "muscle_groups": ["back", "biceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "pull_up",
        "name": "Pull Up",
        "muscle_groups": ["back", "biceps"],
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "chin_up",
        "name": "Chin Up",
        "muscle_groups": ["back", "biceps"],
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "lat_pulldown",
        "name": "Lat Pulldown",
        "muscle_groups": ["back", "biceps"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "seated_cable_row",
        "name": "Seated Cable Row",
        "muscle_groups": ["back", "biceps"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "t_bar_row",
        "name": "T-Bar Row",
        "muscle_groups": ["back", "biceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "deadlift",
        "name": "Deadlift",
        "muscle_groups": ["back", "hamstrings", "glutes"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "romanian_deadlift",
        "name": "Romanian Deadlift",
        "muscle_groups": ["hamstrings", "back", "glutes"],
        "equipment_type": "barbell",
    },
    # Shoulders
    {
        "seed_key": "overhead_press",
        "name": "Overhead Press",
        "muscle_groups": ["shoulders", "triceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_shoulder_press",
        "name": "Dumbbell Shoulder Press",
        "muscle_groups": ["shoulders", "triceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "lateral_raise",
        "name": "Dumbbell Lateral Raise",
        "muscle_groups": ["shoulders"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "cable_lateral_raise",
        "name": "Cable Lateral Raise",
        "muscle_groups": ["shoulders"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "rear_delt_fly",
        "name": "Rear Delt Fly",
        "muscle_groups": ["shoulders", "back"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "freemotion_rear_delt_fly",
        "name": "Freemotion Rear Delt Fly",
        "muscle_groups": ["shoulders", "back"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "dumbbell_front_raise",
        "name": "Dumbbell Front Raise",
        "muscle_groups": ["shoulders"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "face_pull",
        "name": "Face Pull",
        "muscle_groups": ["shoulders", "back"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "upright_row",
        "name": "Upright Row",
        "muscle_groups": ["shoulders", "traps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_shrug",
        "name": "Dumbbell Shrug",
        "muscle_groups": ["traps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "barbell_shrug",
        "name": "Barbell Shrug",
        "muscle_groups": ["traps"],
        "equipment_type": "barbell",
    },
    # Arms - Biceps
    {
        "seed_key": "barbell_curl",
        "name": "Barbell Curl",
        "muscle_groups": ["biceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_curl",
        "name": "Dumbbell Curl",
        "muscle_groups": ["biceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "hammer_curl",
        "name": "Hammer Curl",
        "muscle_groups": ["biceps", "forearms"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "preacher_curl",
        "name": "Machine Preacher Curl",
        "muscle_groups": ["biceps"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "cable_curl",
        "name": "Cable Curl",
        "muscle_groups": ["biceps"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "lying_dumbbell_curl",
        "name": "Lying Dumbbell Curl",
        "muscle_groups": ["biceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "incline_dumbbell_curl",
        "name": "Incline Dumbbell Curl",
        "muscle_groups": ["biceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "reverse_curl",
        "name": "Reverse Curl",
        "muscle_groups": ["forearms", "biceps"],
        "equipment_type": "barbell",
    },
    # Arms - Triceps
    {
        "seed_key": "tricep_pushdown",
        "name": "Cable Triceps Pushdown",
        "muscle_groups": ["triceps"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "overhead_tricep_extension",
        "name": "Cable Overhead Triceps Extension",
        "muscle_groups": ["triceps"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "skull_crusher",
        "name": "Barbell Skull Crusher",
        "muscle_groups": ["triceps"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_skull_crusher",
        "name": "Dumbbell Skull Crusher",
        "muscle_groups": ["triceps"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "close_grip_bench_press",
        "name": "Close Grip Bench Press",
        "muscle_groups": ["triceps", "chest"],
        "equipment_type": "barbell",
    },
    # Arms - Forearms
    {
        "seed_key": "cable_wrist_curl",
        "name": "Cable Wrist Curl",
        "muscle_groups": ["forearms"],
        "equipment_type": "cable",
    },
    # Legs
    {
        "seed_key": "barbell_squat",
        "name": "Barbell Squat",
        "muscle_groups": ["quads", "glutes", "hamstrings"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "front_squat",
        "name": "Front Squat",
        "muscle_groups": ["quads", "glutes"],
        "equipment_type": "barbell",
    },
    {
        "seed_key": "leg_press",
        "name": "Leg Press",
        "muscle_groups": ["quads", "glutes"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "hack_squat",
        "name": "Hack Squat",
        "muscle_groups": ["quads", "glutes"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "bulgarian_split_squat",
        "name": "Bulgarian Split Squat",
        "muscle_groups": ["quads", "glutes"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "lunges",
        "name": "Lunges",
        "muscle_groups": ["quads", "glutes"],
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "leg_extension",
        "name": "Leg Extension",
        "muscle_groups": ["quads"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "leg_curl",
        "name": "Lying Leg Curl",
        "muscle_groups": ["hamstrings"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "seated_leg_curl",
        "name": "Seated Leg Curl",
        "muscle_groups": ["hamstrings"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "calf_raise",
        "name": "Standing Calf Raise",
        "muscle_groups": ["calves"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "seated_calf_raise",
        "name": "Seated Calf Raise",
        "muscle_groups": ["calves"],
        "equipment_type": "machine",
    },
    {
        "seed_key": "hip_thrust",
        "name": "Hip Thrust",
        "muscle_groups": ["glutes", "hamstrings"],
        "equipment_type": "barbell",
    },
    # Core
    {
        "seed_key": "plank",
        "name": "Plank",
        "muscle_groups": ["core"],
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "hanging_leg_raise",
        "name": "Hanging Leg Raise",
        "muscle_groups": ["core"],
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "cable_crunch",
        "name": "Cable Crunch",
        "muscle_groups": ["core"],
        "equipment_type": "cable",
    },
    {
        "seed_key": "ab_wheel_rollout",
        "name": "Ab Wheel Rollout",
        "muscle_groups": ["core"],
        "equipment_type": "bodyweight",
    },
]

# One-time migration map: old exercise names -> seed_key
# Used only on first run to assign seed_keys to existing rows.
OLD_NAME_MAP = {
    "Barbell Bench Press": "barbell_bench_press",
    "Incline Barbell Press": "incline_barbell_press",
    "Dumbbell Bench Press": "dumbbell_bench_press",
    "Incline Dumbbell Press": "incline_dumbbell_press",
    "Cable Fly": "cable_fly",
    "Pec Deck": "pec_deck",
    "Push Up": "push_up",
    "Dips": "dips",
    "Barbell Row": "barbell_row",
    "Dumbbell Row": "dumbbell_row",
    "Pull Up": "pull_up",
    "Chin Up": "chin_up",
    "Lat Pulldown": "lat_pulldown",
    "Seated Cable Row": "seated_cable_row",
    "T-Bar Row": "t_bar_row",
    "Deadlift": "deadlift",
    "Romanian Deadlift": "romanian_deadlift",
    "Overhead Press": "overhead_press",
    "Dumbbell Shoulder Press": "dumbbell_shoulder_press",
    "Lateral Raise": "lateral_raise",
    "Cable Lateral Raise": "cable_lateral_raise",
    "Rear Delt Fly": "rear_delt_fly",
    "Face Pull": "face_pull",
    "Upright Row": "upright_row",
    "Barbell Curl": "barbell_curl",
    "Dumbbell Curl": "dumbbell_curl",
    "Hammer Curl": "hammer_curl",
    "Preacher Curl": "preacher_curl",
    "Cable Curl": "cable_curl",
    "Tricep Pushdown": "tricep_pushdown",
    "Overhead Tricep Extension": "overhead_tricep_extension",
    "Skull Crusher": "skull_crusher",
    "Close Grip Bench Press": "close_grip_bench_press",
    "Barbell Squat": "barbell_squat",
    "Front Squat": "front_squat",
    "Leg Press": "leg_press",
    "Hack Squat": "hack_squat",
    "Bulgarian Split Squat": "bulgarian_split_squat",
    "Lunges": "lunges",
    "Leg Extension": "leg_extension",
    "Leg Curl": "leg_curl",
    "Calf Raise": "calf_raise",
    "Seated Calf Raise": "seated_calf_raise",
    "Hip Thrust": "hip_thrust",
    "Plank": "plank",
    "Hanging Leg Raise": "hanging_leg_raise",
    "Cable Crunch": "cable_crunch",
    "Ab Wheel Rollout": "ab_wheel_rollout",
}

# --------------------------------------------------------------------------
# Hero Split seed data (5-day program)
# Each session lists exercises by seed_key with sets/rep config
# --------------------------------------------------------------------------
HERO_SPLIT = {
    "seed_key": "hero_split",
    "name": "Hero Split",
    "sessions": [
        {
            "name": "Back / Biceps / Shoulders / Forearms",
            "day_order": 0,
            "exercises": [
                {"seed_key": "lat_pulldown", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "seated_cable_row", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "preacher_curl", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "freemotion_rear_delt_fly", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "dumbbell_shrug", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "cable_wrist_curl", "sets": 3, "rep_min": 8, "rep_max": 12},
            ],
        },
        {
            "name": "Chest / Triceps / Shoulders",
            "day_order": 1,
            "exercises": [
                {"seed_key": "incline_dumbbell_press", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "dumbbell_bench_press", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "dumbbell_skull_crusher", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "overhead_tricep_extension", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "lateral_raise", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "dumbbell_front_raise", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "tricep_pushdown", "sets": 3, "rep_min": 8, "rep_max": 12},
            ],
        },
        {
            "name": "Legs / Shoulders / Triceps",
            "day_order": 2,
            "exercises": [
                {"seed_key": "leg_curl", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "leg_press", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "bulgarian_split_squat", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "calf_raise", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "lateral_raise", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "tricep_pushdown", "sets": 3, "rep_min": 8, "rep_max": 12},
            ],
        },
        {
            "name": "Back / Biceps / Shoulders / Forearms",
            "day_order": 3,
            "exercises": [
                {"seed_key": "lat_pulldown", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "seated_cable_row", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "lying_dumbbell_curl", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "freemotion_rear_delt_fly", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "cable_wrist_curl", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "reverse_curl", "sets": 3, "rep_min": 8, "rep_max": 12},
            ],
        },
        {
            "name": "Chest / Triceps / Shoulders / Biceps",
            "day_order": 4,
            "exercises": [
                {"seed_key": "incline_dumbbell_press", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "dumbbell_flye", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "tricep_pushdown", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "overhead_tricep_extension", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "lateral_raise", "sets": 3, "rep_min": 8, "rep_max": 12},
                {"seed_key": "preacher_curl", "sets": 3, "rep_min": 8, "rep_max": 12},
            ],
        },
    ],
}


async def seed_exercises(session: AsyncSession) -> int:
    """Seed exercises using upsert-by-seed_key. Returns count of added/updated exercises."""
    # Build lookup of existing exercises by seed_key and by name
    result = await session.execute(select(Exercise))
    existing = result.scalars().all()
    by_seed_key = {e.seed_key: e for e in existing if e.seed_key}
    by_name = {e.name: e for e in existing if not e.seed_key}

    added = 0
    updated = 0

    for ex_data in COMMON_EXERCISES:
        sk = ex_data["seed_key"]
        name = ex_data["name"]
        muscle_groups = ex_data["muscle_groups"]
        equipment_type = ex_data["equipment_type"]

        if sk in by_seed_key:
            # Already has seed_key — update fields if changed
            existing_ex = by_seed_key[sk]
            changed = False
            if existing_ex.name != name:
                existing_ex.name = name
                changed = True
            if existing_ex.muscle_groups != muscle_groups:
                existing_ex.muscle_groups = muscle_groups
                changed = True
            if existing_ex.equipment_type != equipment_type:
                existing_ex.equipment_type = equipment_type
                changed = True
            if changed:
                updated += 1
        else:
            # No seed_key match — check OLD_NAME_MAP for one-time migration
            old_name = None
            for oname, okey in OLD_NAME_MAP.items():
                if okey == sk:
                    old_name = oname
                    break

            if old_name and old_name in by_name:
                # Migrate existing row: assign seed_key and update fields
                existing_ex = by_name.pop(old_name)
                existing_ex.seed_key = sk
                existing_ex.name = name
                existing_ex.muscle_groups = muscle_groups
                existing_ex.equipment_type = equipment_type
                updated += 1
            else:
                # Brand new exercise
                exercise = Exercise(
                    seed_key=sk,
                    name=name,
                    muscle_groups=muscle_groups,
                    equipment_type=equipment_type,
                )
                session.add(exercise)
                added += 1

    if added > 0 or updated > 0:
        await session.commit()
        if added:
            logger.info("Seeded %d new exercises", added)
        if updated:
            logger.info("Updated %d existing exercises", updated)

    return added + updated


async def seed_default_splits(session: AsyncSession) -> int:
    """Seed default splits (insert-only, never overwrites user edits).

    Returns count of added splits.
    """
    # Check if Hero Split already exists
    result = await session.execute(select(Split).where(Split.seed_key == HERO_SPLIT["seed_key"]))
    if result.scalar_one_or_none():
        return 0

    # Build exercise lookup by seed_key
    result = await session.execute(select(Exercise).where(Exercise.seed_key.isnot(None)))
    exercises_by_key = {e.seed_key: e for e in result.scalars().all()}

    # Create the split
    split = Split(name=HERO_SPLIT["name"], seed_key=HERO_SPLIT["seed_key"])
    session.add(split)
    await session.flush()  # Get split.id

    for sess_data in HERO_SPLIT["sessions"]:
        sess = Session(
            split_id=split.id,
            name=sess_data["name"],
            day_order=sess_data["day_order"],
        )
        session.add(sess)
        await session.flush()  # Get sess.id

        for order, ex_data in enumerate(sess_data["exercises"]):
            exercise = exercises_by_key.get(ex_data["seed_key"])
            if not exercise:
                logger.warning(
                    "Exercise with seed_key '%s' not found, skipping in session '%s'",
                    ex_data["seed_key"],
                    sess_data["name"],
                )
                continue
            session.add(
                SessionExercise(
                    session_id=sess.id,
                    exercise_id=exercise.id,
                    order=order,
                    sets=ex_data["sets"],
                    rep_min=ex_data["rep_min"],
                    rep_max=ex_data["rep_max"],
                )
            )

    await session.commit()
    logger.info("Seeded default split: %s", HERO_SPLIT["name"])
    return 1
