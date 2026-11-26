# Agent Friction Reduction Plan

Author: Perijn Huijser

## Purpose and scope

This is the implementation plan for removing the friction that agents hit when the
`coding-doc-standard` plugin gates a `write` or `edit`. It covers the guard's
execution model, error shape, latency, the one-call authoring flow, and how the
documentation contract reaches the model. It does not change which documentation
facts are required per language; the standard stays the same, only the delivery of
it changes.

Every claim below is backed by a file reference in this repository, a reference in
the installed DeepSeek Harness packages, or a measurement taken on this host.

## Status

Phase 0 is **shipped**. Phases 1 to 3 are not authorized yet and remain as
proposals. What landed:

- The gate is an async `tools/pre-execute` handler. `spawnSync` is gone from
  `src/host`, which the test suite now asserts.
- Every applicable check runs concurrently and every finding for one file lands
  in one denial, with the skill reference attached.
- Candidates that cannot be built (unreadable file, ambiguous or absent
  `old_string`, no content, oversized file, ignored path) skip instead of
  pretending to be documentation faults.
- A vendored/generated/minified/lockfile ignore list is always in force and user
  patterns only add to it.
- An unfinished check fails open with a visible notice, per the decision below.
- A short system-prompt advisory carries the contract, gated by a setting.
- The `tool_input.file_path is required` masking and the `spawnSync` timeout are
  both gone; the underlying `@param {Type} name` false positives in the
  TypeScript public-unit check are fixed too.

The behaviour that shipped is documented in [`README.md`](../../README.md) and
[`docs/architecture.md`](../architecture.md) rather than here; this file keeps
the diagnosis, the measurements, and the phases that are still ahead.

## Reported symptoms

Observed by plugin users, verbatim:

- `Write / Error: [doc-standard] [doc-standard] Cannot validate pending write: tool_input.file_path is required`
- `Write / Error: [doc-standard] spawnSync C:\Users\Perij\AppData\Local\hermes\node\node.exe ETIMEDOUT`
- "the pending writes were too big"
- "They need to provide a file path while it does nothing in the tool. Maybe propose an option that the `format_code` tool can optionally pipe its output to the write tool by calling it."
- "The write tool should also already perform the documentation scanner while the code isn't formatted yet. This gives a direct overview of what to do instead of: write → not formatted → formatted → write → missing docs → adding docs → write → again not formatted. This wastes a lot of tool calls."
- "The agents are reading the skill almost none of the times, so they are guessing what to do. So all error messages should also refer to the skill."

The failing loop those users describe cost three to five tool calls per file, and
each blocked `write` froze the whole harness process for up to ten seconds. Both
effects are what Phase 0 removed.

## Root causes

Line numbers below refer to the pre-Phase-0 revision of this repository; they are
kept as the evidence trail for the diagnosis, not as pointers into current code.

| # | Cause | Evidence |
|---|---|---|
| 1 | The gate is synchronous and spawns a full validator process per write, blocking the host event loop for every agent in the process, capped at 10s. | `src/host/index.mjs:212-243` (`spawnSync`, `timeout: 10_000`); sync-only guards at `@deepseek-ai/dsh-tools/lib/index.js:2812-2820`, invoked synchronously at `:3116` |
| 2 | Any payload the harness itself rejected or salvaged arrives with no usable `file_path`, and our catch-all labels it a documentation fault. | `src/hook/run.mjs:85` (throw), `src/hook/run.mjs:354-359` (catch-all → `Cannot validate pending write`); schema validation lives in the tool body, downstream of the gate (`@deepseek-ai/dsh-tools/lib/index.js:3105` waterfall → `dispatch`) |
| 3 | Checks run as a fail-fast ladder, so one round trip reveals exactly one class of problem. | `src/hook/run.mjs:321-353` (formatting → checker → TS units → tree-sitter → adapters, each `return`ing early) |
| 4 | Nothing is exempt: vendored, generated, minified, and fixture sources pay the full validator cost and can be blocked outright. | `candidateFromPayload`/`checkFormatting` have no ignore list (`src/hook/run.mjs:79-101`, `:190-273`) |
| 5 | Formatter and checker cost is paid cold, once per write, with no reuse. | measured below; `src/hook/run.mjs:193-197` (ruff), `:237-249` (biome/prettier), `:282-299` (`py -3` per candidate) |
| 6 | `format_code` demands `language` although the path already determines it, and renders the whole formatted file back into model context. | `src/host/index.mjs:479-552`, `render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }]` (Phase 2 resolution: both tools require `language`, and the path became the evidence it is checked against, so the redundancy turned into a cross-check that refuses a contradiction; the context flood is gone with the receipt render) |
| 7 | The skill is rarely loaded, and nothing injects the contract or quotes it in the denial. | no `ctx.systemPrompt.section` call anywhere in `src/host/index.mjs` |
| 8 | The matched-tool regex misses other writers. | `/^(?:functions\.)?(?:write|edit)$/` at `src/host/index.mjs:213` — bare `str_replace_editor` and `mcp__*__write_file` never match |

