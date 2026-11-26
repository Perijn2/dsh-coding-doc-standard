--- Author: Perijn Huijser
--- Summary: Retry a flaky call with a bounded backoff.
---
--- Description:
---     call_with_retry runs a fetch function and tries it again when the
---     fetch reports a transient failure. The attempt limit is yours to
---     pick with Budget; the report it hands back says what happened.
---
---     Quickstart — wrap the real call once at the request layer:
---
---         local M = require("example")
---         local report = M.call_with_retry(fetch_status, M.BUDGET_FAST)
---         if report.ok then
---             render(report.summary)
---         else
---             log.warn("status unavailable", report.last_error)
---         end
---
---     A failed report still carries last_error, so log it, never discard
---     it. Callers with a human waiting use BUDGET_FAST; batch jobs that
---     can afford to block for about 45 s use BUDGET_PATIENT.
---
--- Changelog:
---     2026-08: Added BUDGET_ONCE for callers that only log.

local M = {}

--- Seconds to wait between attempts; range 1..9. The dashboard times out
--- at 10 s; waiting longer stacks a second timeout on the first. Change
--- only together with the dashboard timeout.
M.ATTEMPT_INTERVAL_SECONDS = 5.0

--- How many attempts one call may spend, chosen by caller patience.
--- @class Budget
--- @field BUDGET_ONCE 1: no retries, for callers that only log the outcome
--- @field BUDGET_FAST 3: two retries, for interactive callers waiting on the result
--- @field BUDGET_PATIENT 10: nine retries, for batch jobs with no human waiting
M.BUDGET_ONCE = 1
M.BUDGET_FAST = 3
M.BUDGET_PATIENT = 10

--- Outcome of one call_with_retry run; read-only once the call returns.
--- Obtained from call_with_retry and nothing else; a report is safe to
--- keep and read later, it holds no live connection.
--- @class RetryReport
--- @field ok boolean: true when any attempt succeeded
--- @field attempts integer: attempts actually spent, 1 up to the budget
--- @field last_error string|nil: the final attempt's failure, nil when ok
--- @field summary string|nil: the fetch's value when ok, nil otherwise
---
--- Example:
---     local report = M.call_with_retry(fetch_status, M.BUDGET_FAST)
---     print(report.attempts, report.ok)  -- 2  true  (first attempt timed out)

--- Sleep without a socket library dependency.
--- @param seconds (in) number: seconds to block
local function sleep(seconds)
	local target = os.clock() + seconds
	repeat until os.clock() >= target
end

--- Run fetch, retrying transient failures within the budget.
---
--- The fetch contract: return `value` on success, or `nil, error_text` on
--- failure. Retry is requested by starting error_text with "transient:";
--- any other error text is permanent and aborts the run.
---
--- @param fetch   (in) function:     zero-argument callable, safe to call twice
--- @param budget  (in) Budget:       attempts allowed, one of the BUDGET_* values
---
--- @return RetryReport: ok true when some attempt returned; when every
---   attempt failed, ok is false and last_error carries the final failure.
---   This function never raises.
---
--- Concurrency: shares no state between calls.
---
--- Example:
---     local report = M.call_with_retry(fetch_status, M.BUDGET_ONCE)
---     if not report.ok then
---         log.warn("status unavailable", report.last_error)
---     end
---
--- Notes:
---     Waits ATTEMPT_INTERVAL_SECONDS between attempts, so BUDGET_PATIENT
---     can block for about 45 s.
function M.call_with_retry(fetch, budget)
	local last_error = nil
	for attempt = 1, budget do
		local value, error_text = fetch()
		if value ~= nil then
			return { ok = true, attempts = attempt, last_error = nil, summary = value }
		end
		last_error = error_text
		if error_text == nil or not error_text:find("^transient:") then
			return { ok = false, attempts = attempt, last_error = error_text, summary = nil }
		end
		if attempt < budget then
			sleep(M.ATTEMPT_INTERVAL_SECONDS)
		end
	end
	return { ok = false, attempts = budget, last_error = last_error, summary = nil }
end

return M
