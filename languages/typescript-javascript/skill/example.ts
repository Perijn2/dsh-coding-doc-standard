/**
 * @module example
 * @author Perijn Huijser
 * Retry a flaky async call with a bounded backoff.
 *
 * @remarks
 * callWithRetry runs a fetch function and tries it again when it fails
 * with a transient error. The attempt limit is yours to pick with Budget;
 * the RetryReport it hands back tells you what actually happened.
 *
 * Quickstart — wrap the real call once at the request layer:
 *
 * ```ts
 * const report = await callWithRetry(fetchStatus, Budget.Fast);
 * if (report.ok) {
 * 	render(report.summary);
 * } else {
 * 	log.warn("status unavailable", report.lastError);
 * }
 * ```
 *
 * A failed report still carries lastError, so log it, never discard it.
 * Callers with a human waiting use Budget.Fast; batch jobs that can
 * afford to wait about 45 s use Budget.Patient.
 */

/** Seconds to wait between attempts. The dashboard times out at 10 s; waiting longer stacks a second timeout on the first. Range 1..9; change only together with the dashboard timeout. */
export const ATTEMPT_INTERVAL_SECONDS = 5;

/**
 * Pick how many attempts one call may spend. Chosen by caller patience,
 * never by the callee.
 *
 * @example
 * ```ts
 * // HTTP handler with a user waiting  -> Budget.Fast
 * // nightly reconciliation job         -> Budget.Patient
 * // fire-and-forget analytics ping     -> Budget.Once
 * ```
 */
export enum Budget {
	/** No retries: callers that only log the outcome anyway. */
	Once = 1,
	/** Two retries: interactive callers waiting on the result. */
	Fast = 3,
	/** Nine retries: batch jobs, no human on the other end. */
	Patient = 10,
}

/** Raise from a fetch function to ask for a retry; any other error is permanent and propagates. */
export class TransientNetworkError extends Error {}

/**
 * Outcome of one callWithRetry run; treat it as read-only after the await
 * resolves. Obtained from callWithRetry and nothing else — building one by
 * hand misrepresents a run that never happened.
 */
export interface RetryReport {
	/** True when some attempt succeeded. */
	ok: boolean;
	/** Attempts actually spent, 1 up to the Budget. */
	attempts: number;
	/** The final attempt's failure; null when ok. */
	lastError: unknown;
	/** The successful return value of the wrapped function; null when not ok. */
	summary: string | null;
}

/**
 * Run fetch, retrying transient failures within the budget.
 *
 * @param fetch (in) - Zero-argument async callable performing the call.
 * Must be safe to call more than once without side effects — POST writes
 * are not. Throw TransientNetworkError to request a retry.
 * @param budget (in) - Attempts allowed; see Budget.
 *
 * @returns A promise resolving to a RetryReport. ok is true when some
 * attempt returned; when every attempt failed, ok is false and lastError
 * carries the final failure. A non-transient error rejects the promise
 * unchanged, because a permanent failure is the caller's bug to see.
 *
 * @throws Only for non-transient errors; transient exhaustion always
 * resolves to a failed report.
 *
 * @example
 * ```ts
 * const report = await callWithRetry(fetchStatus, Budget.Once);
 * if (!report.ok) log.warn("status unavailable", report.lastError);
 * ```
 */
export async function callWithRetry(
	fetch: () => Promise<string>,
	budget: Budget,
): Promise<RetryReport> {
	let lastError: unknown = null;
	for (let attempt = 1; attempt <= budget; attempt += 1) {
		try {
			return {
				ok: true,
				attempts: attempt,
				lastError: null,
				summary: await fetch(),
			};
		} catch (error) {
			if (!(error instanceof TransientNetworkError)) throw error;
			lastError = error;
			if (attempt < budget) {
				await new Promise((resolve) =>
					setTimeout(resolve, ATTEMPT_INTERVAL_SECONDS * 1000),
				);
			}
		}
	}
	return { ok: false, attempts: budget, lastError, summary: null };
}
