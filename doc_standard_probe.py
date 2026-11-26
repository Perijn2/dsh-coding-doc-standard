"""
Author: Perijn Huijser
Summary: Retry fallible jobs with bounded backoff and a per-client rate limit.

Description:
    JobQueue runs zero-argument jobs that may fail transiently, retrying
    them within a Budget while keeping each client inside a RateWindow.

    Design rationale: retries use full-jitter exponential backoff because a
    fleet retrying after the same outage must not fire in lockstep; the
    sliding RateWindow keeps one hot client from starving the others. See
    the project's decision records for the background.

    Quickstart:

        queue = JobQueue(Budget.FAST)
        report = queue.run(fetch_status, client="web")
        if not report.ok:
            log.warning("job failed", error=report.last_error)

    Jobs raise TransientError to ask for a retry; anything else is permanent
    and propagates out of run unchanged.

Changelog:
    2026-08: Added RateWindow so one hot client cannot starve the others.
"""

from __future__ import annotations

import random
import re
import time
from dataclasses import dataclass
from enum import Enum

#: Base of the exponential backoff, in seconds. Range 0.001..60. The
#: dashboard times out at 10 s, so a large base risks a second timeout
#: stacking on the first. Change only together with the dashboard timeout.
ATTEMPT_INTERVAL_SECONDS = 1.0

#: Hard ceiling for one computed backoff delay, in seconds. Range 0..3600.
#: Keeps a PATIENT budget from blocking a worker for minutes at once.
MAX_BACKOFF_SECONDS = 8.0

#: Longest label parse_label accepts; longer input is truncated, never
#: trusted. Range 1..4096.
MAX_LABEL_LENGTH = 64


class TransientError(Exception):
    """
    Raise from a job to ask the queue for a retry.

    Any other exception is permanent: run lets it propagate instead of
    burning the budget on it.
    """


class Budget(Enum):
    """
    How many attempts one job may spend.

    Chosen by caller patience, never by the callee.

    Example:
        interactive request  -> Budget.FAST
        nightly batch job    -> Budget.PATIENT
        analytics ping       -> Budget.ONCE
    """

    ONCE = 1  # Fire-and-forget: the caller only logs the outcome.
    FAST = 3  # Two retries: interactive callers waiting on the result.
    PATIENT = 10  # Nine retries: batch jobs, no human on the other end.


@dataclass
class JobReport:
    """
    Outcome of one JobQueue.run; read-only once the call returns.

    Attributes:
        ok: True when some attempt returned.
        attempts: Attempts actually spent, 1 up to the Budget.
        last_error: The final attempt's failure; None when ok.
        result: The job's return value; None when not ok.
    """

    ok: bool
    attempts: int
    last_error: BaseException | None
    result: object = None


def parse_label(raw: str) -> str:
    """
    Normalize an untrusted label received from the wire.

    Trust boundary: raw is untrusted input. Only [a-z0-9-] survives, input
    longer than MAX_LABEL_LENGTH is truncated, and the result is always a
    safe stage key, never raw bytes.

    Parameters:
        raw (in) str: untrusted label, decoded as UTF-8 by the caller.

    Returns:
        The normalized label in [a-z0-9-]; empty string when nothing usable
        remains. Never raises.

    Example:
        >>> parse_label("Status-01!")
        'status-01'
        >>> parse_label("?!")
        ''
    """

    cleaned = re.sub(r"[^a-z0-9-]", "", raw.lower())[:MAX_LABEL_LENGTH]
    return cleaned


class RateWindow:
    """
    Sliding one-minute request window for one client.

    Create one per client and keep it for the client's session. Not
    thread-safe: one window per worker thread.

    Attributes:
        limit: Maximum allowed requests per window.

    Example:
        window = RateWindow(limit=2)
        window.allow()  # True
        window.allow()  # True
        window.allow()  # False, window full
    """

    def __init__(self, limit: int) -> None:
        self.limit = limit
        self._stamps: list[float] = []

    def allow(self) -> bool:
        """
        Record one request and report whether it fits the window.

        Returns:
            True when this request fits, False when the window is already
            full. Never raises.

        Example:
            >>> window = RateWindow(limit=1)
            >>> window.allow()
            True
            >>> window.allow()
            False
        """

        now = time.monotonic()
        self._stamps = [stamp for stamp in self._stamps if now - stamp < 60.0]

        if len(self._stamps) >= self.limit:
            return False

        self._stamps.append(now)
        return True


