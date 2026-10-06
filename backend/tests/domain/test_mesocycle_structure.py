"""Tests for pure domain functions in mesocycle_structure.py.

All functions operate on plain dicts (the JSONB structure). No DB, no async.
"""

from datetime import date

from app.domain.mesocycle_structure import (
    apply_session_snapshot,
    build_mesocycle_structure,
    count_total_workouts,
    derive_fields,
    get_current_position,
    is_session_done,
)

# ---------------------------------------------------------------------------
# Helpers to build test structures
# ---------------------------------------------------------------------------


def _make_set(
    set_num=1,
    weight=None,
    reps=None,
    logged=False,
    skipped=False,
    set_type=None,
):
    s = {
        "set_num": set_num,
        "weight": weight,
        "reps": reps,
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
        "sets": sets or [_make_set(n) for n in range(1, 4)],
        **({"skipped": True} if skipped else {}),
    }


def _make_session(
    session_name="Push", day_order=0, exercises=None, date=None, notes=None, skipped=False
):
    return {
        "session_name": session_name,
        "day_order": day_order,
        "date": date,
        "notes": notes,
        "exercises": exercises or [_make_exercise()],
        **({"skipped": True} if skipped else {}),
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
    """Build a minimal 2-week structure with one exercise."""
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

    def test_skipped_session_is_passed_over(self):
        s1 = _make_session("Push", 0, skipped=True)
        s2 = _make_session("Pull", 1, [_make_exercise(exercise_id="ex2")])
        structure = _make_structure([_make_week(sessions=[s1, s2])])
        result = get_current_position(structure)
        assert result == {"week_index": 0, "session_index": 1, "completed": False}

    def test_skipping_last_open_session_completes_mesocycle(self):
        logged_sets = [_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        s1 = _make_session("Push", 0, [_make_exercise(sets=logged_sets)])
        s2 = _make_session("Pull", 1, skipped=True)
        structure = _make_structure([_make_week(sessions=[s1, s2])])
        assert get_current_position(structure) == {"completed": True}

    def test_unskipped_session_reopens(self):
        s1 = _make_session("Push", 0, skipped=True)
        structure = _make_structure([_make_week(sessions=[s1])])
        assert get_current_position(structure) == {"completed": True}
        s1["skipped"] = False
        assert get_current_position(structure) == {
            "week_index": 0,
            "session_index": 0,
            "completed": False,
        }


# ---------------------------------------------------------------------------
# is_session_done
# ---------------------------------------------------------------------------


class TestIsSessionDone:
    def test_skipped_set_counts_as_done(self):
        sets = [
            _make_set(1, weight=100, reps=10, logged=True),
            _make_set(2, skipped=True),
            _make_set(3, weight=100, reps=8, logged=True),
        ]
        assert is_session_done(_make_session(exercises=[_make_exercise(sets=sets)]))

    def test_open_set_keeps_session_open(self):
        sets = [_make_set(1, weight=100, reps=10, logged=True), _make_set(2)]
        assert not is_session_done(_make_session(exercises=[_make_exercise(sets=sets)]))

    def test_skipped_exercise_with_open_sets_is_done(self):
        sets = [_make_set(1, weight=100, reps=10, logged=True), _make_set(2)]
        session = _make_session(exercises=[_make_exercise(sets=sets, skipped=True)])
        assert is_session_done(session)

    def test_skipped_session_is_not_done(self):
        assert not is_session_done(_make_session(skipped=True))

    def test_set_skip_does_not_block_next_session(self):
        sets = [_make_set(1, weight=100, reps=10, logged=True), _make_set(2, skipped=True)]
        w1 = _make_week(1, [_make_session(exercises=[_make_exercise(sets=sets)])])
        w2 = _make_week(2, [_make_session()])
        assert get_current_position(_make_structure([w1, w2]))["week_index"] == 1


# ---------------------------------------------------------------------------
# apply_session_snapshot
# ---------------------------------------------------------------------------

DAY = date(2026, 10, 6)


def _snap_set(weight=None, reps=None, logged=False, skipped=False, set_type=None):
    return {
        "weight": weight,
        "reps": reps,
        "logged": logged,
        "skipped": skipped,
        "set_type": set_type,
    }


def _snap(exercise_id="ex1", sets=None, skipped=False):
    return {"exercise_id": exercise_id, "skipped": skipped, "sets": sets or [_snap_set()]}


class TestApplySessionSnapshot:
    def test_logs_sets_and_stamps_date(self):
        structure = _two_week_structure()
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[
                _snap(
                    sets=[
                        _snap_set(100, 10, logged=True),
                        _snap_set(100, None),
                        _snap_set(),
                    ]
                )
            ],
            logged_on=DAY,
        )
        session = structure["weeks"][0]["sessions"][0]
        sets = session["exercises"][0]["sets"]
        assert sets[0] == {
            "set_num": 1,
            "weight": 100,
            "reps": 10,
            "logged": True,
            "skipped": False,
        }
        assert sets[1]["weight"] == 100 and sets[1]["logged"] is False
        assert session["date"] == "2026-10-06"

    def test_date_is_kept_when_editing_a_logged_session(self):
        structure = _two_week_structure(
            w1_sets=[_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        )
        structure["weeks"][0]["sessions"][0]["date"] = "2026-09-01"
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[_snap(sets=[_snap_set(105, 10, logged=True)] * 3)],
            logged_on=DAY,
        )
        assert structure["weeks"][0]["sessions"][0]["date"] == "2026-09-01"

    def test_date_cleared_when_nothing_logged(self):
        structure = _two_week_structure()
        structure["weeks"][0]["sessions"][0]["date"] = "2026-09-01"  # stale "opened" date
        apply_session_snapshot(
            structure, 0, 0, exercises=[_snap(sets=[_snap_set(100, None)])], logged_on=DAY
        )
        assert structure["weeks"][0]["sessions"][0]["date"] is None

    def test_stale_date_replaced_by_first_log(self):
        structure = _two_week_structure()
        structure["weeks"][0]["sessions"][0]["date"] = "2026-09-01"
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[_snap(sets=[_snap_set(100, 8, logged=True)])],
            logged_on=DAY,
        )
        assert structure["weeks"][0]["sessions"][0]["date"] == "2026-10-06"

    def test_unnamed_exercises_are_untouched(self):
        w1 = _make_week(
            1,
            [
                _make_session(
                    exercises=[
                        _make_exercise("ex1"),
                        _make_exercise("ex2", sets=[_make_set(1, weight=50, reps=12, logged=True)]),
                    ]
                )
            ],
        )
        structure = _make_structure([w1])
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[_snap("ex1", [_snap_set(100, 5, logged=True)])],
            logged_on=DAY,
        )
        ex2 = structure["weeks"][0]["sessions"][0]["exercises"][1]
        assert ex2["sets"][0]["logged"] is True and ex2["sets"][0]["weight"] == 50

    def test_unknown_exercise_in_snapshot_is_ignored(self):
        structure = _two_week_structure()
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[_snap("gone", [_snap_set(1, 1, logged=True)])],
            logged_on=DAY,
        )
        assert structure["weeks"][0]["sessions"][0]["date"] is None

    def test_skipped_exercise_keeps_logged_sets(self):
        structure = _two_week_structure()
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[
                _snap(
                    skipped=True,
                    sets=[
                        _snap_set(100, 10, logged=True),
                        _snap_set(),
                        _snap_set(),
                    ],
                )
            ],
            logged_on=DAY,
        )
        ex = structure["weeks"][0]["sessions"][0]["exercises"][0]
        assert ex["skipped"] is True
        assert ex["sets"][0]["logged"] is True

    def test_logged_set_is_never_skipped(self):
        structure = _two_week_structure()
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[_snap(sets=[_snap_set(100, 10, logged=True, skipped=True)])],
            logged_on=DAY,
        )
        assert structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"][0]["skipped"] is False

    def test_set_type_kept_only_when_given(self):
        structure = _two_week_structure()
        apply_session_snapshot(
            structure,
            0,
            0,
            exercises=[
                _snap(sets=[_snap_set(100, 10, logged=True, set_type="myorep"), _snap_set()])
            ],
            logged_on=DAY,
        )
        sets = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"]
        assert sets[0]["set_type"] == "myorep"
        assert "set_type" not in sets[1]

    def test_added_set_propagates_to_unstarted_future_week(self):
        structure = _two_week_structure()
        apply_session_snapshot(
            structure, 0, 0, exercises=[_snap(sets=[_snap_set()] * 4)], logged_on=DAY
        )
        w2_sets = structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"]
        assert [s["set_num"] for s in w2_sets] == [1, 2, 3, 4]

    def test_removed_set_propagates_but_not_onto_started_weeks(self):
        w2_started = [_make_set(1, weight=100, reps=10, logged=True), _make_set(2), _make_set(3)]
        structure = _two_week_structure(w2_sets=w2_started)
        apply_session_snapshot(
            structure, 0, 0, exercises=[_snap(sets=[_snap_set()] * 2)], logged_on=DAY
        )
        assert len(structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"]) == 2
        assert len(structure["weeks"][1]["sessions"][0]["exercises"][0]["sets"]) == 3

    def test_sets_are_renumbered(self):
        structure = _two_week_structure()
        apply_session_snapshot(
            structure, 0, 0, exercises=[_snap(sets=[_snap_set(), _snap_set()])], logged_on=DAY
        )
        sets = structure["weeks"][0]["sessions"][0]["exercises"][0]["sets"]
        assert [s["set_num"] for s in sets] == [1, 2]


# ---------------------------------------------------------------------------
# derive_fields
# ---------------------------------------------------------------------------


class TestDeriveFields:
    def test_empty_structure(self):
        result = derive_fields({"weeks": []})
        assert result["total_weeks"] == 0
        assert result["workouts_completed"] == 0

    def test_basic_derive(self):
        structure = _make_structure([_make_week(1), _make_week(2), _make_week(3), _make_week(4)])
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

    def test_skipped_session_not_counted_as_completed(self):
        logged_sets = [_make_set(n, weight=100, reps=10, logged=True) for n in range(1, 4)]
        s1 = _make_session("Push", 0, [_make_exercise(sets=logged_sets)])
        s2 = _make_session("Pull", 1, [_make_exercise(sets=logged_sets)], skipped=True)
        structure = _make_structure([_make_week(sessions=[s1, s2])])
        result = derive_fields(structure)
        assert result["workouts_completed"] == 1

    def test_current_week_advances_past_skipped_week(self):
        w1 = _make_week(1, [_make_session(skipped=True)])
        w2 = _make_week(2, [_make_session()])
        result = derive_fields(_make_structure([w1, w2]))
        assert result["current_week"] == 2


class TestCountTotalWorkouts:
    def test_counts_every_session(self):
        structure = _make_structure([_make_week(1), _make_week(2)])
        assert count_total_workouts(structure) == 2

    def test_excludes_skipped_sessions(self):
        s1 = _make_session("Push", 0)
        s2 = _make_session("Pull", 1, skipped=True)
        structure = _make_structure([_make_week(sessions=[s1, s2])])
        assert count_total_workouts(structure) == 1

    def test_excludes_sessions_with_all_exercises_skipped(self):
        s1 = _make_session("Push", 0, [_make_exercise(skipped=True)])
        structure = _make_structure([_make_week(sessions=[s1])])
        assert count_total_workouts(structure) == 0


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
                assert s["logged"] is False
                assert "suggested_weight" not in s
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
