# Author: Perijn Huijser
# Summary: Retry a flaky status fetch with a bounded backoff.
#
# Description:
#   RetryClient#call_with_retry runs a block and tries it again when the
#   block reports a transient failure. The caller picks the attempt limit
#   with a Budget constant; the report hash it hands back says what
#   happened.
#
#   Quickstart — wrap the real call once at the request layer:
#
#     client = RetryClient.new("https://status.example")
#     report = client.call_with_retry(RetryClient::BUDGET_FAST) { fetch_status }
#     if report[:ok]
#       render(report[:summary])
#     else
#       log.warn("status unavailable", report[:last_error])
#     end
#
#   A failed report still carries :last_error, so log it, never discard
#   it. Callers with a human waiting use BUDGET_FAST; batch jobs that can
#   afford to block for about 45 s use BUDGET_PATIENT.
#
# Changelog:
#   2026-08: Added BUDGET_ONCE for callers that only log.

# Retries flaky status fetches against one endpoint within a bounded budget.
# Build one client per endpoint with RetryClient.new and share it; the client
# holds no live connection between calls.
class RetryClient
  # Seconds to wait between attempts; range 1..9. The dashboard times out
  # at 10 s; waiting longer stacks a second timeout on the first. Change
  # only together with the dashboard timeout.
  ATTEMPT_INTERVAL_SECONDS = 5.0

  # Attempts one call may spend, chosen by caller patience: BUDGET_ONCE
  # for callers that only log, BUDGET_FAST for interactive callers,
  # BUDGET_PATIENT for batch jobs with no human waiting.
  BUDGET_ONCE = 1
  BUDGET_FAST = 3
  BUDGET_PATIENT = 10

  # Build a client that fetches from the given base URL. The URL is only
  # remembered; no request is made until a call runs.
  def initialize(base_url)
    @base_url = base_url
  end

  # The endpoint one fetch would hit for the given path. Pure string
  # joining; never raises.
  def endpoint_for(path)
    "#{@base_url}#{path}"
  end

  # Run the block, retrying transient failures within the budget.
  #
  # The block contract: return the value on success, or raise
  # RetryClient::Transient for a failure worth retrying; any other
  # exception is permanent and aborts the run. Returns a report hash:
  # :ok true when some attempt returned; when every attempt failed, :ok
  # is false and :last_error carries the final failure. Never raises on
  # its own account.
  #
  # Example:
  #   report = client.call_with_retry(RetryClient::BUDGET_ONCE) { fetch_status }
  #   log.warn("status unavailable", report[:last_error]) unless report[:ok]
  #
  # Notes:
  #   Waits ATTEMPT_INTERVAL_SECONDS between attempts, so BUDGET_PATIENT
  #   can block for about 45 s.
  def call_with_retry(budget)
    last_error = nil
    attempts = budget < 1 ? 1 : budget
    attempts.times do |attempt|
      begin
        value = yield
        return { ok: true, attempts: attempt + 1, last_error: nil, summary: value }
      rescue Transient => e
        last_error = e
      end
      sleep(ATTEMPT_INTERVAL_SECONDS) if attempt + 1 < attempts
    end
    { ok: false, attempts: attempts, last_error: last_error, summary: nil }
  end

  # Raised by a fetch block for a failure worth retrying; anything else
  # aborts call_with_retry immediately.
  class Transient < StandardError
  end
end
