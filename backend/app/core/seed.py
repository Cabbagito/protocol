import logging
from datetime import date, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle
from app.models.split import Split, SplitDay, SplitDayExercise
from app.models.user import User

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Exercise seed data — single muscle_group per exercise
# --------------------------------------------------------------------------
COMMON_EXERCISES = [
    # Chest
    {
        "seed_key": "barbell_bench_press",
        "name": "Barbell Bench Press",
        "muscle_group": "chest",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "incline_barbell_press",
        "name": "Incline Barbell Press",
        "muscle_group": "chest",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "decline_barbell_bench_press",
        "name": "Decline Barbell Bench Press",
        "muscle_group": "chest",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_bench_press",
        "name": "Dumbbell Bench Press",
        "muscle_group": "chest",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "incline_dumbbell_press",
        "name": "Incline Dumbbell Press",
        "muscle_group": "chest",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "dumbbell_flye",
        "name": "Dumbbell Flye",
        "muscle_group": "chest",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "incline_dumbbell_flye",
        "name": "Incline Dumbbell Flye",
        "muscle_group": "chest",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "dumbbell_press_flye",
        "name": "Dumbbell Press Flye",
        "muscle_group": "chest",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "cable_fly",
        "name": "Cable Fly",
        "muscle_group": "chest",
        "equipment_type": "cable",
    },
    {
        "seed_key": "pec_deck",
        "name": "Pec Deck",
        "muscle_group": "chest",
        "equipment_type": "machine",
    },
    {
        "seed_key": "push_up",
        "name": "Push Up",
        "muscle_group": "chest",
        "equipment_type": "bodyweight",
    },
    {"seed_key": "dips", "name": "Dips", "muscle_group": "chest", "equipment_type": "bodyweight"},
    # Back
    {
        "seed_key": "barbell_row",
        "name": "Barbell Row",
        "muscle_group": "back",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_row",
        "name": "Dumbbell Row",
        "muscle_group": "back",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "pull_up",
        "name": "Pull Up",
        "muscle_group": "back",
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "chin_up",
        "name": "Chin Up",
        "muscle_group": "back",
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "lat_pulldown",
        "name": "Lat Pulldown",
        "muscle_group": "back",
        "equipment_type": "cable",
    },
    {
        "seed_key": "seated_cable_row",
        "name": "Seated Cable Row",
        "muscle_group": "back",
        "equipment_type": "cable",
    },
    {
        "seed_key": "t_bar_row",
        "name": "T-Bar Row",
        "muscle_group": "back",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "deadlift",
        "name": "Deadlift",
        "muscle_group": "back",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "deficit_deadlift",
        "name": "Deficit Deadlift",
        "muscle_group": "back",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "lat_prayer",
        "name": "Lat Prayer",
        "muscle_group": "back",
        "equipment_type": "cable",
    },
    {
        "seed_key": "machine_chest_supported_row",
        "name": "Machine Chest Supported Row",
        "muscle_group": "back",
        "equipment_type": "machine",
    },
    {
        "seed_key": "parallel_grip_lat_pulldown",
        "name": "Parallel Grip Lat Pulldown",
        "muscle_group": "back",
        "equipment_type": "cable",
    },
    {
        "seed_key": "wide_grip_lat_pulldown",
        "name": "Wide Grip Lat Pulldown",
        "muscle_group": "back",
        "equipment_type": "cable",
    },
    {
        "seed_key": "romanian_deadlift",
        "name": "Romanian Deadlift",
        "muscle_group": "hamstrings",
        "equipment_type": "barbell",
    },
    # Shoulders — split into front delt, side delt, rear delt
    {
        "seed_key": "overhead_press",
        "name": "Overhead Press",
        "muscle_group": "front delt",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_shoulder_press",
        "name": "Dumbbell Shoulder Press",
        "muscle_group": "front delt",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "dumbbell_front_raise",
        "name": "Dumbbell Front Raise",
        "muscle_group": "front delt",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "lateral_raise",
        "name": "Dumbbell Lateral Raise",
        "muscle_group": "side delt",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "cable_lateral_raise",
        "name": "Cable Lateral Raise",
        "muscle_group": "side delt",
        "equipment_type": "cable",
    },
    {
        "seed_key": "cable_cross_body_lateral_raise",
        "name": "Cable Cross Body Lateral Raise",
        "muscle_group": "side delt",
        "equipment_type": "cable",
    },
    {
        "seed_key": "cable_leaning_lateral_raise",
        "name": "Cable Leaning Lateral Raise",
        "muscle_group": "side delt",
        "equipment_type": "cable",
    },
    {
        "seed_key": "upright_row",
        "name": "Upright Row",
        "muscle_group": "side delt",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "rear_delt_fly",
        "name": "Rear Delt Fly",
        "muscle_group": "rear delt",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "freemotion_rear_delt_fly",
        "name": "Freemotion Rear Delt Fly",
        "muscle_group": "rear delt",
        "equipment_type": "machine",
    },
    {
        "seed_key": "face_pull",
        "name": "Face Pull",
        "muscle_group": "rear delt",
        "equipment_type": "cable",
    },
    # Traps
    {
        "seed_key": "dumbbell_shrug",
        "name": "Dumbbell Shrug",
        "muscle_group": "traps",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "barbell_shrug",
        "name": "Barbell Shrug",
        "muscle_group": "traps",
        "equipment_type": "barbell",
    },
    # Biceps
    {
        "seed_key": "barbell_curl",
        "name": "Barbell Curl",
        "muscle_group": "biceps",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_curl",
        "name": "Dumbbell Curl",
        "muscle_group": "biceps",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "hammer_curl",
        "name": "Hammer Curl",
        "muscle_group": "biceps",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "preacher_curl",
        "name": "Machine Preacher Curl",
        "muscle_group": "biceps",
        "equipment_type": "machine",
    },
    {
        "seed_key": "cable_curl",
        "name": "Cable Curl",
        "muscle_group": "biceps",
        "equipment_type": "cable",
    },
    {
        "seed_key": "lying_dumbbell_curl",
        "name": "Lying Dumbbell Curl",
        "muscle_group": "biceps",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "incline_dumbbell_curl",
        "name": "Incline Dumbbell Curl",
        "muscle_group": "biceps",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "bayesian_curl",
        "name": "Bayesian Curl",
        "muscle_group": "biceps",
        "equipment_type": "cable",
    },
    {
        "seed_key": "ez_bar_preacher_curl",
        "name": "EZ Bar Preacher Curl",
        "muscle_group": "biceps",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "reverse_curl",
        "name": "Reverse Curl",
        "muscle_group": "forearms",
        "equipment_type": "barbell",
    },
    # Triceps
    {
        "seed_key": "tricep_pushdown",
        "name": "Cable Triceps Pushdown",
        "muscle_group": "triceps",
        "equipment_type": "cable",
    },
    {
        "seed_key": "overhead_tricep_extension",
        "name": "Cable Overhead Triceps Extension",
        "muscle_group": "triceps",
        "equipment_type": "cable",
    },
    {
        "seed_key": "single_arm_cable_pushdown",
        "name": "Single-Arm Cable Pushdown",
        "muscle_group": "triceps",
        "equipment_type": "cable",
    },
    {
        "seed_key": "skull_crusher",
        "name": "Barbell Skull Crusher",
        "muscle_group": "triceps",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "dumbbell_skull_crusher",
        "name": "Dumbbell Skull Crusher",
        "muscle_group": "triceps",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "close_grip_bench_press",
        "name": "Close Grip Bench Press",
        "muscle_group": "triceps",
        "equipment_type": "barbell",
    },
    # Forearms
    {
        "seed_key": "cable_wrist_curl",
        "name": "Cable Wrist Curl",
        "muscle_group": "forearms",
        "equipment_type": "cable",
    },
    {
        "seed_key": "barbell_wrist_curl",
        "name": "Barbell Wrist Curl",
        "muscle_group": "forearms",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "machine_forearm_curl",
        "name": "Machine Forearm Curl",
        "muscle_group": "forearms",
        "equipment_type": "machine",
    },
    # Legs — Quads
    {
        "seed_key": "barbell_squat",
        "name": "Barbell Squat",
        "muscle_group": "quads",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "front_squat",
        "name": "Front Squat",
        "muscle_group": "quads",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "leg_press",
        "name": "Leg Press",
        "muscle_group": "quads",
        "equipment_type": "machine",
    },
    {
        "seed_key": "hack_squat",
        "name": "Hack Squat",
        "muscle_group": "quads",
        "equipment_type": "machine",
    },
    {
        "seed_key": "bulgarian_split_squat",
        "name": "Bulgarian Split Squat",
        "muscle_group": "quads",
        "equipment_type": "dumbbell",
    },
    {"seed_key": "lunges", "name": "Lunges", "muscle_group": "quads", "equipment_type": "dumbbell"},
    {
        "seed_key": "leg_extension",
        "name": "Leg Extension",
        "muscle_group": "quads",
        "equipment_type": "machine",
    },
    # Legs — Hamstrings
    {
        "seed_key": "leg_curl",
        "name": "Lying Leg Curl",
        "muscle_group": "hamstrings",
        "equipment_type": "machine",
    },
    {
        "seed_key": "dumbbell_stiff_leg_deadlift",
        "name": "Dumbbell Stiff Legged Deadlift",
        "muscle_group": "hamstrings",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "seated_leg_curl",
        "name": "Seated Leg Curl",
        "muscle_group": "hamstrings",
        "equipment_type": "machine",
    },
    # Legs — Calves
    {
        "seed_key": "calf_raise",
        "name": "Standing Calf Raise",
        "muscle_group": "calves",
        "equipment_type": "machine",
    },
    {
        "seed_key": "seated_calf_raise",
        "name": "Seated Calf Raise",
        "muscle_group": "calves",
        "equipment_type": "machine",
    },
    # Legs — Glutes
    {
        "seed_key": "hip_thrust",
        "name": "Hip Thrust",
        "muscle_group": "glutes",
        "equipment_type": "barbell",
    },
    {
        "seed_key": "bulgarian_split_squat_glutes",
        "name": "Bulgarian Split Squat (Glutes)",
        "muscle_group": "glutes",
        "equipment_type": "dumbbell",
    },
    {
        "seed_key": "walking_lunges",
        "name": "Walking Lunges",
        "muscle_group": "glutes",
        "equipment_type": "barbell",
    },
    # Abs (was "core")
    {"seed_key": "plank", "name": "Plank", "muscle_group": "abs", "equipment_type": "bodyweight"},
    {
        "seed_key": "hanging_leg_raise",
        "name": "Hanging Leg Raise",
        "muscle_group": "abs",
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "cable_crunch",
        "name": "Cable Crunch",
        "muscle_group": "abs",
        "equipment_type": "cable",
    },
    {
        "seed_key": "slant_board_sit_up",
        "name": "Slant Board Sit-Up",
        "muscle_group": "abs",
        "equipment_type": "bodyweight",
    },
    {
        "seed_key": "ab_wheel_rollout",
        "name": "Ab Wheel Rollout",
        "muscle_group": "abs",
        "equipment_type": "bodyweight",
    },
]

