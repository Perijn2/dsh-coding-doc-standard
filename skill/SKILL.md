---
name: coding-doc-standard
description: >-
  Read this before writing or editing ANY source file. It defines what must be
  documented — file headers, functions, classes, structs, enums, constants,
  entry points — the universal document skeleton, the prose and layout
  grammar, and worked-out examples with copy-pastable code for every kind.
  The pack skill coding-doc-standard-<pack> shows the native syntax.
---

# Coding Documentation Standard

Author: Perijn Huijser

Documentation is part of the code you are about to write, not a pass you make
after it. Read this skill before your first write of a session, then load the
pack skill for your language and write the documentation in the same draft as
the code.

## Scope

This standard governs in-code **reference** documentation: the file header and
the document attached to every public unit. Tutorials and how-to guides are
narrative documentation and live in the project's docs, not in code. Design
rationale — the "why" — belongs in the module Description and in decision
records (ADRs), not scattered through function bodies. (The reference /
explanation / how-to split is the Diátaxis model.)

## The facts rule

Absolute, enforced, no exceptions. Every documented fact — the author, what
code does, what a parameter means, when each result comes back, how it fails,
what an example shows — must be established from the code, its tests, its
configuration, or the user before you write it down. A fact you cannot
establish is a question for the user, never a sentence you invent.
Placeholders, hedging, and plausible filler violate this rule.

## What gets documented

Document anything a reader must know to call, feed, configure, or handle the
code correctly. A script is not only its functions:

| Thing | Its document must carry |
| --- | --- |
| **File** | A header: Author, Summary, optional Description, optional Changelog. |
| **Function / method** | Summary, every parameter with direction, every return case, a runnable example, enrichment. |
| **Class / struct / interface / object type** | What it represents, how an instance is obtained and for how long it stays valid, its meaningful attributes, which members carry the contract, concurrency or lifecycle caveats, and an example of real use. Its public members then follow the function rules. |
| **Enum (and each variant)** | What the choice is for, where a caller picks each variant, and an example of the choice being made — every variant, none silently skipped. |
| **Constant / global value** | What it controls, its unit and range, and who is allowed to change it. |
| **Entry point / CLI / script main** | How it is invoked, what it reads (arguments, environment, files), what it prints or returns, its exit behavior, and one example run with its real output. |
| **Configuration knob** | Accepted values, effect, default, and what breaks when it is wrong. |

The boundary is the reader, not the visibility keyword: a private helper needs
no document, but anything that leaves the file — an exported value, a shape a
caller must match, a protocol the code speaks — does.

Anything the reader *calls* — function, class, entry point — earns at least
one example they could copy-paste as-is, with its real output shown. What
looks trivial to the writer is the reader's fastest way in; nobody ever
complained about too many examples. Where the language has a doctest-style
runner (Python `>>>`, and equivalents), write examples so they execute:
`/coding-doc-verify` runs them, so a wrong output is a bug, not a nit.

## Contracts beyond the summary

These belong in the document of whichever unit they apply to. Each one is
required exactly when it applies, and omitted in silence when it does not —
never an empty placeholder section:

- **Parameter constraints** — when a value must already hold to be passed at
  all, say so on that parameter’s line: a range, a format, “safe to call
  twice”, “must not outlive the handle it came from”. Vulkan attaches its
  Valid Usage rules to exactly this spot because it prevents the most
  misuse.
- **Parameter directions are mandatory** — every parameter entry carries
  `(in)`, `(out)`, or `(in-out)`. A parameter without a direction is a
  contract gap, not a style choice: the reader cannot tell whether the call
  reads or writes it. (Returns are always out, so they carry no marker.)
  Packs that declare parameter sections (the Lua pack’s `@param`) get this
  enforced by the gate; everywhere else it is review-enforced.
- **Parameters carry constraints, not types** — in typed languages the
  signature already names each parameter and its type; the entry adds what
  the signature cannot say: direction, range, format, ownership, side
  effects, “safe to call twice”.
- **One entry per line, aligned columns, blank line between groups** — in a
  Parameters or Returns section, pad name, direction, and type to the
  widest entry so the meanings share one column. A blank documentation line
  is required between the summary and the first entry group and between
  entry groups — tags must never sit directly under the summary line:

  ```java
  /**
  Return the pipeline stage for a label.

  @param label (in) String: the raw request label, any case

  @return String: the stage key, or "unknown" when unmapped; never null
  */
  ```

  ```lua
  --- Adds two integers.
  ---
  --- @param left  (in) number: first operand
  --- @param right (in) number: second operand
  ---
  --- @return number: the sum
  ```
- **Failure channel** — every failure path names where the detail goes: the
  exception type raised, the nil return plus the message API to consult, the
  error field of the result. “Never raises” is itself a channel statement.
- **State after failure** — when a call fails, say what its `(out)` and
  `(in-out)` parameters and the object it touched hold afterwards:
  unchanged, partially written, or valid but closed. Silent about this, and
  every caller guesses.
