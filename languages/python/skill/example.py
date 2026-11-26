"""
Author: Perijn Huijser
Summary: Retry a flaky network call with a bounded backoff.

Description:
    call_with_retry runs a fetch function and tries it again when it fails
    with a transient error. The attempt limit is yours to pick with Budget;
    the RetryReport it hands back tells you what actually happened.

    Quickstart — wrap the real call once at the request layer:

        from example import Budget, call_with_retry

        report = call_with_retry(fetch_status, Budget.FAST)
        if report.ok:
            render(report.summary)
        else:
            log.warning("status unavailable", error=report.last_error)

    A failed report still carries last_error, so log it, never discard it.
    Callers with a human waiting use Budget.FAST; batch jobs that can
    afford to block for about 45 s use Budget.PATIENT.

Changelog:
    2026-08: Added Budget.ONCE for callers that only log.
"""

import time
from enum import Enum

#: Seconds to wait between attempts. The network team's dashboard times
#: out at 10 s; waiting longer risks a second timeout stacking on the first.
#: Range 1..9. Change only together with the dashboard timeout.
ATTEMPT_INTERVAL_SECONDS = 5.0


class Budget(Enum):
    """
    Pick how many attempts one call may spend.

    Chosen by caller patience, never by the callee. The value is read once
    per call, so one Budget can be shared everywhere.

    Example:
        HTTP handler with a user waiting   -> Budget.FAST
        nightly reconciliation job          -> Budget.PATIENT
        fire-and-forget analytics ping      -> Budget.ONCE
    """

    ONCE = 1  # No retries: callers that only log the outcome anyway.
    FAST = 3  # Two retries: interactive callers waiting on the result.
    PATIENT = 10  # Nine retries: batch jobs, no human on the other end.


class TransientNetworkError(Exception):
    """
    Raise from a fetch function to ask for a retry.

    Any other exception is a permanent failure; call_with_retry lets it
    propagate instead of burning the budget on it.
    """


class RetryReport:
    """
    Outcome of one call_with_retry run; read-only once the call returns.

    Obtained from call_with_retry and nothing else — constructing it by
    hand misrepresents a run that never happened. It holds no connection or
    timer, so it is safe to keep, share between threads, and read later.

    Attributes:
        ok: True when any attempt succeeded.
        attempts: Attempts actually spent, 1 up to the Budget.
        last_error: The final attempt's failure; None when ok.
        summary: The successful return value of the wrapped function;
            None when not ok.

    Example:
        report = call_with_retry(fetch_status, Budget.FAST)
        print(report.attempts, report.ok, report.last_error)
        # 2 True None      <- first attempt timed out, second succeeded
    """

    def __init__(self, ok: bool, attempts: int, last_error, summary) -> None:
        self.ok = ok
        self.attempts = attempts
        self.last_error = last_error
        self.summary = summary


def call_with_retry(fetch, budget: Budget) -> RetryReport:
    """
    Run fetch, retrying transient failures within the budget.

    Parameters:
        fetch (in): Zero-argument callable performing the network call.
            Must be safe to call more than once without side effects —
            POST writes are not. Raise TransientNetworkError to request a
            retry; any other exception aborts and propagates unchanged.
        budget (in): Attempts allowed; see Budget.

    Returns:
        A RetryReport, always. ok is True when some attempt returned; when
        every attempt failed, ok is False and last_error carries the final
        failure. A fetch exception that is not TransientNetworkError is not
        a network condition and propagates out of this function unchanged.

    Concurrency:
        Safe from any thread; the function shares no state between calls.

    Example:
        report = call_with_retry(fetch_status, Budget.ONCE)
        if not report.ok:
            log.warning("status unavailable", error=report.last_error)

    Notes:
        Waits ATTEMPT_INTERVAL_SECONDS between attempts, so Budget.PATIENT
        can block for about 45 s.
    """

    last_error = None
    for attempt in range(1, budget.value + 1):
        try:
            return RetryReport(True, attempt, None, fetch())
        except TransientNetworkError as error:
            last_error = error
            if attempt < budget.value:
                time.sleep(ATTEMPT_INTERVAL_SECONDS)
    return RetryReport(False, budget.value, last_error, None)
