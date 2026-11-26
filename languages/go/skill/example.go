// Author: Perijn Huijser
// Summary: Retry a flaky status fetch with a bounded backoff.
//
// Description:
//     CallWithRetry runs a fetch function and tries it again when the
//     fetch reports a failure. The caller picks the attempt limit with
//     Budget; the Report it hands back says what happened.
//
//     Quickstart — wrap the real call once at the request layer:
//
//         report := status.CallWithRetry(FetchStatus, BudgetFast())
//         if report.OK {
//             render(report.Summary)
//         }
//
//     A failed report still carries LastError, so log it, never discard
//     it. Callers with a human waiting use BudgetFast; batch jobs that
//     can afford to block use BudgetPatient.
//
// Changelog:
//     2026-08: Added BudgetOnce for callers that only log.

// Package status retries flaky status fetches with a bounded backoff.
package status

import "time"

// Budget caps how many attempts one call may spend, and how long it
// waits between them.
type Budget struct {
	// Attempts is the number of tries allowed; a value below one means one.
	Attempts int
	// Interval is the wait between attempts; keep it under the 10 s
	// dashboard timeout so a second timeout never stacks on the first.
	Interval time.Duration
}

// BudgetOnce returns the no-retry budget for callers that only log.
func BudgetOnce() Budget { return Budget{Attempts: 1} }

// BudgetFast returns the interactive budget: two retries, about 10 s.
func BudgetFast() Budget { return Budget{Attempts: 3, Interval: 5 * time.Second} }

// AttemptsOrDefault returns the attempt count, treating a zero budget as
// a single try.
func (b Budget) AttemptsOrDefault() int {
	if b.Attempts < 1 {
		return 1
	}
	return b.Attempts
}

// Report is the outcome of one CallWithRetry run; read-only once the call
// returns, and safe to keep because it holds no live connection.
type Report struct {
	// OK is true when any attempt succeeded.
	OK bool
	// Attempts counts the tries actually spent.
	Attempts int
	// Summary carries the fetch's value when OK is true, else "".
	Summary string
	// LastError carries the final attempt's failure when OK is false.
	LastError error
}

// CallWithRetry runs fetch, retrying failures within the budget. The
// fetch contract: return (value, nil) on success or ("", err) on
// failure; every error is treated as transient. The call never panics
// on its own — a spent budget yields a failed Report, not an error.
//
//     report := CallWithRetry(FetchStatus, BudgetOnce())
//     if !report.OK {
//         log.Warn("status unavailable", report.LastError)
//     }
func CallWithRetry(fetch func() (string, error), budget Budget) Report {
	attempts := budget.AttemptsOrDefault()
	report := Report{Attempts: attempts}
	for attempt := 1; attempt <= attempts; attempt++ {
		value, err := fetch()
		if err == nil {
			return Report{OK: true, Attempts: attempt, Summary: value}
		}
		report.LastError = err
		if attempt < attempts {
			time.Sleep(budget.Interval)
		}
	}
	return report
}
