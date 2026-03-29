"""Tests for domain propagation helpers."""

from app.domain.propagation import find_exercise_in_session, iter_future_sessions


def _make_structure(weeks):
    return {"weeks": weeks}


def _make_week(sessions):
    return {"sessions": sessions}


def _make_session(name="Push", day_order=0, exercises=None):
    return {"session_name": name, "day_order": day_order, "exercises": exercises or []}


def _make_exercise(exercise_id="ex1"):
    return {"exercise_id": exercise_id, "sets": []}


class TestIterFutureSessions:
    def test_yields_matching_sessions(self):
        structure = _make_structure(
            [
                _make_week([_make_session("Push", 0)]),
                _make_week([_make_session("Push", 0)]),
                _make_week([_make_session("Push", 0)]),
            ]
        )
        results = list(iter_future_sessions(structure, 0, "Push", 0))
        assert len(results) == 2
        assert results[0][0] == 1  # week index
        assert results[1][0] == 2

    def test_skips_non_matching_name(self):
        structure = _make_structure(
            [
                _make_week([_make_session("Push", 0)]),
                _make_week([_make_session("Pull", 0)]),
            ]
        )
        results = list(iter_future_sessions(structure, 0, "Push", 0))
        assert len(results) == 0

    def test_skips_non_matching_day_order(self):
        structure = _make_structure(
            [
                _make_week([_make_session("Push", 0)]),
                _make_week([_make_session("Push", 1)]),
            ]
        )
        results = list(iter_future_sessions(structure, 0, "Push", 0))
        assert len(results) == 0

    def test_empty_structure(self):
        results = list(iter_future_sessions({"weeks": []}, 0, "Push", 0))
        assert results == []

    def test_last_week_yields_nothing(self):
        structure = _make_structure([_make_week([_make_session()])])
        results = list(iter_future_sessions(structure, 0, "Push", 0))
        assert results == []


class TestFindExerciseInSession:
    def test_finds_existing(self):
        session = _make_session(exercises=[_make_exercise("ex1"), _make_exercise("ex2")])
        result = find_exercise_in_session(session, "ex2")
        assert result is not None
        assert result["exercise_id"] == "ex2"

    def test_returns_none_for_missing(self):
        session = _make_session(exercises=[_make_exercise("ex1")])
        assert find_exercise_in_session(session, "missing") is None

    def test_empty_session(self):
        session = _make_session(exercises=[])
        assert find_exercise_in_session(session, "ex1") is None