# --------------------------------------------------------------------------
# Hero Split seed data (5-day program) — no rep ranges
# --------------------------------------------------------------------------
HERO_SPLIT = {
    "seed_key": "hero_split",
    "name": "Hero Split",
    "color": "#06b6d4",
    "days": [
        {
            "name": "Pull",
            "day_order": 0,
            "exercises": [
                {"seed_key": "lat_pulldown"},
                {"seed_key": "seated_cable_row"},
                {"seed_key": "preacher_curl"},
                {"seed_key": "freemotion_rear_delt_fly"},
                {"seed_key": "dumbbell_shrug"},
                {"seed_key": "cable_wrist_curl"},
            ],
        },
        {
            "name": "Push",
            "day_order": 1,
            "exercises": [
                {"seed_key": "incline_dumbbell_press"},
                {"seed_key": "dumbbell_bench_press"},
                {"seed_key": "dumbbell_skull_crusher"},
                {"seed_key": "overhead_tricep_extension"},
                {"seed_key": "lateral_raise"},
                {"seed_key": "dumbbell_front_raise"},
                {"seed_key": "tricep_pushdown"},
            ],
        },
        {
            "name": "Legs",
            "day_order": 2,
            "exercises": [
                {"seed_key": "leg_curl"},
                {"seed_key": "leg_press"},
                {"seed_key": "bulgarian_split_squat"},
                {"seed_key": "calf_raise"},
                {"seed_key": "lateral_raise"},
                {"seed_key": "tricep_pushdown"},
            ],
        },
        {
            "name": "Pull",
            "day_order": 3,
            "exercises": [
                {"seed_key": "lat_pulldown"},
                {"seed_key": "seated_cable_row"},
                {"seed_key": "lying_dumbbell_curl"},
                {"seed_key": "freemotion_rear_delt_fly"},
                {"seed_key": "cable_wrist_curl"},
                {"seed_key": "reverse_curl"},
            ],
        },
        {
            "name": "Push",
            "day_order": 4,
            "exercises": [
                {"seed_key": "incline_dumbbell_press"},
                {"seed_key": "dumbbell_flye"},
                {"seed_key": "tricep_pushdown"},
                {"seed_key": "overhead_tricep_extension"},
                {"seed_key": "lateral_raise"},
                {"seed_key": "preacher_curl"},
            ],
        },
    ],
}


