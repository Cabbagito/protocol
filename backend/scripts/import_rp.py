"""Import RP Strength training data into Protocol.

Usage:
    uv run python -m scripts.import_rp \
        --data-file rp_training_data.json --user-name "Admin"
    uv run python -m scripts.import_rp \
        --data-file rp_training_data.json --user-name "Admin" --dry-run

Docker:
    docker compose exec backend uv run python -m scripts.import_rp \
        --data-file /app/rp_training_data.json --user-name "Admin"
"""

import argparse
import asyncio
import json
import sys
from collections import defaultdict
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models.exercise import Exercise
from app.models.mesocycle import Mesocycle
from app.models.split import Session, SessionExercise, Split
from app.models.user import User

# ---------------------------------------------------------------------------
# Exercise mapping: RP exercise name -> Protocol seed_key
# ---------------------------------------------------------------------------
RP_TO_SEED_KEY: dict[str, str] = {
    # Direct name matches to existing seed exercises
    "Barbell Bent Over Row": "barbell_row",
    "Barbell Curl (Normal Grip)": "barbell_curl",
    "Cable Overhead Triceps Extension": "overhead_tricep_extension",
    "Cable Rope Crunch": "cable_crunch",
    "Cable Rope Facepull": "face_pull",
    "Cable Triceps Pushdown (Bar)": "tricep_pushdown",
    "Cable Wrist Curl": "cable_wrist_curl",
    "Calf Machine": "seated_calf_raise",
    "Dumbbell Curl (Incline)": "incline_dumbbell_curl",
    "Dumbbell Flye (Flat)": "dumbbell_flye",
    "Dumbbell Front Raise": "dumbbell_front_raise",
    "Dumbbell Lateral Raise": "lateral_raise",
    "Dumbbell Press (Flat)": "dumbbell_bench_press",
    "Dumbbell Press (Medium Incline)": "incline_dumbbell_press",
    "Dumbbell Shrug": "dumbbell_shrug",
    "Dumbbell Skullcrusher": "dumbbell_skull_crusher",
    "Freemotion Rear Delt Flyes": "freemotion_rear_delt_fly",
    "Leg Extension": "leg_extension",
    "Leg Press": "leg_press",
    "Lying Biceps Dumbbell Curl": "lying_dumbbell_curl",
    "Lying Leg Curl": "leg_curl",
    "Machine Preacher Curl": "preacher_curl",
    "Pulldown (Normal Grip)": "lat_pulldown",
    "Reverse Curl": "reverse_curl",
    "Seated Cable Row": "seated_cable_row",
    "Standing Calf Raise": "calf_raise",
    # Exercises added to seed data for RP import
    "Bayesian Curl": "bayesian_curl",
    "Bulgarian Split Squat (Glute-Focused)": "bulgarian_split_squat_glutes",
    "Cable Cross Body Lateral Raise": "cable_cross_body_lateral_raise",
    "Cable Leaning Lateral Raise": "cable_leaning_lateral_raise",
    "Cable Triceps Pushdown (Single-Arm)": "single_arm_cable_pushdown",
    "Deadlift (Deficit)": "deficit_deadlift",
    "Dumbbell Flye (Incline)": "incline_dumbbell_flye",
    "Dumbbell Press Flye (Flat)": "dumbbell_press_flye",
    "Dumbbell Stiff Legged Deadlift": "dumbbell_stiff_leg_deadlift",
    "EZ Bar Preacher Curl": "ez_bar_preacher_curl",
    "Barbell Standing Wrist Curl": "barbell_wrist_curl",
    "Lat Prayer": "lat_prayer",
    "Machine Chest Supported Row": "machine_chest_supported_row",
    "Machine Preacher Forearm Curl": "machine_forearm_curl",
    "Pulldown (Parallel Grip)": "parallel_grip_lat_pulldown",
    "Pulldown (Wide Grip)": "wide_grip_lat_pulldown",
    "Slant Board Sit-Up (Weighted)": "slant_board_sit_up",
    "Walking Lunges (Glute-Focused, Barbell)": "walking_lunges",
}


def parse_rp_data(path: str) -> dict:
    """Load and return the RP JSON export."""
    with open(path) as f:
        return json.load(f)