## Measured latency evidence

All numbers taken on this host (Node v22.23.1, Python 3.13.3), rounded.

| Path | Cold (today, per write) | Warm (proposed) |
|---|---|---|
| `node` cold start (the guard's own child) | 70 ms | 0 (runs in-host) |
| `biome format --stdin-file-path` (CLI) | 530–711 ms | unchanged; see daemon note |
| `prettier --stdin-filepath` (CLI) | 345 ms | replaced by in-process API |
| `prettier` in-process (`import` once) | 44 ms import | 4 ms tiny · 278–300 ms for 135 KB |
| `py -3` start + `import checker` | 76 ms + 47 ms | 0 (warm worker) |
| `checker.check_content` warm | — | 0.17 ms tiny · 7–9 ms for 24 KB |
| End-to-end guarded write, small file | 600–700 ms | ~10–25 ms warm path |
| End-to-end guarded write, 135 KB TS | 942 ms | ≤ 320 ms, never a timeout |

Note on the Biome daemon: `biome start` reported "The Biome server was
successfully started" but then emitted
`Error reading the log directory/files: The system cannot find the path specified`
and the follow-up format call hung until killed. The daemon path is **not**
dependable on this host and is excluded from the plan; Biome stays a CLI call, but
runs off the blocking path and only once per batch.

## Verified harness contracts

These are the constraints the design must satisfy. Each was confirmed against the
installed packages or a live spike against the real `ToolRuntime`.

- The async `tools/pre-execute` waterfall runs **before** the synchronous guard:
  `@deepseek-ai/dsh-tools/lib/index.js:3105`, guard at `:3116`. A denial from
  either path materialises as `isError: true` with `Error: <reason>` and the tool
  body never runs (`:3117-3128`).
- Spike-verified: an async `{ kind: "deny", reason }` from `tools/pre-execute`
  reaches the model as `{"isError":true,"error":{"message":"…"}}`; the write body
  does not execute; the `exec` object identity survives into the sync guard, so a
  WeakMap hand-off is available if a hard guard is still wanted.
- `ask` is not a safe "let the user decide" default: with approvals disabled the
  resolution is Cancel, which denies anyway. Use `deny` and a good message.
- `exec.arguments` is deep-frozen (`deepFreeze(snapshotJsonValue(...))`), so a
  pending write cannot be rewritten in place. The only way to land formatted
  content is a write the plugin dispatches itself through
  `ctx.tools.execute({ callId, rootCallId?, name, arguments, agent, parent, signal })`
  (`@deepseek-ai/dsh-tools` `index.d.ts:196-220`), passing `parent: exec.token`
  in code mode.
- There is no harness-side tool-input truncation and no staged-blob or
  "pending write" API. "Pending write" is this plugin's own vocabulary; the
  "writes were too big" complaint is about our per-call work, not a harness limit.
- No guard timeout exists. The tool `timeoutMs` (`@deepseek-ai+dsh-tool-call-timeout-policy`)
  wraps the later dispatch phase only, so the validator's budget must be our own
  async race against `exec.signal`.
- `ctx.systemPrompt.section({ name, order, text })` is the standard injection
  point, used widely by core plugins (for example
  `@deepseek-ai/dsh-tool-cordis/lib/index.js:6790`), and `exec.deferContext(userMessage)`
  delivers advisory content after a tool result.

## Design principles

1. **Never block the host.** All validation moves to the async pre-execute gate.
   No sync spawn, no ten-second cliff.
2. **Never fail unclear.** Exactly three outcomes: not applicable, pass, findings.
   A validator-internal error is its own outcome with an explicit policy, and is
   never dressed up as a documentation violation.
3. **One round trip, the whole picture.** Every check runs concurrently and its
   findings are merged into one report.
4. **Cheapest sufficient check.** Ignore lists, size tiers, warm workers, and
   content-hash caches come before smarter checks.
5. **The message is the interface.** Every denial carries a rule id, `path:line`,
   the exact missing fact, a copy-paste-ready template in the target language's
   syntax, and a pointer to the skill reference.

## Phase 0 — stop the blocking

Shipped as written, with the deltas noted inline.

- Replace the `spawnSync` guard with an async `ctx.on("tools/pre-execute", …)`
  listener that returns `{ kind: "deny", reason }`. Delete the synchronous
  spawn entirely. The optional thin sync backstop over a WeakMap of
  already-computed verdicts was **not built**: it adds a second code path for a
  threat the async gate already covers, and `dsh-tools` offers no place to park
  a verdict for a later sync read.
- Three-way candidate building: `candidateFromPayload` becomes `buildCandidate`
  returning `{ applicable: false, reason }` instead of throwing for a missing
  `file_path`, a non-source extension, an ignored path, or an unparsable edit.
  Accept `path` and `file` aliases. A non-applicable candidate allows silently.
- Never prefix a harness-caused failure with `[doc-standard]`. If the arguments
  are unusable, allow and let the harness's own schema error surface, and log the
  anomaly instead.
- Aggregate every check with `Promise.all` and merge into one findings list:
  formatter, Python checker, TypeScript public units, tree-sitter, project
  adapters. Cap at `aggregateMaxFindings` (default 15), with the remainder
  collapsed into `… plus N more issue(s).` and the `/coding-doc-verify` pointer
  always present. Severity sorting is **not implemented** — findings keep pass
  order, which is deterministic and cheap; revisit only if agents ignore the
  first few lines.
- Default ignore list, policy-driven: `node_modules`, `dist`, `build`,
  `coverage`, `.git`, `*.min.*`, `*.d.ts`, lockfiles, `**/generated/**`, and
  caches, always merged with any user patterns.
- Async timeout budget: `validatorTimeoutMs` (default 20000) raced against
  `exec.signal`, replacing the 10s sync cap. Timeout and internal errors route
  to `validatorFailOpen` — the shipped name for `onValidatorError`, with
  `true` (fail open with a notice) as the default.

Expected result: no host blocking, no `ETIMEDOUT`, no false
`file_path is required` faults, one round trip for all findings.

## Phase 1 — make it cheap

- Warm workers with a JSON-lines protocol instead of a spawn per candidate: a
  persistent `checker.py --serve` process (0.17–9 ms per call instead of
  ~130 ms of process and import cost), and the `prettier` Node API called
  in-process with one cached dynamic import (4 ms warm for small files).
- Move the tree-sitter pass in-host with cached `Parser` instances per grammar, so
  WASM is loaded once per process instead of once per validation.
- Content-hash verdict cache: key `sha256(path + content + policyVersion)`, LRU of
  about 256 entries, each verdict consumable once by the plugin's own inner write
  so the backstop never revalidates the same bytes.
- Batch formatter invocation: one Biome call for a multi-file validation run
  instead of one per file.
- Size tiers: above `largeFileThresholdKb` (default 512) run only the cheap
  passes and say so in the receipt rather than risking a timeout.

## Phase 2 — one-call authoring

This is what actually ends the ping-pong the users described.

- New `write_formatted(file_path, content, language, formatter_args?)`, where
  `language` is required and has to agree with `file_path`: format in memory →
  doc-scan the **formatted** text, so reported line numbers match what lands →
  if clean, dispatch the write with
  `ctx.tools.execute({ name: "write", parent: exec.token, rootCallId:
  exec.rootCallId, signal: exec.signal })` → return a compact receipt.
- If the formatter fails, still run the documentation scan on the raw candidate so
  one response carries both problems. If only documentation fails, return the
  formatted content plus findings, so the next attempt is documentation-only: one
  call instead of three to five.
- `format_code` v2: `file_path` stays required and its tool description states
  why it is load-bearing (it drives `--stdin-filepath`/`--stdin-filename` and
  upstream config resolution, so it is not decorative); it runs the same
  write-through cycle and stops before the filesystem, so it carries no `apply`
  knob at all; replace the `JSON.stringify(value, null, 2)` render with a
  receipt (changed, formatter, byte and line delta, finding count, skill
  pointer) and emit the full formatted text, because nothing landed.
- Delete every message that instructs the agent to "call `format_code`, then retry
  with `formatted_content`". Replace it with "call `write_formatted`".
- Recursion safety: the inner write carries a one-shot call tag that the backstop
  consumes, so `write_formatted` is validated once, not twice.

**Status: shipped.** `src/host/write-through.mjs` holds the shared path and
`src/host/index.mjs` registers `write_formatted` plus the rewritten
`format_code` over it. What differs from the sketch above:

- The inner write carries the formatted bytes, the enclosing `agent` and
  `signal`, a freshly minted `callId` correlated with the enclosing call, and
  `parent` set to the enclosing execution's token. The registry mints that
  token itself, so when a host hands the tool none the stamp is synthetic and
  unique. That parent is load-bearing twice over: it is what keeps the call a
  transport sub-dispatch where a direct call would be collapsed, and it is the
  key the backstop consumes.
- The backstop is a module-level set of live self-dispatch tokens, added before
  the dispatch and removed in a `finally`, rather than a consumable call tag.
  `evaluatePendingWrite` returns `skip` while `execution.parent` is in the set,
  so a token cannot outlive its own write and cannot collide with another call.
- A dry run returns the receipt even when documentation has findings; a write
  attempt raises instead. An applied write never echoes the formatted text
  back into model context.
- `language` is required rather than inferred, and the path is the evidence it
  is checked against. A contradiction between the two, a Rust path, and a path
  no managed formatter covers are refused with the skill reference for that
  path, because formatting one language's bytes with another language's parser
  is how files get mangled, and a refusal the agent cannot act on is the
  friction this phase exists to remove. Where the policy keeps a declared
  language's formatter switched off, `write_formatted` writes the candidate
  documentation-checked exactly as sent and reports `formatter: "none"`, while
  `format_code` refuses it: a preview of nothing formatted answers no question.
- Inline formatted text is capped at 8192 bytes. Above it the receipt says so
  instead of dumping the file into context.

Two environment faults surfaced while testing and were fixed here rather than
deferred, because each made every write look non-compliant:

- Biome infers its project root from the process working directory. Called from
  a harness cwd outside the target workspace, every formatting check failed
  with `internalError/fs` plus a nested-root warning, which the gate could only
  report as a formatter failure that blocks the write. Formatting now runs in
  the target file's nearest existing ancestor directory, via
  `formatterWorkingDirectory` in `src/formatter/command.mjs`, and Biome runs
  with `--vcs-enabled=false` so an unrelated parent repository's ignore file
  cannot poison the run.
- The Python checker read its candidate through the Windows locale codec, so a
  BOM-prefixed file arrived as mojibake, every header pattern missed the block
  comment, and a fully documented file reported `Missing '@author'` and
  `Missing 'Usage:'`. The checker decodes standard input as `utf-8-sig` and
  the host pins `PYTHONUTF8` and `PYTHONIOENCODING` for the child process.

## Phase 3 — the message is the interface

- Assign stable rule ids to every check (`DSFMT-001`, `DOCMOD-001`,
  `DOCFN-002`, …) and map each to an anchor in
  `skill/references/<language>.md`.
- Single source of truth for required headers: a small `docs/contracts/*.json`
  that both `checker.py` and the message renderer read, so the template quoted in
  an error cannot drift from the rule that produced it.
- Denial template: at most 900 characters, at most 8 inline findings, each as
  `rule_id  path:line  what is missing`, followed by a minimal compliant header in
  the target language's own comment syntax, then
  `Full standard: skill coding-doc-standard → references/<lang>.md` and
  `Full report: /coding-doc-verify`.
- Always-on `ctx.systemPrompt.section({ name: "plugin:coding-doc-standard", order, text })`
  of about 110 tokens: the four hard rules, "prefer `write_formatted`", and
  "the full standard is in the `coding-doc-standard` skill". Setting-gated, on by
  default, because the skill is rarely loaded. **Shipped early, in Phase 0**: the
  section exists at order 120 behind `systemPromptAdvisory`, and the
  "`write_formatted`" line arrived with Phase 2.
- Once-per-session `exec.deferContext` pointer on the first blocked write, not a
  pointer on every denial.
- Add a short "Tool contract" section at the top of `skill/SKILL.md` describing
  the gate, `write_formatted`, and what a denial looks like.

## Coverage gap: other write paths

The bare-name matcher at `src/host/index.mjs:213` misses `str_replace_editor` and
`mcp__*__write_file`, which are the writers many setups use. Make `matchedTools` a
policy array with glob support. **Shipped in Phase 0**: exact names match first
and globs are consulted only when the list actually contains a wildcard, so the
default list stays cheap. Add `mcp__*__write_file` or `str_replace_*` to
`matchedTools` to widen coverage. The recommendation to skip partial-edit shapes
with an explicit `skipped: unsupported-write-shape` receipt line still stands —
today those shapes skip silently, which is correct but invisible until Phase 2's
receipt exists.

## Settings changes

Shipped in Phase 0, with the names that actually landed:

| Setting | Default | Purpose |
|---|---|---|
| `validatorFailOpen` | `true` | An unfinished check allows the write with a visible notice; `false` denies it. |
| `validatorTimeoutMs` | `20000` | Async budget shared by all passes, raced against the abort signal. |
| `aggregateMaxFindings` | `15` | Cap on inline findings. |
| `matchedTools` | `write, edit, functions.write, functions.edit` | Closes the MCP gap; globs accepted. |
| `ignoredPaths` | `[]` | Extra ignores, merged with the always-on vendored/build/minified defaults. |
| `systemPromptAdvisory` | `true` | The short always-on contract section. |

Deferred with their phases: `largeFileThresholdKb` (Phase 1 size tiers; Phase 0
uses the existing `maxValidatedBytes` hard limit instead), `warmWorkers`
(Phase 1), and `legacySyncGuard` — dropped entirely, because deleting the
synchronous path is the point of the change and `enabled: false` already covers
a full stop.

## Test plan

- Unit: `buildCandidate` three-way outcomes; aggregator ordering and cap; verdict
  cache single-consumption; renderer snapshot tests for one template per language.
- Integration in `tests/dsh-integration.test.mjs`, which currently tests only the
  legacy `functions.write` prefix: assert bare `write` and `edit` match, a denial
  surfaces as `isError` with the aggregated text, a non-applicable candidate
  allows, `write_formatted`'s inner write is not double-validated, and no
  `spawnSync` remains anywhere in `src/host`.
- Performance regression: the 135 KB fixture must validate under 250 ms warm, with
  zero child processes for the prettier profile.
- Keep `README.md` and `docs/architecture.md` aligned with the enforcement model
  as it ships, rather than with the legacy synchronous ten-second cap.

Status: the Phase 0 slice of this plan is in place —
`tests/validator-core.test.mjs` covers candidate building, the ignore merge,
`documentedParameterNames`, `validateCandidate` outcomes, and the renderer;
`tests/dsh-integration.test.mjs` asserts bare `write`/`edit` matching, one
aggregated denial, the fail-open and fail-closed paths, the advisory lifecycle,
and that `src/host/index.mjs` contains no `spawnSync`. The warm-worker and
one-call-authoring tests arrive with their phases.

## Open decisions

1. `validatorFailOpen` default — **decided: fail open with a visible warning.**
   A broken or slow validator must not hold an agent hostage; the notice names
   the check that could not finish and points at `/coding-doc-verify`.
   `validatorFailOpen: false` is the fail-closed opt-in.
2. The always-on system-prompt advisory — **decided: on by default,
   setting-gated** (`systemPromptAdvisory`), because the skill is rarely loaded
   and the section is short.
3. Port `checker.py` to JavaScript to drop the Python dependency entirely. It
   removes the `py -3` launcher dependency and about 120 ms of cold cost. Phase 3
   or later?
4. Does `write_formatted` replace `format_code`, or complement it?
   **Decided: complement, with writing as the only difference.** `format_code`
   keeps the preview intent and shares the exact write-through cycle
   (`previewFormat` and `formatAndWrite` are the same `runThrough` call with a
   different destination), so there is one implementation and two intents. An
   earlier sketch gave `format_code` an `apply` parameter; it was dropped
   because a tool that can both preview and write is a tool whose callers
   cannot tell what it just did, and `write_formatted` already does that job
   with a clearer name.

## Rollout and rollback

Phase 0 landed alone. Rollback is a settings change: `formatOnWrite: false` stops
format gating and `enabled: false` stops the plugin entirely. The old
synchronous path is deleted rather than kept behind a flag; `git revert` of the
Phase 0 commit is the rollback of last resort.