PPL_3DAY = {
    "seed_key": "ppl_3day",
    "name": "Push/Pull/Legs",
    "color": "#8b5cf6",
    "days": [
        {
            "name": "Push",
            "day_order": 0,
            "exercises": [
                {"seed_key": "incline_dumbbell_press"},
                {"seed_key": "dumbbell_bench_press"},
                {"seed_key": "cable_fly"},
                {"seed_key": "dumbbell_shoulder_press"},
                {"seed_key": "lateral_raise"},
                {"seed_key": "tricep_pushdown"},
                {"seed_key": "overhead_tricep_extension"},
            ],
        },
        {
            "name": "Pull",
            "day_order": 1,
            "exercises": [
                {"seed_key": "lat_pulldown"},
                {"seed_key": "seated_cable_row"},
                {"seed_key": "machine_chest_supported_row"},
                {"seed_key": "face_pull"},
                {"seed_key": "preacher_curl"},
                {"seed_key": "bayesian_curl"},
                {"seed_key": "dumbbell_shrug"},
            ],
        },
        {
            "name": "Legs",
            "day_order": 2,
            "exercises": [
                {"seed_key": "leg_press"},
                {"seed_key": "hack_squat"},
                {"seed_key": "leg_extension"},
                {"seed_key": "leg_curl"},
                {"seed_key": "seated_leg_curl"},
                {"seed_key": "calf_raise"},
                {"seed_key": "hip_thrust"},
            ],
        },
    ],
}