def compute_backoff(attempt: int, base: float, cap: float) -> float:
    """
    Return the delay in seconds before the next retry.

    Parameters:
        attempt (in) int: 1-based number of the attempt that just failed.
        base (in) float: delay multiplier in seconds; range 0.001..60.
        cap (in) float: hard ceiling in seconds; range 0..3600.

    Returns:
        Delay in seconds, always within [0, cap]. Never raises.

    Example:
        >>> 0.0 <= compute_backoff(3, base=0.5, cap=8.0) <= 2.0
        True
    """

    # Exponential growth: attempt 1 waits base, each next attempt doubles.
    delay = base * (2 ** (attempt - 1))

    # The cap bounds one job's worst-case wait; without it a PATIENT budget
    # could block a worker for minutes.
    delay = min(delay, cap)

    # Full jitter spreads retries over [0, delay] so a fleet retrying after
    # the same outage does not fire in lockstep (thundering herd).
    return random.uniform(0.0, delay)


class JobQueue:
    """
    Retry fallible jobs within a budget, rate-limited per client.

    One queue per worker thread; the queue is not thread-safe because it
    stores attempt timestamps.

    Attributes:
        budget: Attempts allowed per job; see Budget.
        windows: Per-client RateWindow registry, keyed by client name.

    Example:
        queue = JobQueue(Budget.ONCE)
        queue.run(lambda: 42, client="demo").result
        # 42
    """

    def __init__(
        self, budget: Budget, windows: dict[str, RateWindow] | None = None
    ) -> None:
        self.budget = budget
        self.windows = windows if windows is not None else {}

    def run(self, job, client: str = "default") -> JobReport:
        """
        Run job, retrying TransientError within the budget.

        Parameters:
            job (in): Zero-argument callable. Must be safe to call more
                than once; POST writes are not. Raise TransientError to
                request a retry.
            client (in) str: RateWindow key. A full window makes run return
                a not-ok report immediately without calling job.

        Returns:
            A JobReport, always. ok is True when some attempt returned;
            when every attempt raised TransientError, ok is False and
            last_error carries the final failure. A non-transient
            exception propagates out of run unchanged.

        Example:
            >>> queue = JobQueue(Budget.FAST)
            >>> calls = []
            >>> def flaky():
            ...     calls.append(1)
            ...     if len(calls) < 2:
            ...         raise TransientError("try again")
            ...     return "done"
            >>> report = queue.run(flaky)
            >>> report.ok, report.attempts, report.result
            (True, 2, 'done')
        """

        window = self.windows.setdefault(client, RateWindow(limit=30))

        if not window.allow():
            return JobReport(False, 0, RuntimeError("rate limited"), None)

        last_error: BaseException | None = None

        for attempt in range(1, self.budget.value + 1):
            try:
                return JobReport(True, attempt, None, job())
            except TransientError as error:
                last_error = error

                # Jittered backoff between attempts; see compute_backoff for
                # why each step exists. attempt stays 1-based here, matching
                # the docstring contract.
                if attempt < self.budget.value:
                    time.sleep(
                        compute_backoff(
                            attempt, ATTEMPT_INTERVAL_SECONDS, MAX_BACKOFF_SECONDS
                        )
                    )

        return JobReport(False, self.budget.value, last_error, None)


def main(argv: list[str]) -> int:
    """
    Run one demo job from the command line.

    Invoke as `python doc_standard_probe.py`. Prints one status line to
    stdout and returns 0 when the demo job succeeded, 1 when it exhausted
    the budget. Reads no files and no environment.

    Example:
        $ python doc_standard_probe.py
        ok after 2 attempts
        $ echo $?
        0
    """

    calls = 0

    def _demo_job() -> str:
        nonlocal calls
        calls += 1

        if calls < 2:
            raise TransientError("simulated flake")

        return "done"

    report = JobQueue(Budget.FAST).run(_demo_job)

    if report.ok:
        print(f"ok after {report.attempts} attempts")
        return 0

    print(f"failed after {report.attempts} attempts: {report.last_error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main([]))
