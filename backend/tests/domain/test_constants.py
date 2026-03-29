"""Tests for domain constants (RIR schemes, weight increments)."""

from app.domain.constants import RIR_SCHEMES, WEIGHT_INCREMENTS


class TestRirSchemes:
    def test_all_schemes_end_with_deload(self):
        """Every scheme's last week should be a deload (RiR = -1)."""
        for weeks, scheme in RIR_SCHEMES.items():
            assert scheme[-1] == -1, f"{weeks}-week scheme doesn't end with deload"

    def test_scheme_length_matches_week_count(self):
        for weeks, scheme in RIR_SCHEMES.items():
            assert len(scheme) == weeks, f"{weeks}-week scheme has {len(scheme)} entries"

    def test_schemes_cover_3_to_8_weeks(self):
        assert set(RIR_SCHEMES.keys()) == {3, 4, 5, 6, 7, 8}

    def test_rir_values_descend_toward_deload(self):
        """RiR should generally decrease across weeks (non-strict, allows plateaus)."""
        for weeks, scheme in RIR_SCHEMES.items():
            for i in range(1, len(scheme)):
                assert scheme[i] <= scheme[i - 1], (
                    f"{weeks}-week scheme: week {i + 1} RiR ({scheme[i]}) > "
                    f"week {i} RiR ({scheme[i - 1]})"
                )


class TestWeightIncrements:
    def test_all_equipment_types_present(self):
        expected = {"barbell", "dumbbell", "machine", "cable", "bodyweight"}
        assert set(WEIGHT_INCREMENTS.keys()) == expected

    def test_bodyweight_has_zero_increment(self):
        assert WEIGHT_INCREMENTS["bodyweight"] == 0.0

    def test_all_increments_non_negative(self):
        for equip, incr in WEIGHT_INCREMENTS.items():
            assert incr >= 0, f"{equip} has negative increment {incr}"
