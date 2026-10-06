"""In-process failed-login throttling.

The API runs as a single uvicorn process, so an in-memory counter is enough.
Keys are client IPs; behind Caddy that requires uvicorn's proxy-header
handling (see backend/Dockerfile), otherwise every request would appear to
come from the proxy and share one bucket.
"""

import math
import time
from collections import deque
from collections.abc import Callable


class FailedAttemptLimiter:
    """Allow at most ``max_failures`` failures per key in a sliding window."""

    def __init__(
        self,
        max_failures: int,
        window_seconds: float,
        *,
        max_keys: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._clock = clock
        self._failures: dict[str, deque[float]] = {}

    def _prune(self, key: str, now: float) -> deque[float] | None:
        failures = self._failures.get(key)
        if failures is None:
            return None
        cutoff = now - self.window_seconds
        while failures and failures[0] <= cutoff:
            failures.popleft()
        if not failures:
            del self._failures[key]
            return None
        return failures

    def retry_after(self, key: str) -> int:
        """Seconds until ``key`` may try again; 0 if it may try now."""
        now = self._clock()
        failures = self._prune(key, now)
        if failures is None or len(failures) < self.max_failures:
            return 0
        return max(1, math.ceil(failures[0] + self.window_seconds - now))

    def record_failure(self, key: str) -> None:
        now = self._clock()
        failures = self._prune(key, now)
        if failures is None:
            if len(self._failures) >= self.max_keys:
                self._evict(now)
            failures = self._failures[key] = deque()
        failures.append(now)

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)

    def clear(self) -> None:
        self._failures.clear()

    def _evict(self, now: float) -> None:
        # Bound memory under a flood of distinct keys: drop expired entries,
        # then the least recently inserted ones.
        for key in list(self._failures):
            self._prune(key, now)
        while len(self._failures) >= self.max_keys:
            del self._failures[next(iter(self._failures))]


# 10 failed logins per client IP per minute, then 429 until the window frees up.
login_limiter = FailedAttemptLimiter(max_failures=10, window_seconds=60)