- **Trust boundaries** — when a unit parses untrusted input or crosses a
  privilege boundary, one line says what is validated, what is trusted, and
  what happens on bad input.
- **Concurrency and call order** — one line when the answer is not obvious:
  “not thread-safe”, “main thread only”, “automatically called by Render()”,
  “call before Begin()”. Pure functions need nothing.
- **Stability status** — mark surface that may still change `Experimental:`,
  and record real-versioned `Since:` and `Deprecated:` facts when they
  exist; `Deprecated:` always names the replacement to call instead. SQLite
  ships whole interfaces marked experimental rather than pretending they are
  settled; do the same instead of hiding the risk.

## File header

One native documentation block at the top of the file (after a shebang when
one exists), fields in this order:

1. **Summary** — required. One line: what this file does, in words a reader
   uses to decide “is this the right module for me?”.
2. **Author** — optional. VCS blame owns authorship, so include it only when
   a file needs a named owner (legal or regulated code). Never guessed — the
   facts rule applies.
3. **Description** — optional expansion, built in this order when present:
   a short paragraph of what and why — including the design rationale when the
   module's shape is not obvious, with a pointer to the decision record
   (ADR) when one exists — then a **copy-pastable quickstart with code**, then
   edge cases and advanced notes a first-time caller needs. A Description
   without at least one code example is not finished.
4. **Changelog** — optional. VCS owns history, so keep it only for externally
   visible API changes a caller must act on (deprecations, breaking changes),
   never for ordinary edits.

## Grammar

- Summaries are imperative: “Normalize the label”, not “This function
  normalizes” or “Normalizes”.
- Plain, easy-to-read words. Technical is fine; fancy and overformal are not.
  Choose each word on purpose.
- Say what the code does for the caller, not how it is implemented line by
  line. “Returns nil when the label is unknown” beats “checks the map”.
- Show, do not describe: a short example with its output replaces a
  paragraph. Explain each example with a one-line comment when the case it
  covers is not obvious.
- Name failure honestly: say when it raises, returns nil, or swallows — and
  why that behavior was chosen.

## Inside a function: algorithmic steps

The unit document states the contract; it never walks the implementation line
by line. The function body carries that second layer, and only where a reader
would otherwise have to reverse-engineer the code:

