"""Tests for pure domain functions in progression.py.

All functions operate on plain dicts (the JSONB structure). No DB, no async.
"""

from app.domain.progression import (
    build_mesocycle_structure,
    carry_weight_forward,
    derive_fields,
    get_current_position,
)

# ---------------------------------------------------------------------------
# Helpers to build test structures
# ---------------------------------------------------------------------------


def _make_set(
    set_num=1,
    weight=None,
    reps=None,
    suggested_weight=None,
    logged=False,
    skipped=False,
    set_type=None,
):
    s = {
        "set_num": set_num,
        "weight": weight,
        "reps": reps,
        "suggested_weight": suggested_weight,
        "logged": logged,
    }
    if skipped:
        s["skipped"] = True
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


def _make_week(week_number=1, sessions=None):
    return {
        "week_number": week_number,
        "sessions": sessions or [_make_session()],
    }


def _make_structure(weeks):
    return {"weeks": weeks}


def _two_week_structure(
    w1_sets=None,
    w2_sets=None,
    exercise_id="ex1",
    session_name="Push",
    day_order=0,
):
    """Build a minimal 2-week structure with one exercise for testing carry-forward."""
    w1 = _make_week(
        1,
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
# carry_weight_forward
# ---------------------------------------------------------------------------


class TestCarryWeightForward:
    def test_copies_weight_to_next_week(self):
        w1_sets = [_make_set(1, weight=100, reps=10, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        carry_weight_forward(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] == 100
        assert next_set["weight"] is None
        assert next_set["reps"] is None

    def test_does_not_carry_reps(self):
        """Reps always start blank on the next instance — only weight carries."""
        w1_sets = [_make_set(1, weight=100, reps=12, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        carry_weight_forward(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["reps"] is None

    def test_does_not_overwrite_logged_future_sets(self):
        w1_sets = [_make_set(1, weight=110, reps=10, logged=True)]
        w2_sets = [_make_set(1, weight=90, reps=8, suggested_weight=100, logged=True)]
        structure = _two_week_structure(w1_sets, w2_sets)

        carry_weight_forward(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["weight"] == 90
        assert next_set["reps"] == 8
        assert next_set["suggested_weight"] == 100

    def test_no_next_instance_is_noop(self):
        w1_sets = [_make_set(1, weight=100, reps=10, logged=True)]
        structure = _make_structure(
            [_make_week(sessions=[_make_session(exercises=[_make_exercise(sets=w1_sets)])])]
        )
        carry_weight_forward(structure, 0, 0)  # no raise

    def test_skipped_exercise_ignored(self):
        w1_sets = [_make_set(1, weight=100, reps=10, logged=True)]
        w2_sets = [_make_set(1)]

        w1 = _make_week(
            1, [_make_session(exercises=[_make_exercise(sets=w1_sets, skipped=True)])]
        )
        w2 = _make_week(2, [_make_session(exercises=[_make_exercise(sets=w2_sets)])])
        structure = _make_structure([w1, w2])

        carry_weight_forward(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] is None

    def test_skipped_set_ignored(self):
        w1_sets = [_make_set(1, weight=100, reps=10, logged=True, skipped=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        carry_weight_forward(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] is None

    def test_zero_weight_not_carried(self):
        w1_sets = [_make_set(1, weight=0, reps=10, logged=True)]
        w2_sets = [_make_set(1)]
        structure = _two_week_structure(w1_sets, w2_sets)

        carry_weight_forward(structure, 0, 0)

        next_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        assert next_set["suggested_weight"] is None

    def test_carries_to_next_instance_same_week(self):
        """When the same exercise appears later in the same week, that's the next target."""
        w1_push_sets = [_make_set(1, weight=100, reps=10, logged=True)]
        w1_pull_sets = [_make_set(1)]
        w2_push_sets = [_make_set(1)]
        w2_pull_sets = [_make_set(1)]

        w1 = _make_week(
            1,
            [
                _make_session("Push", 0, [_make_exercise(sets=w1_push_sets)]),
                _make_session("Pull", 1, [_make_exercise(sets=w1_pull_sets)]),
            ],
        )
        w2 = _make_week(
            2,
            [
                _make_session("Push", 0, [_make_exercise(sets=w2_push_sets)]),
                _make_session("Pull", 1, [_make_exercise(sets=w2_pull_sets)]),
            ],
        )
        structure = _make_structure([w1, w2])

        carry_weight_forward(structure, 0, 0)

        w1_pull_set = structure["weeks"][0]["sessions"][1]["exercises"][0]["sets"][0]
        assert w1_pull_set["suggested_weight"] == 100

        # Only the next instance gets updated; later weeks stay untouched
        w2_push_set = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"][0]
        w2_pull_set = structure["weeks"][1]["sessions"][1]["exercises"][0]["sets"][0]
        assert w2_push_set["suggested_weight"] is None
        assert w2_pull_set["suggested_weight"] is None

    def test_per_set_carryover(self):
        w1_sets = [
            _make_set(1, weight=100, reps=10, logged=True),
            _make_set(2, weight=95, reps=9, logged=True),
            _make_set(3, weight=90, reps=8, logged=True),
        ]
        w2_sets = [_make_set(1), _make_set(2), _make_set(3)]
        structure = _two_week_structure(w1_sets, w2_sets)

        carry_weight_forward(structure, 0, 0)

        w2_ex = structure["weeks"][1]["sessions"][0]["exercises"][0]
        assert w2_ex["sets"][0]["suggested_weight"] == 100
        assert w2_ex["sets"][1]["suggested_weight"] == 95
        assert w2_ex["sets"][2]["suggested_weight"] == 90

    def test_out_of_bounds_week_index_is_noop(self):
        structure = _make_structure([_make_week()])
        carry_weight_forward(structure, 5, 0)  # no raise


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
            [_make_week(1), _make_week(2), _make_week(3), _make_week(4)]
        )
        result = derive_fields(structure)
        assert result["total_weeks"] == 4
        assert result["current_week"] == 1
        assert result["workouts_completed"] == 0

    def test_all_completed(self):
        logged_sets = [_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        w = _make_week(sessions=[_make_session(exercises=[_make_exercise(sets=logged_sets)])])
        structure = _make_structure([w])
        result = derive_fields(structure)
        assert result["workouts_completed"] == 1
        assert result["current_week"] == 1

    def test_counts_only_fully_logged_sessions(self):
        sets = [
            _make_set(1, weight=100, reps=10, logged=True),
            _make_set(2, weight=100, reps=10, logged=True),
            _make_set(3),
        ]
        w = _make_week(sessions=[_make_session(exercises=[_make_exercise(sets=sets)])])
        structure = _make_structure([w])
        result = derive_fields(structure)
        assert result["workouts_completed"] == 0


# ---------------------------------------------------------------------------
# build_mesocycle_structure
# ---------------------------------------------------------------------------


class _FakeDay:
    def __init__(self, name, day_order, exercises):
        self.name = name
        self.day_order = day_order
        self.exercises = exercises


class _FakeDayExercise:
    def __init__(self, exercise_id, order):
        self.exercise_id = exercise_id
        self.order = order


class _FakeExercise:
    def __init__(self, id, name="Bench Press", muscle_group="chest", equipment_type="barbell"):
        self.id = id
        self.name = name
        self.muscle_group = muscle_group
        self.equipment_type = equipment_type


class TestBuildMesocycleStructure:
    def test_basic_structure_shape(self):
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}

        result = build_mesocycle_structure(days, exercises, total_weeks=4)

        assert len(result["weeks"]) == 4
        session = result["weeks"][0]["sessions"][0]
        assert session["session_name"] == "Push"
        assert session["day_order"] == 0
        assert len(session["exercises"]) == 1
        assert len(session["exercises"][0]["sets"]) == 3

    def test_sets_start_blank(self):
        """No seeded weights or reps — everything starts None."""
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}

        result = build_mesocycle_structure(days, exercises, total_weeks=2)

        for week in result["weeks"]:
            for s in week["sessions"][0]["exercises"][0]["sets"]:
                assert s["weight"] is None
                assert s["reps"] is None
                assert s["suggested_weight"] is None
                assert s["logged"] is False
                assert "target_reps" not in s

    def test_sets_per_exercise_override(self):
        days = [_FakeDay("Push", 0, [_FakeDayExercise("ex1", 0)])]
        exercises = {"ex1": _FakeExercise("ex1")}

        result = build_mesocycle_structure(days, exercises, total_weeks=3, sets_per_exercise=5)

        exercise = result["weeks"][0]["sessions"][0]["exercises"][0]
        assert len(exercise["sets"]) == 5

    def test_missing_exercise_skipped(self):
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
