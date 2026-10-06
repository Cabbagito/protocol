"""FailedAttemptLimiter: sliding window, reset, bounded memory."""

from app.core.rate_limit import FailedAttemptLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def _limiter(clock: FakeClock, **kwargs) -> FailedAttemptLimiter:
    return FailedAttemptLimiter(max_failures=3, window_seconds=60, clock=clock, **kwargs)


def test_blocks_after_max_failures_within_window():
    clock = FakeClock()
    limiter = _limiter(clock)
    for _ in range(2):
        limiter.record_failure("ip")
    assert limiter.retry_after("ip") == 0
    limiter.record_failure("ip")
    assert limiter.retry_after("ip") == 60


def test_window_slides():
    clock = FakeClock()
    limiter = _limiter(clock)
    limiter.record_failure("ip")
    clock.now += 30
    limiter.record_failure("ip")
    limiter.record_failure("ip")
    # Oldest failure expires 30s from now.
    assert limiter.retry_after("ip") == 30
    clock.now += 30
    assert limiter.retry_after("ip") == 0


def test_keys_are_independent_and_reset_clears():
    clock = FakeClock()
    limiter = _limiter(clock)
    for _ in range(3):
        limiter.record_failure("a")
    assert limiter.retry_after("a") > 0
    assert limiter.retry_after("b") == 0
    limiter.reset("a")
    assert limiter.retry_after("a") == 0


def test_memory_is_bounded():
    clock = FakeClock()
    limiter = _limiter(clock, max_keys=5)
    for i in range(50):
        limiter.record_failure(f"ip-{i}")
    assert len(limiter._failures) <= 5
    assert "ip-49" in limiter._failures
