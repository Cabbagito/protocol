"""Tests for collect_exercise_history — the cross-mesocycle history walker."""

from datetime import date
from types import SimpleNamespace

from app.services.exercise_service import collect_exercise_history


def _meso(meso_id, name, started_at, structure):
    return SimpleNamespace(id=meso_id, name=name, started_at=started_at, structure=structure)


def _logged_set(set_num, weight, reps, target_reps=10):
    return {
        "set_num": set_num,
        "weight": weight,
        "reps": reps,
        "target_reps": target_reps,
        "suggested_weight": None,
        "logged": True,
    }


def _exercise(exercise_id, sets, skipped=False):
    e = {"exercise_id": exercise_id, "sets": sets}
    if skipped:
        e["skipped"] = True
    return e


def _session(name, date_str, exercises):
    return {"session_name": name, "date": date_str, "exercises": exercises}


def _week(week_number, sessions):
    return {"week_number": week_number, "sessions": sessions}


def test_returns_empty_for_unknown_exercise():
    meso = _meso("m1", "Block 1", date(2026, 1, 1), {"weeks": []})
    assert collect_exercise_history([meso], "missing") == []


def test_collects_logged_sessions_from_one_meso():
    meso = _meso(
        "m1", "Block 1", date(2026, 1, 1),
        {"weeks": [
            _week(1, [
                _session("Push", "2026-01-05", [
                    _exercise("bench", [_logged_set(1, 100, 10), _logged_set(2, 100, 9)]),
                ]),
            ]),
        ]},
    )
    out = collect_exercise_history([meso], "bench")
    assert len(out) == 1
    assert out[0]["meso_name"] == "Block 1"
    assert out[0]["week_number"] == 1
    assert out[0]["session_name"] == "Push"
    assert out[0]["date"] == "2026-01-05"
    assert len(out[0]["sets"]) == 2


def test_orders_newest_first_across_mesocycles():
    meso_old = _meso(
        "old", "Block 1", date(2026, 1, 1),
        {"weeks": [_week(1, [_session("Push", "2026-01-05", [
            _exercise("bench", [_logged_set(1, 100, 10)]),
        ])])]},
    )
    meso_new = _meso(
        "new", "Block 2", date(2026, 2, 1),
        {"weeks": [_week(1, [_session("Push", "2026-02-10", [
            _exercise("bench", [_logged_set(1, 110, 8)]),
        ])])]},
    )
    out = collect_exercise_history([meso_old, meso_new], "bench")
    assert [e["meso_name"] for e in out] == ["Block 2", "Block 1"]


def test_falls_back_to_meso_started_at_when_session_date_null():
    meso = _meso(
        "m1", "Block 1", date(2026, 3, 1),
        {"weeks": [_week(1, [_session("Push", None, [
            _exercise("bench", [_logged_set(1, 100, 10)]),
        ])])]},
    )
    out = collect_exercise_history([meso], "bench")
    assert out[0]["date"] is None
    assert out[0]["meso_started_at"] == "2026-03-01"


def test_skipped_exercise_excluded():
    meso = _meso(
        "m1", "Block 1", date(2026, 1, 1),
        {"weeks": [_week(1, [_session("Push", "2026-01-05", [
            _exercise("bench", [_logged_set(1, 100, 10)], skipped=True),
        ])])]},
    )
    assert collect_exercise_history([meso], "bench") == []


def test_session_with_no_logged_sets_excluded():
    meso = _meso(
        "m1", "Block 1", date(2026, 1, 1),
        {"weeks": [_week(1, [_session("Push", None, [
            _exercise("bench", [
                {"set_num": 1, "weight": None, "reps": None, "logged": False},
            ]),
        ])])]},
    )
    assert collect_exercise_history([meso], "bench") == []


def test_skipped_set_excluded_from_logged_list():
    meso = _meso(
        "m1", "Block 1", date(2026, 1, 1),
        {"weeks": [_week(1, [_session("Push", "2026-01-05", [
            _exercise("bench", [
                _logged_set(1, 100, 10),
                {**_logged_set(2, 100, 0), "skipped": True},
                _logged_set(3, 100, 8),
            ]),
        ])])]},
    )
    out = collect_exercise_history([meso], "bench")
    assert [s["set_num"] for s in out[0]["sets"]] == [1, 3]