UPPER_LOWER_4DAY = {
    "seed_key": "upper_lower_4day",
    "name": "Upper/Lower",
    "color": "#f59e0b",
    "days": [
        {
            "name": "Upper A",
            "day_order": 0,
            "exercises": [
                {"seed_key": "incline_dumbbell_press"},
                {"seed_key": "cable_fly"},
                {"seed_key": "lat_pulldown"},
                {"seed_key": "seated_cable_row"},
                {"seed_key": "lateral_raise"},
                {"seed_key": "preacher_curl"},
                {"seed_key": "tricep_pushdown"},
            ],
        },
        {
            "name": "Lower A",
            "day_order": 1,
            "exercises": [
                {"seed_key": "leg_press"},
                {"seed_key": "hack_squat"},
                {"seed_key": "leg_curl"},
                {"seed_key": "leg_extension"},
                {"seed_key": "calf_raise"},
                {"seed_key": "hip_thrust"},
            ],
        },
        {
            "name": "Upper B",
            "day_order": 2,
            "exercises": [
                {"seed_key": "dumbbell_bench_press"},
                {"seed_key": "pec_deck"},
                {"seed_key": "machine_chest_supported_row"},
                {"seed_key": "lat_prayer"},
                {"seed_key": "dumbbell_shoulder_press"},
                {"seed_key": "bayesian_curl"},
                {"seed_key": "overhead_tricep_extension"},
            ],
        },
        {
            "name": "Lower B",
            "day_order": 3,
            "exercises": [
                {"seed_key": "bulgarian_split_squat"},
                {"seed_key": "leg_press"},
                {"seed_key": "seated_leg_curl"},
                {"seed_key": "dumbbell_stiff_leg_deadlift"},
                {"seed_key": "leg_extension"},
                {"seed_key": "seated_calf_raise"},
            ],
        },
    ],
}

