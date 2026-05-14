"""Tests for domain constants (weight increments)."""

from app.domain.constants import WEIGHT_INCREMENTS


class TestWeightIncrements:
    def test_all_equipment_types_present(self):
        expected = {"barbell", "dumbbell", "machine", "cable", "bodyweight"}
        assert set(WEIGHT_INCREMENTS.keys()) == expected

    def test_bodyweight_has_zero_increment(self):
        assert WEIGHT_INCREMENTS["bodyweight"] == 0.0

    def test_all_increments_non_negative(self):
        for equip, incr in WEIGHT_INCREMENTS.items():
            assert incr >= 0, f"{equip} has negative increment {incr}"
