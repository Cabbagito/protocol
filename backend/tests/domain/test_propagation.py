"""Tests for domain propagation helpers."""

from app.domain.propagation import (
    apply_relative_order,
    find_exercise_in_session,
    iter_future_exercise_instances,
    iter_future_sessions,
)


def _make_structure(weeks):
    return {"weeks": weeks}


def _make_week(sessions):
    return {"sessions": sessions}


def _make_session(name="Push", day_order=0, exercises=None):
    return {"session_name": name, "day_order": day_order, "exercises": exercises or []}


def _make_exercise(exercise_id="ex1", skipped=False):
    e = {"exercise_id": exercise_id, "sets": []}
    if skipped:
        e["skipped"] = True
    return e


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


class TestIterFutureExerciseInstances:
    def test_yields_later_sessions_same_week(self):
        structure = _make_structure(
            [
                _make_week(
                    [
                        _make_session("Push", 0, [_make_exercise("ex1")]),
                        _make_session("Pull", 1, [_make_exercise("ex1")]),
                    ]
                )
            ]
        )
        results = list(iter_future_exercise_instances(structure, 0, 0, "ex1"))
        assert len(results) == 1
        assert results[0][:2] == (0, 1)

    def test_yields_across_weeks(self):
        structure = _make_structure(
            [
                _make_week([_make_session("Push", 0, [_make_exercise("ex1")])]),
                _make_week([_make_session("Pull", 0, [_make_exercise("ex1")])]),
                _make_week([_make_session("Push", 0, [_make_exercise("ex1")])]),
            ]
        )
        results = list(iter_future_exercise_instances(structure, 0, 0, "ex1"))
        # Differently named session in week 1 still matches by exercise_id
        assert len(results) == 2
        assert [(wi, si) for wi, si, _ in results] == [(1, 0), (2, 0)]

    def test_skips_skipped_exercise(self):
        structure = _make_structure(
            [
                _make_week([_make_session("Push", 0, [_make_exercise("ex1")])]),
                _make_week([_make_session("Push", 0, [_make_exercise("ex1", skipped=True)])]),
                _make_week([_make_session("Push", 0, [_make_exercise("ex1")])]),
            ]
        )
        results = list(iter_future_exercise_instances(structure, 0, 0, "ex1"))
        assert [(wi, si) for wi, si, _ in results] == [(2, 0)]

    def test_excludes_current_session(self):
        structure = _make_structure(
            [
                _make_week(
                    [
                        _make_session("Push", 0, [_make_exercise("ex1")]),
                        _make_session("Pull", 1, [_make_exercise("ex1")]),
                    ]
                )
            ]
        )
        # Starting at (0, 1) — nothing after it
        results = list(iter_future_exercise_instances(structure, 0, 1, "ex1"))
        assert results == []

    def test_exercise_missing_from_session_is_skipped(self):
        structure = _make_structure(
            [
                _make_week([_make_session("Push", 0, [_make_exercise("ex1")])]),
                _make_week([_make_session("Pull", 0, [_make_exercise("ex2")])]),
                _make_week([_make_session("Push", 0, [_make_exercise("ex1")])]),
            ]
        )
        results = list(iter_future_exercise_instances(structure, 0, 0, "ex1"))
        assert [(wi, si) for wi, si, _ in results] == [(2, 0)]


class TestApplyRelativeOrder:
    @staticmethod
    def _ids(exercises):
        return [e["exercise_id"] for e in exercises]

    def test_full_permutation(self):
        exs = [_make_exercise(i) for i in ["a", "b", "c", "d"]]
        result = apply_relative_order(exs, ["c", "a", "d", "b"])
        assert self._ids(result) == ["c", "a", "d", "b"]

    def test_unlisted_exercises_keep_their_slots(self):
        exs = [_make_exercise(i) for i in ["a", "x", "b", "c"]]
        result = apply_relative_order(exs, ["c", "b", "a"])
        assert self._ids(result) == ["c", "x", "b", "a"]

    def test_listed_ids_missing_from_session_are_ignored(self):
        exs = [_make_exercise(i) for i in ["a", "b"]]
        result = apply_relative_order(exs, ["b", "zzz", "a"])
        assert self._ids(result) == ["b", "a"]

    def test_keeps_exercise_dicts_intact(self):
        exs = [_make_exercise("a"), _make_exercise("b", skipped=True)]
        result = apply_relative_order(exs, ["b", "a"])
        assert result[0] is exs[1]
        assert result[0]["skipped"] is True