ARNOLD_6DAY = {
    "seed_key": "arnold_6day",
    "name": "Arnold Split",
    "color": "#ef4444",
    "days": [
        {
            "name": "Chest & Back 1",
            "day_order": 0,
            "exercises": [
                {"seed_key": "incline_dumbbell_press"},
                {"seed_key": "dumbbell_bench_press"},
                {"seed_key": "cable_fly"},
                {"seed_key": "lat_pulldown"},
                {"seed_key": "seated_cable_row"},
                {"seed_key": "dumbbell_row"},
            ],
        },
        {
            "name": "Shoulders & Arms 1",
            "day_order": 1,
            "exercises": [
                {"seed_key": "dumbbell_shoulder_press"},
                {"seed_key": "lateral_raise"},
                {"seed_key": "face_pull"},
                {"seed_key": "preacher_curl"},
                {"seed_key": "tricep_pushdown"},
                {"seed_key": "overhead_tricep_extension"},
            ],
        },
        {
            "name": "Legs 1",
            "day_order": 2,
            "exercises": [
                {"seed_key": "leg_press"},
                {"seed_key": "hack_squat"},
                {"seed_key": "leg_curl"},
                {"seed_key": "leg_extension"},
                {"seed_key": "calf_raise"},
                {"seed_key": "hip_thrust"},
            ],
        },
        {
            "name": "Chest & Back 2",
            "day_order": 3,
            "exercises": [
                {"seed_key": "dumbbell_press_flye"},
                {"seed_key": "incline_dumbbell_flye"},
                {"seed_key": "pec_deck"},
                {"seed_key": "machine_chest_supported_row"},
                {"seed_key": "lat_prayer"},
                {"seed_key": "parallel_grip_lat_pulldown"},
            ],
        },
        {
            "name": "Shoulders & Arms 2",
            "day_order": 4,
            "exercises": [
                {"seed_key": "dumbbell_shoulder_press"},
                {"seed_key": "cable_lateral_raise"},
                {"seed_key": "freemotion_rear_delt_fly"},
                {"seed_key": "incline_dumbbell_curl"},
                {"seed_key": "bayesian_curl"},
                {"seed_key": "dumbbell_skull_crusher"},
            ],
        },
        {
            "name": "Legs 2",
            "day_order": 5,
            "exercises": [
                {"seed_key": "bulgarian_split_squat"},
                {"seed_key": "leg_press"},
                {"seed_key": "seated_leg_curl"},
                {"seed_key": "dumbbell_stiff_leg_deadlift"},
                {"seed_key": "seated_calf_raise"},
                {"seed_key": "walking_lunges"},
            ],
        },
    ],
}

FULL_BODY_3DAY = {
    "seed_key": "full_body_3day",
    "name": "Full Body",
    "color": "#10b981",
    "days": [
        {
            "name": "Full Body A",
            "day_order": 0,
            "exercises": [
                {"seed_key": "incline_dumbbell_press"},
                {"seed_key": "lat_pulldown"},
                {"seed_key": "leg_press"},
                {"seed_key": "lateral_raise"},
                {"seed_key": "preacher_curl"},
                {"seed_key": "leg_curl"},
            ],
        },
        {
            "name": "Full Body B",
            "day_order": 1,
            "exercises": [
                {"seed_key": "dumbbell_bench_press"},
                {"seed_key": "seated_cable_row"},
                {"seed_key": "hack_squat"},
                {"seed_key": "face_pull"},
                {"seed_key": "tricep_pushdown"},
                {"seed_key": "calf_raise"},
            ],
        },
        {
            "name": "Full Body C",
            "day_order": 2,
            "exercises": [
                {"seed_key": "cable_fly"},
                {"seed_key": "machine_chest_supported_row"},
                {"seed_key": "bulgarian_split_squat"},
                {"seed_key": "dumbbell_shoulder_press"},
                {"seed_key": "bayesian_curl"},
                {"seed_key": "leg_extension"},
            ],
        },
    ],
}

DEFAULT_SPLITS = [HERO_SPLIT, PPL_3DAY, UPPER_LOWER_4DAY, ARNOLD_6DAY, FULL_BODY_3DAY]


def calculate_rir_scheme(total_weeks: int) -> list[int]:
    """Calculate RiR scheme based on total weeks."""
    if total_weeks <= 1:
        return [0]
    if total_weeks == 2:
        return [2, -1]
    if total_weeks == 3:
        return [3, 1, -1]
    if total_weeks == 4:
        return [3, 2, 1, -1]
    if total_weeks == 5:
        return [3, 2, 1, 0, -1]
    training_weeks = total_weeks - 1
    scheme = []
    for i in range(training_weeks):
        rir = max(0, 3 - int(i * 4 / training_weeks))
        scheme.append(rir)
    scheme.append(-1)
    return scheme