- **When to comment** — a step whose purpose is not obvious from its code: an
  algorithmic stage (partition, sweep, relaxation), an invariant that must
  hold at that point ("stamps stays sorted by time"), a non-obvious
  complexity choice ("O(n²) is fine: n is the per-client window, bounded by
  limit"), a recovery or fallback path, or a concurrency constraint.
- **What a comment says** — why, not what. "Cap at MAX_BACKOFF_SECONDS so one
  job cannot block a worker for minutes" beats "delay = min(delay, cap)".
  State the invariant, the unit, or the reason; never restate the expression.
  Do not restate the parameter's type — the signature already says it.
- **Where it goes** — above the step it explains, in the language's line
  comment (the token your pack's example file uses), one line when possible,
  with a blank line between consecutive steps. Never a trailing comment on
  the code line, never a commented-out copy of the code.
- **When not to comment** — self-evident statements get nothing. A comment
  that repeats the code rots the moment the code changes, so update or delete
  it in the same change. `TODO`/`FIXME` only with a ticket id, never as a
  silent marker.

Worked example — one function with a real algorithm, documented at its steps:

```python
def compute_backoff(attempt: int, base: float, cap: float) -> float:
    """
    Return the delay in seconds before the next retry.

    Parameters:
        attempt (in): 1-based number of the attempt that just failed.
        base (in): Delay multiplier in seconds; range 0.001..60.
        cap (in): Hard ceiling in seconds; range 0..3600.

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
```

## Layout

Whitespace is part of the document, not decoration: a reader should see where
documentation ends and code begins at a glance.

- Leave one blank line after the file header, before the first statement.
- Leave one blank line after every unit docstring, before the body's first
  statement.
- Separate the sections of a document block with a blank documentation line,
  and put a blank line after an example block before the next section.
- Keep tags and labels on their own line; entries of one group stay adjacent.
- Indent a wrapped line past the tag or label it continues.
- Never use a one-line block for a file, function, or class document.
  One-line blocks are allowed exactly where one line carries the whole
  contract: enum variants, fields, and constant annotations.
- Documentation moves with the code: a rename, signature change, or refactor
  updates the attached document in the same change.
- The opening delimiter sits on its own line and the closing delimiter on
  its own line; the body starts at the block's left margin, so the first
  line aligns with the rest of the text. Never start text immediately after
  the opening quotes.
- Inside a function, separate each documented step (comment plus its code)
  from the next step with a blank line; the comment sits directly above the
  code it explains, with no blank line between comment and code.
- Separate multiple examples with a blank line; keep the comment that
  explains an example attached to its example.
- Character-level formatting belongs to the external formatters; this
  standard never fights them. The blank lines above are exactly the ones the
  pinned formatters preserve, so the gate never rewrites them away.

## Worked examples

### A whole module

One small module, fully documented. Every document exists because a reader
needs it; nothing pads.

```python
"""
Author: Perijn Huijser
Summary: Retry a flaky network call with a bounded backoff.

Description:
    call_with_retry runs a function and tries it again when it fails with
    a transient error. The attempt limit is yours to pick with Budget;
    the RetryReport it hands back tells you what actually happened.

    Quickstart — wrap the real call once at the request layer:

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
    hand misrepresents a run that never happened. Safe to keep and read
    later; it holds no live connection.

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


def call_with_retry(fetch, budget: Budget) -> RetryReport:
    """
    Run fetch, retrying transient failures within the budget.

    Parameters:
        fetch (in): Zero-argument callable performing the network call.
            It must be safe to call more than once without side effects —
            POST writes are not.
        budget (in): Attempts allowed; see Budget.

    Returns:
        A RetryReport, always. ok is True when some attempt returned; when
        every attempt failed, ok is False and last_error carries the final
        failure. A fetch error that is not TransientNetworkError is not a
        network condition and propagates out of this function unchanged.

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
```

### A function with tricky cases

Examples carry the weight when returns are conditional — each distinct case
gets its own example call with its real output:

```python
def slugify(title: str, max_length: int = 40) -> str:
    """
    Turn a human title into a URL slug.

    Parameters:
        title (in): Title in any case and spacing.
        max_length (in): Hard length cap; the slug never cuts mid-word.

    Returns:
        Lowercase, hyphen-separated text. A title with no usable letters
        comes back as "untitled" instead of an empty slug. Never raises.

    Example:
        >>> slugify("Hello, World!")
        'hello-world'

        Cuts at the last whole word fitting the cap.
        >>> slugify("DeepSeek Harness release notes", max_length=12)
        'deepseek'

        Nothing usable in the input.
        >>> slugify("?! 123")
        'untitled'
    """
```

### A class with state and lifecycle

Say where instances come from, what they are valid for, and show the full
round trip:

```python
class RateWindow:
    """
    Track request counts over a sliding one-minute window.

    Create one per client and keep it for the client's session; it stores
    timestamps only, no connection state. Not thread-safe — one window per
    worker thread.

    Attributes:
        limit: Maximum allowed requests per window; set at construction.

    Example:
        window = RateWindow(limit=30)
        window.allow()        # True, request 1 of 30
        # ... 30 requests later ...
        window.allow()        # False, window full
        window.retry_after()  # 18.4 — seconds until the oldest request ages out
    """
```

### A CLI entry point

Invocation, inputs, output, exit behavior, one real run:

```python
def main(argv: list[str]) -> int:
    """
    Probe a URL with the retry loop from the command line.

    Invoke as `python -m netretry [url]`. Reads the URL from argv, falling
    back to the NETRETRY_URL environment variable. Prints one status line
    to stdout; failures go to stderr.

    Exit behavior: 0 when reachable within the fast budget, 1 when not,
    2 when no URL was given.

    Example:
        $ python -m netretry https://status.example
        ok after 2 attempts (291 ms)
        $ echo $?
        0
    """
```

Why these pass where thin documentation fails:

- The header answers “what is this, and how do I start?” before any code is
  read, and its quickstart is copy-pastable as written.
- Every enum variant says what the caller does with it, and the class shows
  where instances come from and what they are valid for.
- The constant carries a unit, a range, and the reason the number is that
  number.
- Conditional returns get one example each, with real output — the cases
  prose tends to forget.
- The failure channel is named exactly: which errors the retry function
  swallows into the report and which propagate, and why each choice was
  made.
- “Concurrency: safe from any thread” answers the question the reader of a
  shared helper always asks, in four words.
- “Returns … always / never raises, because …” covers every return case and
  the intent behind it.

## Declaration naming

Language profiles may declare source-backed naming rules alongside documentation
rules. Read the language skill's embedded Declaration naming section for its
required casing, examples, selected guide and exact check/block scope. The same
guide is linked in the profile's `naming.source`; the write gate
checks captured declaration names and blocks violations with the expected casing
and guide URL. Formatting never renames symbols or their references.

Only the declaration kinds explicitly listed by the profile are checked. Do not
infer constant naming from an ordinary variable, or impose another language's
conventions where no guide has been selected. The language/profile enable switch
also controls naming checks. See `docs/naming.md` in the plugin package for guide
sources, checked kinds, and deliberately unchecked cases.

## Language packs

Each installed language pack ships `coding-doc-standard-<pack>` — for example
`coding-doc-standard-python` — showing how to write this skeleton in the
language's native syntax: header tokens, tag names, direction notation, and
where each kind of document attaches. Each pack also carries a golden
`example` file — `example.py`, `example.ts`, `example.lua`, `example.yaml` —
a small working implementation documented exactly to this standard. When in
doubt about the shape of anything, copy from the golden file; it is the
reference, the way ImGui ships its demo instead of duplicating docs. Packs
carry native documentation syntax and self-contained declaration naming guidance;
the shared documentation rules live here.
