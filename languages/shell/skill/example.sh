#!/usr/bin/env bash
# Author: Perijn Huijser
# Summary: Fetch a status report, retrying failures within a bounded budget.
#
# Description:
#     call_with_retry runs a command and tries it again when the command
#     fails. The caller picks the attempt limit with the ATTEMPT_BUDGET
#     variable; the report file says what happened.
#
#     Quickstart — wrap the real call once in a cron entry:
#
#         ATTEMPT_BUDGET=3 call_with_retry fetch-status report.txt
#         if [ $? -eq 0 ]; then
#             render report.txt
#         fi
#
#     A failed run still leaves the last error in the report file, so
#     log it, never discard it. Interactive callers use ATTEMPT_BUDGET=3;
#     batch jobs that can afford to block use ATTEMPT_BUDGET=10.
#
# Changelog:
#     2026-08: Added ATTEMPT_BUDGET=1 for jobs that only log.

# ATTEMPT_INTERVAL_SECONDS is the wait between attempts; range 1..9. The
# dashboard times out at 10 s; waiting longer stacks a second timeout on
# the first. Change only together with the dashboard timeout.
ATTEMPT_INTERVAL_SECONDS=5

# ATTEMPT_BUDGET is the number of tries one run may spend, at least one.
ATTEMPT_BUDGET=3

# Report file where the last error of a failed run is written.
REPORT_FILE=./status-report.txt

# Fetch the status and write it to REPORT_FILE; prints the value on success.
# Takes no arguments; reads the endpoint from STATUS_URL; exits 0 on the
# first success and 1 when the endpoint answers badly.
fetch_status() {
	local value
	value=$(curl -fsS "$STATUS_URL") || return 1
	printf '%s\n' "$value" >"$REPORT_FILE"
	printf '%s\n' "$value"
}

# Run the given command, retrying failures within ATTEMPT_BUDGET.
# $1 is the command name with its arguments; the run waits
# ATTEMPT_INTERVAL_SECONDS between tries and exits 0 when any try
# succeeded, 1 when every try failed and the last error is in REPORT_FILE.
#
# Example:
#     call_with_retry fetch_status   # exit 0 (second try succeeded)
call_with_retry() {
	local attempt=1
	while [ "$attempt" -le "$ATTEMPT_BUDGET" ]; do
		if "$@"; then
			return 0
		fi
		printf 'attempt %s failed: %s\n' "$attempt" "$*" >>"$REPORT_FILE"
		if [ "$attempt" -lt "$ATTEMPT_BUDGET" ]; then
			sleep "$ATTEMPT_INTERVAL_SECONDS"
		fi
		attempt=$((attempt + 1))
	done
	return 1
}