# Weight increment defaults by equipment type
WEIGHT_INCREMENTS = {
    "barbell": 2.5,
    "dumbbell": 2.0,
    "machine": 5.0,
    "cable": 2.5,
    "bodyweight": 0.0,
}


def build_mesocycle_structure(
    days: list[SplitDay],
    exercises_by_id: dict[str, Exercise],
    total_weeks: int,
    target_reps: int = 10,
    sets_per_exercise: int = 3,
) -> dict:
    """Build the full nested JSONB structure for a mesocycle."""
    rir_scheme = calculate_rir_scheme(total_weeks)

    weeks = []
    for week_idx in range(total_weeks):
        week_rir = rir_scheme[week_idx]
        week_sessions = []
        for day in days:
            exercise_entries = []
            for de in sorted(day.exercises, key=lambda x: x.order):
                ex = exercises_by_id.get(de.exercise_id)
                if not ex:
                    continue
                sets_list = []
                for set_num in range(1, sets_per_exercise + 1):
                    sets_list.append(
                        {
                            "set_num": set_num,
                            "weight": None,
                            "reps": None,
                            "target_reps": target_reps,
                            "suggested_weight": None,
                            "rir": None,
                            "logged": False,
                        }
                    )
                exercise_entries.append(
                    {
                        "exercise_id": ex.id,
                        "exercise_name": ex.name,
                        "muscle_group": ex.muscle_group,
                        "equipment_type": ex.equipment_type,
                        "sets": sets_list,
                    }
                )
            week_sessions.append(
                {
                    "session_name": day.name,
                    "day_order": day.day_order,
                    "date": None,
                    "notes": None,
                    "exercises": exercise_entries,
                }
            )

        weeks.append(
            {
                "week_number": week_idx + 1,
                "rir": week_rir,
                "sessions": week_sessions,
            }
        )

    return {"weeks": weeks}


def get_current_position(structure: dict) -> dict:
    """Find the current position in the mesocycle structure."""
    for wi, week in enumerate(structure.get("weeks", [])):
        for si, session in enumerate(week.get("sessions", [])):
            non_skipped = [
                ex for ex in session.get("exercises", []) if not ex.get("skipped", False)
            ]
            if not non_skipped:
                # All exercises skipped — session counts as complete
                continue
            all_logged = all(s["logged"] for ex in non_skipped for s in ex.get("sets", []))
            if not all_logged:
                return {"week_index": wi, "session_index": si, "completed": False}
    return {"completed": True}


def compute_progression(structure: dict) -> None:
    """Compute suggested weights for the next week based on previous week performance.

    Mutates the structure in place.
    """
    weeks = structure.get("weeks", [])
    for wi in range(1, len(weeks)):
        prev_week = weeks[wi - 1]
        curr_week = weeks[wi]
        for si, session in enumerate(curr_week.get("sessions", [])):
            # Find matching session in previous week by session_name + day_order
            prev_session = None
            for ps in prev_week.get("sessions", []):
                if (
                    ps["session_name"] == session["session_name"]
                    and ps["day_order"] == session["day_order"]
                ):
                    prev_session = ps
                    break
            if not prev_session:
                continue

            for ei, exercise in enumerate(session.get("exercises", [])):
                # Skip if current exercise is skipped
                if exercise.get("skipped", False):
                    continue

                # Find matching exercise in previous session
                prev_exercise = None
                for pe in prev_session.get("exercises", []):
                    if pe["exercise_id"] == exercise["exercise_id"]:
                        prev_exercise = pe
                        break
                if not prev_exercise:
                    continue

                # Skip if previous exercise was skipped
                if prev_exercise.get("skipped", False):
                    continue

                # Check if all sets in previous week were logged and hit target_reps
                prev_sets = prev_exercise.get("sets", [])
                logged_sets = [s for s in prev_sets if s.get("logged")]
                if not logged_sets:
                    continue

                last_weight = max(s.get("weight", 0) or 0 for s in logged_sets)
                if last_weight == 0:
                    continue

                all_hit_target = all(
                    (s.get("reps") or 0) >= s.get("target_reps", 10) for s in logged_sets
                )

                increment = WEIGHT_INCREMENTS.get(exercise.get("equipment_type", ""), 2.5)
                if all_hit_target and increment > 0:
                    suggested = last_weight + increment
                else:
                    suggested = last_weight

                for s in exercise.get("sets", []):
                    if not s.get("logged"):
                        s["suggested_weight"] = suggested


