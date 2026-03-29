"""Tests for pure domain functions in progression.py.

All functions operate on plain dicts (the JSONB structure). No DB, no async.
"""

import math

import pytest

from app.domain.progression import (
    build_mesocycle_structure,
    calculate_rir_scheme,
    compute_progression,
    derive_fields,
    get_current_position,
    handle_weight_bump,
)

# ---------------------------------------------------------------------------
# Helpers to build test structures
# ---------------------------------------------------------------------------


def _make_set(
    set_num=1,
    weight=None,
    reps=None,
    target_reps=10,
    suggested_weight=None,
    logged=False,
    skipped=False,
    rir=None,
    set_type=None,
):
    s = {
        "set_num": set_num,
        "weight": weight,
        "reps": reps,
        "target_reps": target_reps,
        "suggested_weight": suggested_weight,
        "rir": None,
        "logged": logged,
    }
    if skipped:
        s["skipped"] = True
    if rir is not None:
        s["rir"] = rir
    if set_type is not None:
        s["set_type"] = set_type
    return s


def _make_exercise(exercise_id="ex1", name="Bench Press", sets=None, skipped=False):
    return {
        "exercise_id": exercise_id,
        "exercise_name": name,
        "muscle_group": "chest",
        "equipment_type": "barbell",
        "technique": None,
        "sets": sets or [_make_set(n) for n in range(1, 4)],
        **({"skipped": True} if skipped else {}),
    }


def _make_session(session_name="Push", day_order=0, exercises=None, date=None, notes=None):
    return {
        "session_name": session_name,
        "day_order": day_order,
        "date": date,
        "notes": notes,
        "exercises": exercises or [_make_exercise()],
    }


def _make_week(week_number=1, rir=3, sessions=None):
    return {
        "week_number": week_number,
        "rir": rir,
        "sessions": sessions or [_make_session()],
    }


def _make_structure(weeks):
    return {"weeks": weeks}


def _two_week_structure(
    w1_sets=None,
    w2_sets=None,
    w1_rir=3,
    w2_rir=2,
    exercise_id="ex1",
    session_name="Push",
    day_order=0,
):
    """Build a minimal 2-week structure with one exercise for testing progression."""
    w1 = _make_week(
        1,
        w1_rir,
        [
            _make_session(
                session_name,
                day_order,
                [_make_exercise(exercise_id, sets=w1_sets or [_make_set(n) for n in range(1, 4)])],
            )
        ],
    )
    w2 = _make_week(
        2,
        w2_rir,
        [
            _make_session(
                session_name,
                day_order,
                [_make_exercise(exercise_id, sets=w2_sets or [_make_set(n) for n in range(1, 4)])],
            )
        ],
    )
    return _make_structure([w1, w2])


# ---------------------------------------------------------------------------
# calculate_rir_scheme
# ---------------------------------------------------------------------------


class TestCalculateRirScheme:
    def test_valid_week_counts(self):
        for n in range(3, 9):
            scheme = calculate_rir_scheme(n)
            assert len(scheme) == n

    def test_invalid_week_count_raises(self):
        with pytest.raises(ValueError, match="Unsupported week count"):
            calculate_rir_scheme(2)
        with pytest.raises(ValueError, match="Unsupported week count"):
            calculate_rir_scheme(9)


# ---------------------------------------------------------------------------
# get_current_position
# ---------------------------------------------------------------------------