def parse_date(s: str) -> date:
    """Parse ISO date string to date object."""
    return datetime.fromisoformat(s.replace("Z", "+00:00")).date()


def group_sets_by_meso(
    rp_data: dict,
) -> dict[str, dict[tuple[int, int], dict[str, list[dict]]]]:
    """Group all RP set data by mesocycle -> (week, day) -> exercise name -> merged sets.

    Returns: {meso_key: {(week, day): {exercise_name: [set_dicts]}}}
    """
    result: dict[str, dict[tuple[int, int], dict[str, list[dict]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )

    for ex in rp_data["exercises"]:
        ex_name = ex["name"]
        for history_entry in ex["history"]:
            meso_key = history_entry["mesocycleKey"]
            for session_sets in history_entry["sets"]:
                if not session_sets:
                    continue
                week = session_sets[0]["week"]
                day = session_sets[0]["day"]
                result[meso_key][(week, day)][ex_name].extend(session_sets)

    return result


def get_session_date(
    sets_by_exercise: dict[str, list[dict]],
) -> str | None:
    """Extract the session date from the finishedAt of any set in the session."""
    for sets in sets_by_exercise.values():
        for s in sets:
            finished = s.get("finishedAt")
            if finished:
                return finished[:10]
    return None


def determine_exercise_order(
    meso_sessions: dict[tuple[int, int], dict[str, list[dict]]],
    day: int,
) -> list[str]:
    """Determine canonical exercise order for a day across all weeks.

    Uses the earliest week that has data for this day. Within that week,
    orders exercises by the earliest finishedAt timestamp of their sets.
    """
    # Find the earliest week with data for this day
    weeks_with_day = sorted(w for (w, d) in meso_sessions if d == day)
    if not weeks_with_day:
        return []

    # Collect all unique exercises seen on this day across all weeks
    all_exercises: set[str] = set()
    for w in weeks_with_day:
        all_exercises.update(meso_sessions[(w, day)].keys())

    # Use earliest week to determine order
    reference_week = weeks_with_day[0]
    ref_exercises = meso_sessions[(reference_week, day)]

    def earliest_finish(ex_name: str) -> str:
        sets = ref_exercises.get(ex_name, [])
        timestamps = [s.get("finishedAt", "") for s in sets if s.get("finishedAt")]
        return min(timestamps) if timestamps else "9999"

    return sorted(all_exercises, key=earliest_finish)


async def resolve_exercises(db: AsyncSession, rp_data: dict) -> dict[str, str]:
    """Resolve all RP exercise names to Protocol seed exercise IDs.

    Returns: {rp_exercise_name: protocol_exercise_id}
    """
    result = await db.execute(select(Exercise).where(Exercise.seed_key.isnot(None)))
    by_seed_key = {e.seed_key: e for e in result.scalars().all()}

    mapping: dict[str, str] = {}
    rp_exercise_names = {ex["name"] for ex in rp_data["exercises"]}

    for rp_name in sorted(rp_exercise_names):
        seed_key = RP_TO_SEED_KEY.get(rp_name)
        if seed_key and seed_key in by_seed_key:
            mapping[rp_name] = by_seed_key[seed_key].id
        else:
            print(f"  WARNING: No seed exercise for '{rp_name}' (seed_key={seed_key})")

    print("\nExercise resolution:")
    print(f"  Mapped: {len(mapping)} / {len(rp_exercise_names)}")
    if len(mapping) < len(rp_exercise_names):
        unmapped = sorted(rp_exercise_names - mapping.keys())
        print(f"  UNMAPPED: {unmapped}")

    return mapping


async def build_and_import_mesocycles(
    db: AsyncSession,
    user_id: str,
    rp_data: dict,
    exercise_map: dict[str, str],
    *,
    dry_run: bool,
) -> tuple[int, int, int]:
    """Build and import all mesocycles from RP data.

    Returns: (mesos_created, splits_created, total_sets)
    """
    # Load exercise objects for building structure
    result = await db.execute(select(Exercise))
    exercises_by_id = {e.id: e for e in result.scalars().all()}

    grouped = group_sets_by_meso(rp_data)
    meso_lookup = {m["key"]: m for m in rp_data["mesocycles"]}

    # Sort mesocycles chronologically (oldest first)
    meso_keys = sorted(
        grouped.keys(),
        key=lambda k: meso_lookup.get(k, {}).get("createdAt", ""),
    )

    mesos_created = 0
    splits_created = 0
    total_sets = 0

    for meso_key in meso_keys:
        meso_info = meso_lookup.get(meso_key)
        if not meso_info:
            print(f"  WARNING: No meso info for key '{meso_key}', skipping")
            continue

        meso_sessions = grouped[meso_key]
        meso_name = meso_info["name"]

        # Determine unique days and total weeks
        all_days = sorted({d for (_, d) in meso_sessions})
        all_weeks = sorted({w for (w, _) in meso_sessions})
        total_weeks = max(all_weeks) if all_weeks else 0

        if not all_days or total_weeks == 0:
            print(f"  Skipping '{meso_name}' - no session data")
            continue

        # Determine started_at from earliest session date
        earliest_date = None
        for w, d in sorted(meso_sessions.keys()):
            session_date = get_session_date(meso_sessions[(w, d)])
            if session_date:
                dt = date.fromisoformat(session_date)
                if earliest_date is None or dt < earliest_date:
                    earliest_date = dt

        started_at = earliest_date or parse_date(meso_info["createdAt"])

        # Determine exercise order per day
        day_exercise_orders: dict[int, list[str]] = {}
        for day in all_days:
            day_exercise_orders[day] = determine_exercise_order(meso_sessions, day)

        print(f"\n  Mesocycle: {meso_name}")
        print(f"    Weeks: {total_weeks}, Days: {all_days}, Started: {started_at}")

        if dry_run:
            set_count = sum(
                len(sets) for session_exs in meso_sessions.values() for sets in session_exs.values()
            )
            total_sets += set_count
            mesos_created += 1
            splits_created += 1
            for day in all_days:
                exs = day_exercise_orders[day]
                print(f"    Day {day}: {len(exs)} exercises - {exs}")
            print(f"    Total sets: {set_count}")
            continue

        # Create Split
        split = Split(
            name=f"{meso_name} (RP Import)",
            user_id=user_id,
        )
        db.add(split)
        await db.flush()
        splits_created += 1

        # Create Sessions and SessionExercises
        session_objs: list[Session] = []
        for day_idx, day in enumerate(all_days):
            session_obj = Session(
                split_id=split.id,
                name=f"Day {day}",
                day_order=day_idx,
            )
            db.add(session_obj)
            await db.flush()
            session_objs.append(session_obj)

            exercises_for_day = day_exercise_orders[day]
            for order, ex_name in enumerate(exercises_for_day):
                ex_id = exercise_map.get(ex_name)
                if not ex_id:
                    continue

                # Determine max set count for this exercise across all weeks
                max_sets = 0
                for w in all_weeks:
                    if (w, day) in meso_sessions:
                        ex_sets = meso_sessions[(w, day)].get(ex_name, [])
                        max_sets = max(max_sets, len(ex_sets))

                if max_sets == 0:
                    max_sets = 2  # fallback

                db.add(
                    SessionExercise(
                        session_id=session_obj.id,
                        exercise_id=ex_id,
                        order=order,
                        sets=max_sets,
                    )
                )

        await db.flush()

        # Build JSONB structure
        weeks = []
        for week_num in range(1, total_weeks + 1):
            week_sessions_data = []

            for day_idx, day in enumerate(all_days):
                session_obj = session_objs[day_idx]
                rp_session_data = meso_sessions.get((week_num, day), {})
                session_date = get_session_date(rp_session_data)

                exercise_entries = []
                for ex_name in day_exercise_orders[day]:
                    ex_id = exercise_map.get(ex_name)
                    if not ex_id:
                        continue

                    ex_obj = exercises_by_id.get(ex_id)
                    if not ex_obj:
                        continue

                    rp_sets = rp_session_data.get(ex_name, [])
                    # Sort by position
                    rp_sets.sort(key=lambda s: s.get("position", 0))

                    if rp_sets:
                        # Build sets from actual RP data
                        sets_list = []
                        for set_idx, rp_set in enumerate(rp_sets):
                            target_reps = rp_set.get("repsTarget")
                            if target_reps is None:
                                target_reps = rp_set.get("reps", 10)

                            sets_list.append(
                                {
                                    "set_num": set_idx + 1,
                                    "weight": rp_set.get("weight"),
                                    "reps": rp_set.get("reps"),
                                    "target_reps": target_reps,
                                    "suggested_weight": rp_set.get("weightTarget"),
                                    "logged": True,
                                }
                            )
                        total_sets += len(sets_list)
                    else:
                        # No data for this week/day/exercise — mark as skipped
                        sets_list = [
                            {
                                "set_num": 1,
                                "weight": None,
                                "reps": None,
                                "target_reps": 10,
                                "suggested_weight": None,
                                "logged": False,
                            }
                        ]
                        exercise_entries.append(
                            {
                                "exercise_id": ex_id,
                                "exercise_name": ex_obj.name,
                                "muscle_group": ex_obj.muscle_group,
                                "equipment_type": ex_obj.equipment_type,
                                "sets": sets_list,
                                "skipped": True,
                            }
                        )
                        continue

                    exercise_entries.append(
                        {
                            "exercise_id": ex_id,
                            "exercise_name": ex_obj.name,
                            "muscle_group": ex_obj.muscle_group,
                            "equipment_type": ex_obj.equipment_type,
                            "sets": sets_list,
                        }
                    )

                # Determine if this session has any logged data
                has_logged = any(
                    s["logged"] for ex_entry in exercise_entries for s in ex_entry["sets"]
                )

                week_sessions_data.append(
                    {
                        "session_name": session_obj.name,
                        "day_order": day_idx,
                        "date": session_date if has_logged else None,
                        "notes": None,
                        "exercises": exercise_entries,
                    }
                )

            weeks.append(
                {
                    "week_number": week_num,
                    "sessions": week_sessions_data,
                }
            )

        structure = {"weeks": weeks}

        # Create Mesocycle
        mesocycle = Mesocycle(
            split_id=split.id,
            user_id=user_id,
            name=meso_name,
            started_at=started_at,
            is_active=meso_info["status"] == "active",
            structure=structure,
        )
        db.add(mesocycle)
        await db.flush()
        mesos_created += 1

        set_count = sum(
            len(sets) for session_exs in meso_sessions.values() for sets in session_exs.values()
        )
        print(f"    Created with {set_count} logged sets")

    return mesos_created, splits_created, total_sets


async def main(data_file: str, user_name: str, *, dry_run: bool) -> None:
    print("RP Strength Data Import")
    print(f"{'=' * 50}")
    print(f"Data file: {data_file}")
    print(f"User: {user_name}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print()

    rp_data = parse_rp_data(data_file)
    print(
        f"Loaded {rp_data['exercisesWithHistory']} exercises, "
        f"{len(rp_data['mesocycles'])} mesocycles"
    )

    async with async_session() as db:
        # Look up user
        result = await db.execute(select(User).where(User.name == user_name))
        user = result.scalar_one_or_none()
        if not user:
            print(f"\nERROR: User '{user_name}' not found")
            sys.exit(1)
        print(f"Found user: {user.name} (id={user.id})")

        # Resolve exercises
        exercise_map = await resolve_exercises(db, rp_data)

        # Build and import mesocycles
        print(f"\n{'=' * 50}")
        print("Importing mesocycles...")
        mesos, splits, sets = await build_and_import_mesocycles(
            db, user.id, rp_data, exercise_map, dry_run=dry_run
        )

        if not dry_run:
            await db.commit()

        print(f"\n{'=' * 50}")
        print(f"Import {'preview' if dry_run else 'complete'}:")
        print(f"  Mesocycles: {mesos}")
        print(f"  Splits: {splits}")
        print(f"  Total sets: {sets}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import RP Strength data into Protocol")
    parser.add_argument("--data-file", required=True, help="Path to RP JSON export")
    parser.add_argument("--user-name", required=True, help="Protocol user name to assign data to")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    args = parser.parse_args()

    asyncio.run(main(args.data_file, args.user_name, dry_run=args.dry_run))