async def seed_exercises(session: AsyncSession) -> int:
    """Seed exercises using upsert-by-seed_key. Returns count of added/updated exercises."""
    result = await session.execute(select(Exercise))
    existing = result.scalars().all()
    by_seed_key = {e.seed_key: e for e in existing if e.seed_key}

    added = 0
    updated = 0

    for ex_data in COMMON_EXERCISES:
        sk = ex_data["seed_key"]
        name = ex_data["name"]
        muscle_group = ex_data["muscle_group"]
        equipment_type = ex_data["equipment_type"]

        if sk in by_seed_key:
            existing_ex = by_seed_key[sk]
            changed = False
            if existing_ex.name != name:
                existing_ex.name = name
                changed = True
            if existing_ex.muscle_group != muscle_group:
                existing_ex.muscle_group = muscle_group
                changed = True
            if existing_ex.equipment_type != equipment_type:
                existing_ex.equipment_type = equipment_type
                changed = True
            if changed:
                updated += 1
        else:
            exercise = Exercise(
                seed_key=sk,
                name=name,
                muscle_group=muscle_group,
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
    """Seed default splits (insert-only, never overwrites user edits)."""
    # Check which splits already exist
    result = await session.execute(
        select(Split.seed_key).where(Split.seed_key.isnot(None))
    )
    existing_keys = set(result.scalars().all())

    # Build exercise lookup by seed_key
    result = await session.execute(select(Exercise).where(Exercise.seed_key.isnot(None)))
    exercises_by_key = {e.seed_key: e for e in result.scalars().all()}

    added = 0
    for split_data in DEFAULT_SPLITS:
        if split_data["seed_key"] in existing_keys:
            continue

        color = split_data.get("color", "#06b6d4")
        split = Split(
            name=split_data["name"], seed_key=split_data["seed_key"], color=color
        )
        session.add(split)
        await session.flush()

        for day_data in split_data["days"]:
            day = SplitDay(
                split_id=split.id,
                name=day_data["name"],
                day_order=day_data["day_order"],
            )
            session.add(day)
            await session.flush()

            for order, ex_data in enumerate(day_data["exercises"]):
                exercise = exercises_by_key.get(ex_data["seed_key"])
                if not exercise:
                    logger.warning(
                        "Exercise with seed_key '%s' not found, skipping in day '%s'",
                        ex_data["seed_key"],
                        day_data["name"],
                    )
                    continue
                session.add(
                    SplitDayExercise(
                        day_id=day.id,
                        exercise_id=exercise.id,
                        order=order,
                    )
                )

        added += 1
        logger.info("Seeded default split: %s", split_data["name"])

    if added:
        await session.commit()
    return added


# Realistic weights per exercise seed_key (kg)
_DEMO_WEIGHTS: dict[str, float] = {
    "lat_pulldown": 60,
    "seated_cable_row": 55,
    "preacher_curl": 25,
    "freemotion_rear_delt_fly": 15,
    "dumbbell_shrug": 30,
    "cable_wrist_curl": 15,
    "incline_dumbbell_press": 28,
    "dumbbell_bench_press": 32,
    "dumbbell_skull_crusher": 12,
    "overhead_tricep_extension": 25,
    "lateral_raise": 10,
    "dumbbell_front_raise": 10,
    "tricep_pushdown": 30,
    "leg_curl": 45,
    "leg_press": 150,
    "bulgarian_split_squat": 20,
    "calf_raise": 80,
    "lying_dumbbell_curl": 12,
    "reverse_curl": 20,
    "dumbbell_flye": 16,
}


def _log_session(
    meso_session: dict,
    exercises_by_id: dict,
    session_date: str,
    rir: int,
    *,
    use_suggested: bool = False,
) -> None:
    """Fill a mesocycle session with realistic logged data.

    If use_suggested is True, uses the suggested_weight (set by compute_progression)
    rather than the demo weights table.
    """
    meso_session["date"] = session_date
    for exercise in meso_session["exercises"]:
        ex_obj = exercises_by_id.get(exercise["exercise_id"])
        seed_key = ex_obj.seed_key if ex_obj else None
        base_weight = _DEMO_WEIGHTS.get(seed_key, 20)
        for s in exercise["sets"]:
            if use_suggested and s.get("suggested_weight"):
                weight = s["suggested_weight"]
            else:
                weight = base_weight
            s["weight"] = weight
            s["reps"] = 10
            s["rir"] = rir
            s["logged"] = True


async def seed_demo_mesocycle(session: AsyncSession) -> None:
    """Seed a demo mesocycle with weeks 1-2 fully logged and week 3 partially logged."""
    # Look up the Hero Split
    result = await session.execute(select(Split).where(Split.seed_key == HERO_SPLIT["seed_key"]))
    split = result.scalar_one_or_none()
    if not split:
        logger.warning("Hero Split not found, skipping demo mesocycle seed")
        return

    # Load days with their exercises eager-loaded
    result = await session.execute(
        select(SplitDay)
        .where(SplitDay.split_id == split.id)
        .options(selectinload(SplitDay.exercises))
        .order_by(SplitDay.day_order)
    )
    days = result.scalars().all()

    # Load exercise lookup
    result = await session.execute(select(Exercise).where(Exercise.seed_key.isnot(None)))
    exercises_by_id = {e.id: e for e in result.scalars().all()}

    # Build the structure
    total_weeks = 4
    structure = build_mesocycle_structure(days, exercises_by_id, total_weeks)

    # --- Week 1: all 5 sessions logged (RiR 3) ---
    start_date = date.today() - timedelta(days=16)
    week1 = structure["weeks"][0]
    for day_idx, meso_session in enumerate(week1["sessions"]):
        day = (start_date + timedelta(days=day_idx)).isoformat()
        _log_session(meso_session, exercises_by_id, day, rir=3)

    # Compute progression so week 2 gets suggested weights
    compute_progression(structure)

    # --- Week 2: all 5 sessions logged (RiR 2), using suggested weights ---
    week2_start = date.today() - timedelta(days=9)
    week2 = structure["weeks"][1]
    for day_idx, meso_session in enumerate(week2["sessions"]):
        day = (week2_start + timedelta(days=day_idx)).isoformat()
        _log_session(meso_session, exercises_by_id, day, rir=2, use_suggested=True)

    # Compute progression so week 3 gets suggested weights
    compute_progression(structure)

    # --- Week 3: first 2 sessions logged (Pull, Push), Legs is next ---
    week3_start = date.today() - timedelta(days=2)
    week3 = structure["weeks"][2]
    for day_idx in range(2):  # only first 2 sessions
        meso_session = week3["sessions"][day_idx]
        day = (week3_start + timedelta(days=day_idx)).isoformat()
        _log_session(meso_session, exercises_by_id, day, rir=1, use_suggested=True)

    meso = Mesocycle(
        split_id=split.id,
        name="Demo Mesocycle",
        started_at=start_date,
        is_active=True,
        structure=structure,
    )
    session.add(meso)
    await session.commit()
    logger.info("Seeded demo mesocycle '%s' with weeks 1-2 + partial week 3 logged", meso.name)


async def ensure_admin_user(session: AsyncSession) -> None:
    """Bootstrap the admin user on first run.

    If no users exist and APP_PASSWORD is set, creates an admin user and
    assigns any orphan non-seed data to them. Seed data (seed_key IS NOT NULL)
    keeps user_id = NULL so it remains shared.
    """
    from app.core.config import settings
    from app.core.security import hash_password

    result = await session.execute(select(User).limit(1))
    if result.scalar_one_or_none() is not None:
        return  # Users already exist

    if not settings.app_password:
        return

    admin = User(
        name=settings.admin_name,
        password_hash=hash_password(settings.app_password),
        is_admin=True,
    )
    session.add(admin)
    await session.flush()

    # Assign orphan non-seed exercises to admin
    await session.execute(
        update(Exercise)
        .where(Exercise.seed_key.is_(None), Exercise.user_id.is_(None))
        .values(user_id=admin.id)
    )

    # Assign orphan non-seed splits to admin
    await session.execute(
        update(Split)
        .where(Split.seed_key.is_(None), Split.user_id.is_(None))
        .values(user_id=admin.id)
    )

    # Assign all orphan mesocycles to admin (mesocycles don't have seed_key)
    await session.execute(
        update(Mesocycle).where(Mesocycle.user_id.is_(None)).values(user_id=admin.id)
    )

    await session.commit()
    logger.info("Created admin user '%s' and assigned orphan data", admin.name)