class TestGetCurrentPosition:
    def test_empty_structure(self):
        result = get_current_position({"weeks": []})
        assert result == {"completed": True}

    def test_first_session_unlogged(self):
        structure = _make_structure([_make_week()])
        result = get_current_position(structure)
        assert result == {"week_index": 0, "session_index": 0, "completed": False}

    def test_all_logged(self):
        sets = [_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        structure = _make_structure(
            [_make_week(sessions=[_make_session(exercises=[_make_exercise(sets=sets)])])]
        )
        result = get_current_position(structure)
        assert result == {"completed": True}

    def test_skipped_exercise_counts_as_complete(self):
        """A session where all exercises are skipped should be treated as complete."""
        structure = _make_structure(
            [_make_week(sessions=[_make_session(exercises=[_make_exercise(skipped=True)])])]
        )
        result = get_current_position(structure)
        assert result == {"completed": True}

    def test_partially_logged_returns_first_incomplete(self):
        logged_sets = [_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        unlogged_sets = [_make_set(n) for n in range(1, 4)]

        s1 = _make_session("Push", 0, [_make_exercise(sets=logged_sets)])
        s2 = _make_session("Pull", 1, [_make_exercise(exercise_id="ex2", sets=unlogged_sets)])

        structure = _make_structure([_make_week(sessions=[s1, s2])])
        result = get_current_position(structure)
        assert result == {"week_index": 0, "session_index": 1, "completed": False}

    def test_advances_to_next_week(self):
        logged_sets = [_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        unlogged_sets = [_make_set(n) for n in range(1, 4)]

        w1 = _make_week(1, sessions=[_make_session(exercises=[_make_exercise(sets=logged_sets)])])
        w2 = _make_week(2, sessions=[_make_session(exercises=[_make_exercise(sets=unlogged_sets)])])
        structure = _make_structure([w1, w2])
        result = get_current_position(structure)
        assert result == {"week_index": 1, "session_index": 0, "completed": False}


# ---------------------------------------------------------------------------
# compute_progression
# ---------------------------------------------------------------------------


class TestComputeProgression:
    def test_reps_met_target_increments(self):
        """If reps >= target_reps, next week gets target_reps + 1 (minimum)."""
        w1_sets = [_make_set(1, weight=100, reps=10, target_reps=10, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        # max(prev_target + 1, ceil((prev_target + prev_reps) / 2))
        # = max(11, ceil(20/2)) = max(11, 10) = 11
        assert next_set["target_reps"] == 11
        assert next_set["suggested_weight"] == 100

    def test_reps_exceeded_target_averages_up(self):
        """If reps significantly exceed target, averaging catches up faster."""
        w1_sets = [_make_set(1, weight=100, reps=15, target_reps=10, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        # max(10 + 1, ceil((10 + 15) / 2)) = max(11, 13) = 13
        assert next_set["target_reps"] == 13

    def test_reps_below_target_holds(self):
        """If reps < target_reps, target stays the same."""
        w1_sets = [_make_set(1, weight=100, reps=8, target_reps=10, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["target_reps"] == 10
        assert next_set["suggested_weight"] == 100

    def test_no_target_reps_uses_actual_as_baseline(self):
        """First workout: if target_reps is None, actual reps become the baseline."""
        w1_sets = [_make_set(1, weight=100, reps=12, target_reps=None, logged=True)]
        w2_sets = [_make_set(1, target_reps=None)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["target_reps"] == 12

    def test_skips_deload_week(self):
        """Progression should not carry into deload weeks (RiR = -1)."""
        w1_sets = [_make_set(1, weight=100, reps=10, target_reps=10, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets, w2_rir=-1)

        compute_progression(structure, 0, 0)

        # Deload week should be untouched
        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["target_reps"] == 10  # original, not incremented
        assert next_set["suggested_weight"] is None  # not propagated

    def test_does_not_modify_already_logged_sets(self):
        """Sets already logged in the next week should not be overwritten."""
        w1_sets = [_make_set(1, weight=100, reps=10, target_reps=10, logged=True)]
        w2_sets = [_make_set(1, weight=90, reps=8, target_reps=9, logged=True)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["weight"] == 90  # preserved
        assert next_set["reps"] == 8  # preserved
        assert next_set["target_reps"] == 9  # not overwritten

    def test_no_next_week_is_noop(self):
        """Progression at the last week should be a no-op."""
        w1_sets = [_make_set(1, weight=100, reps=10, target_reps=10, logged=True)]
        structure = _make_structure(
            [_make_week(sessions=[_make_session(exercises=[_make_exercise(sets=w1_sets)])])]
        )
        # Should not raise
        compute_progression(structure, 0, 0)

    def test_skipped_exercise_ignored(self):
        """Skipped exercises should not produce progression."""
        w1_sets = [_make_set(1, weight=100, reps=10, target_reps=10, logged=True)]
        w2_sets = [_make_set(1)]

        w1 = _make_week(
            1,
            3,
            [_make_session(exercises=[_make_exercise(sets=w1_sets, skipped=True)])],
        )
        w2 = _make_week(2, 2, [_make_session(exercises=[_make_exercise(sets=w2_sets)])])
        structure = _make_structure([w1, w2])

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] is None
        assert next_set["target_reps"] == 10  # unchanged

    def test_session_name_mismatch_no_progression(self):
        """Progression should not cross between differently named sessions."""
        w1_sets = [_make_set(1, weight=100, reps=10, target_reps=10, logged=True)]
        w2_sets = [_make_set(1)]

        w1 = _make_week(
            1,
            3,
            [_make_session("Push", 0, [_make_exercise(sets=w1_sets)])],
        )
        w2 = _make_week(
            2,
            2,
            [_make_session("Pull", 1, [_make_exercise(sets=w2_sets)])],
        )
        structure = _make_structure([w1, w2])

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] is None

    def test_multiple_sets_progress_independently(self):
        """Each set progresses based on its own reps vs target."""
        w1_sets = [
            _make_set(1, weight=100, reps=10, target_reps=10, logged=True),
            _make_set(2, weight=100, reps=8, target_reps=10, logged=True),
            _make_set(3, weight=100, reps=12, target_reps=10, logged=True),
        ]
        w2_sets = [_make_set(1), _make_set(2), _make_set(3)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        w2_exercise = structure["weeks"][1]["sessions"][0]["exercises"][0]
        assert w2_exercise["sets"][0]["target_reps"] == 11  # met: max(11, ceil(20/2)=10) = 11
        assert w2_exercise["sets"][1]["target_reps"] == 10  # below: hold
        assert w2_exercise["sets"][2]["target_reps"] == 11  # exceeded: max(11, ceil(22/2)=11) = 11

    def test_skipped_set_excluded_from_progression(self):
        """A set marked as skipped should not generate progression."""
        w1_sets = [
            _make_set(1, weight=100, reps=10, target_reps=10, logged=True, skipped=True),
        ]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] is None
        assert next_set["target_reps"] == 10  # unchanged

    def test_weight_zero_not_carried_forward(self):
        """Weight of 0 should not be propagated as suggested_weight."""
        w1_sets = [_make_set(1, weight=0, reps=10, target_reps=10, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        compute_progression(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] is None


# ---------------------------------------------------------------------------
# handle_weight_bump
# ---------------------------------------------------------------------------


class TestHandleWeightBump:
    def test_weight_unchanged_is_noop(self):
        """If actual weight matches suggested, no changes should be made."""
        w1_sets = [
            _make_set(1, weight=100, reps=10, target_reps=10, suggested_weight=100, logged=True)
        ]
        w2_sets = [_make_set(1, suggested_weight=100)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        # target_reps unchanged
        w1_set = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]
        assert w1_set["target_reps"] == 10

        # next week suggested_weight unchanged
        w2_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert w2_set["suggested_weight"] == 100

    def test_weight_increased_reduces_target_reps(self):
        """Heavier weight should reduce target_reps via e1RM equivalence."""
        w1_sets = [
            _make_set(1, weight=110, reps=10, target_reps=10, suggested_weight=100, logged=True)
        ]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        w1_set = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]
        # e1RM = 100 * (1 + 10/30) = 133.33
        # new_reps = floor(30 * (133.33/110 - 1)) = floor(30 * 0.2121) = floor(6.36) = 6
        e1rm = 100 * (1 + 10 / 30)
        expected_reps = max(math.floor(30 * (e1rm / 110 - 1)), 5)
        assert w1_set["target_reps"] == expected_reps

    def test_weight_decreased_increases_target_reps(self):
        """Lighter weight should increase target_reps."""
        w1_sets = [
            _make_set(1, weight=90, reps=10, target_reps=10, suggested_weight=100, logged=True)
        ]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        w1_set = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]
        e1rm = 100 * (1 + 10 / 30)
        expected_reps = max(math.floor(30 * (e1rm / 90 - 1)), 5)
        assert w1_set["target_reps"] == expected_reps

    def test_minimum_target_reps_is_5(self):
        """Target reps should never go below 5, even with very heavy weight."""
        w1_sets = [
            _make_set(1, weight=200, reps=10, target_reps=10, suggested_weight=100, logged=True)
        ]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        w1_set = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]
        assert w1_set["target_reps"] >= 5

    def test_propagates_weight_to_future_weeks(self):
        """Actual logged weight should become suggested_weight in future unlogged sets."""
        w1_sets = [
            _make_set(1, weight=110, reps=10, target_reps=10, suggested_weight=100, logged=True)
        ]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        w2_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert w2_set["suggested_weight"] == 110

    def test_does_not_propagate_to_logged_future_sets(self):
        """Already-logged future sets should not have their suggested_weight changed."""
        w1_sets = [
            _make_set(1, weight=110, reps=10, target_reps=10, suggested_weight=100, logged=True)
        ]
        w2_sets = [_make_set(1, weight=95, suggested_weight=100, logged=True)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        w2_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert w2_set["suggested_weight"] == 100  # unchanged

    def test_no_suggested_weight_is_noop(self):
        """If suggested_weight is None, no weight bump should occur."""
        w1_sets = [
            _make_set(1, weight=100, reps=10, target_reps=10, suggested_weight=None, logged=True)
        ]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        w1_set = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]
        assert w1_set["target_reps"] == 10  # unchanged

    def test_skipped_set_ignored(self):
        """Skipped sets should not trigger weight bump logic."""
        w1_sets = [
            _make_set(
                1,
                weight=110,
                reps=10,
                target_reps=10,
                suggested_weight=100,
                logged=True,
                skipped=True,
            )
        ]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        handle_weight_bump(structure, 0, 0)

        w1_set = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]
        assert w1_set["target_reps"] == 10  # unchanged

    def test_propagates_across_multiple_future_weeks(self):
        """Weight should propagate to all future weeks, not just the next one."""
        w1_sets = [_make_set(1, weight=110, target_reps=10, suggested_weight=100, logged=True)]
        w2_sets = [_make_set(1)]
        w3_sets = [_make_set(1)]

        w1 = _make_week(1, 3, [_make_session(exercises=[_make_exercise(sets=w1_sets)])])
        w2 = _make_week(2, 2, [_make_session(exercises=[_make_exercise(sets=w2_sets)])])
        w3 = _make_week(3, 1, [_make_session(exercises=[_make_exercise(sets=w3_sets)])])
        structure = _make_structure([w1, w2, w3])

        handle_weight_bump(structure, 0, 0)

        w2_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        w3_set = structure["weeks"][2]["sessions"][0]["exercises"][0]["sets"][0]
        assert w2_set["suggested_weight"] == 110
        assert w3_set["suggested_weight"] == 110

    def test_out_of_bounds_week_index_is_noop(self):
        structure = _make_structure([_make_week()])
        handle_weight_bump(structure, 5, 0)  # should not raise


# ---------------------------------------------------------------------------
# derive_fields
# ---------------------------------------------------------------------------


class TestDeriveFields:
    def test_empty_structure(self):
        result = derive_fields({"weeks": []})
        assert result["total_weeks"] == 0
        assert result["workouts_completed"] == 0

    def test_basic_derive(self):
        structure = _make_structure(
            [_make_week(1, 3), _make_week(2, 2), _make_week(3, 1), _make_week(4, -1)]
        )
        result = derive_fields(structure)
        assert result["total_weeks"] == 4
        assert result["rir_scheme"] == [3, 2, 1, -1]
        assert result["current_week"] == 1
        assert result["current_rir"] == 3
        assert result["workouts_completed"] == 0

    def test_all_completed(self):
        logged_sets = [_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        w = _make_week(sessions=[_make_session(exercises=[_make_exercise(sets=logged_sets)])])
        structure = _make_structure([w])
        result = derive_fields(structure)
        assert result["workouts_completed"] == 1
        assert result["current_week"] == 1  # completed meso, stays at last week

    def test_counts_only_fully_logged_sessions(self):
        """A session with one unlogged set should not count as complete."""
        sets = [
            _make_set(1, weight=100, reps=10, logged=True),
            _make_set(2, weight=100, reps=10, logged=True),
            _make_set(3),  # not logged
        ]
        w = _make_week(sessions=[_make_session(exercises=[_make_exercise(sets=sets)])])
        structure = _make_structure([w])
        result = derive_fields(structure)
        assert result["workouts_completed"] == 0


# ---------------------------------------------------------------------------
# build_mesocycle_structure
# ---------------------------------------------------------------------------


class _FakeDay:
    """Minimal stand-in for a SplitDay model."""

    def __init__(self, name, day_order, exercises):
        self.name = name
        self.day_order = day_order
        self.exercises = exercises


class _FakeDayExercise:
    """Minimal stand-in for a SplitDayExercise model."""

    def __init__(self, exercise_id, order):
        self.exercise_id = exercise_id
        self.order = order


class _FakeExercise:
    """Minimal stand-in for an Exercise model."""

    def __init__(self, id, name="Bench Press", muscle_group="chest", equipment_type="barbell"):
        self.id = id
        self.name = name
        self.muscle_group = muscle_group
        self.equipment_type = equipment_type


class _FakePerformance:
    """Minimal stand-in for an ExercisePerformance model."""

    def __init__(self, working_weight=None, working_reps=None, num_sets=None):
        self.working_weight = working_weight
        self.working_reps = working_reps
        self.num_sets = num_sets


class TestBuildMesocycleStructure:
    def test_basic_structure_shape(self):
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}

        result = build_mesocycle_structure(days, exercises, total_weeks=4)

        assert len(result["weeks"]) == 4
        assert result["weeks"][0]["rir"] == 3  # from 4-week scheme
        assert result["weeks"][3]["rir"] == -1  # deload

        session = result["weeks"][0]["sessions"][0]
        assert session["session_name"] == "Push"
        assert session["day_order"] == 0
        assert len(session["exercises"]) == 1
        assert len(session["exercises"][0]["sets"]) == 3  # default sets_per_exercise

    def test_suggested_weight_only_week_1(self):
        """ExercisePerformance should only seed suggested_weight for week 1."""
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}
        perfs = {"ex1": _FakePerformance(working_weight=100, working_reps=10, num_sets=3)}

        result = build_mesocycle_structure(
            days, exercises, total_weeks=4, exercise_performances=perfs
        )

        w1_set = result["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]
        assert w1_set["suggested_weight"] == 100
        assert w1_set["target_reps"] == 10

        w2_set = result["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert w2_set["suggested_weight"] is None
        assert w2_set["target_reps"] == 10  # target_reps still seeded from perf

    def test_performance_overrides_defaults(self):
        """Performance data should override default sets_per_exercise and target_reps."""
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}
        perfs = {"ex1": _FakePerformance(working_weight=80, working_reps=12, num_sets=5)}

        result = build_mesocycle_structure(
            days,
            exercises,
            total_weeks=3,
            target_reps=8,
            sets_per_exercise=3,
            exercise_performances=perfs,
        )

        exercise = result["weeks"][0]["sessions"][0]["exercises"][0]
        assert len(exercise["sets"]) == 5  # from performance, not default 3
        assert exercise["sets"][0]["target_reps"] == 12  # from performance, not default 8

    def test_no_performance_uses_defaults(self):
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}

        result = build_mesocycle_structure(
            days,
            exercises,
            total_weeks=3,
            target_reps=8,
            sets_per_exercise=4,
        )

        exercise = result["weeks"][0]["sessions"][0]["exercises"][0]
        assert len(exercise["sets"]) == 4
        assert exercise["sets"][0]["target_reps"] == 8
        assert exercise["sets"][0]["suggested_weight"] is None

    def test_missing_exercise_skipped(self):
        """Exercises not found in exercises_by_id should be skipped."""
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0), _FakeDayExercise("missing", 1)])]
        exercises = {"ex1": _FakeExercise("ex1")}

        result = build_mesocycle_structure(days, exercises, total_weeks=3)

        session = result["weeks"][0]["sessions"][0]
        assert len(session["exercises"]) == 1
        assert session["exercises"][0]["exercise_id"] == "ex1"

    def test_multiple_sessions(self):
        days = [
            _FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)]),
            _FakeDay("Pull", 1, [_FakeDayExercise("ex2", 0)]),
        ]
        exercises = {
            "ex1": _FakeExercise("ex1", "Bench Press"),
            "ex2": _FakeExercise("ex2", "Barbell Row"),
        }

        result = build_mesocycle_structure(days, exercises, total_weeks=3)

        for week in result["weeks"]:
            assert len(week["sessions"]) == 2
            assert week["sessions"][0]["session_name"] == "Push"
            assert week["sessions"][1]["session_name"] == "Pull"

    def test_set_nums_are_sequential(self):
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}

        result = build_mesocycle_structure(days, exercises, total_weeks=3, sets_per_exercise=5)

        sets = result["weeks"][0]["sessions"][0]["exercises"][0]["sets"]
        assert [s["set_num"] for s in sets] == [1, 2, 3, 4, 5]
