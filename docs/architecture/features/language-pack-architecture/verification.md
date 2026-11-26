# Verification: language-pack-architecture

## Evidence

### Phase 1 — engine, codec, providers, Lua pilot (2026-10-31)

- `npm test`: 150 cases, 150 pass, 0 fail (135 pre-existing plus 15 new engine cases in `tests/engine.test.mjs`).
- `npx biome check src tests languages`: clean.
- `npm run verify` and `node scripts/install/verify-install.mjs`: bundle assets complete.
- `repo_conform doctor`: feature catalog validated, hook chain healthy.

Engine test coverage mapped to the test plan:

- PK-01/02/03/04 partial: `tests/engine.test.mjs` "loads the lua pilot pack", "excludes broken packs with a reason".
- CD-01/02/03/04/05: "skips the declared preamble", "decodes declared field spellings", "unit doc decoding extracts summary and sections".
- DC-01/02/03/04/05: "missing required header fields", "a multi-sentence brief summary passes", "usage must reference a discovered unit".
- UD-01/02/05 partial: "tree-sitter provider discovers lua functions", "regex provider discovers units", "an unavailable provider surfaces a typed skip".
- VP-02/03/04/05 partial: "profile resolution prefers pins over detection over defaults".
- FA-05: "a pack without a formatter runs no formatting pass".
- CD-07 partial: "a documented lua candidate passes the gate", "an undocumented lua candidate is denied through its pack" (pack covers the path; legacy checker and tree-sitter passes are skipped for covered languages).

### Incident recorded

The first `but commit` hung: the hook installer preserved the previous
gitbutler-commit-standard dispatcher as `commit-msg-user`, but that dispatcher
chains to `commit-msg-user` itself, so the managed hook's chain recursed
infinitely (1,256 orphaned bash processes). Fixed by removing the
self-referential chain block from the preserved hook. The installer should
sanitize this pattern when preserving foreign hooks.

### Phase 2a — formatter adapters and registry-driven settings (2026-10-31)

- `npm test`: 154 cases, 154 pass, 0 fail. `npx biome check src tests`: clean. `npm run verify`: complete.
- FA-01/02/03 partial: `tests/engine.test.mjs` "the stdin-binary adapter declarations resolve for embedded packs"; adapter dispatch exercised through the gate for Ruff, Biome, and Prettier via the embedded packs.
- FA-05: "a pack without a formatter runs no formatting pass".
- FA-08 partial: registry validation refuses unknown adapters and dependency sources (`validateProfile`).
- SS-01/02 partial: `tests/engine.test.mjs` "settings surface renders one group per installed pack" — schema generated from the registry, version ranges in descriptions.
- SS-03 partial: "settings surface renders stale policy packs as not installed".
- REQ-028 engine audit: formatter branches for Ruff/Biome/Prettier removed from `src/hook/run.mjs`; rustfmt retained as the documented REQ-028 migration exception.
- REQ-029: formatter-less profiles produce no formatting pass (Lua regression test).
- REQ-031: the engine provisions nothing by default; the legacy tools directory is consulted only where an embedded pack explicitly declares `legacy-engine-tools` during migration.

### Gate redesign and hardening (2026-11-07)

- `npm test`: 160 cases, 160 pass, 0 fail, 0 skipped — the previously parked pre-execute gate and advisory suites are un-parked and pass, including "registers one asynchronous pre-execute policy and no sync guard".
- `npx biome check src tests`: clean. `npm run verify` and `node scripts/install/verify-install.mjs`: bundle assets complete.
- WG regression coverage for the hardening:
  - `tests/validator-core.test.mjs` "resolves a relative edit path against the workspace directory" and "reports an edit that is missing from the given workspace" — the pre-edit read uses the agent workspace, not the host process directory.
  - `tests/validator-core.test.mjs` "stops every check when the caller aborts the execution" — an aborted execution reports the passes as incomplete and every child spawn carries the abort signal.
  - `tests/hook-runner.test.mjs` "survives a large pending payload when the adapter exits unread" — a 4 MB JSON payload to an adapter that exits without draining stdin yields a fail-closed diagnostic; before the stdin error listener this crashed the process with an unhandled `write EOF`.
  - `tests/formatter-command.test.mjs` "returns the complete formatted text for files above 200 KB" — the formatted result of a >200 KB pending file keeps its head and tail; the old stdout cap truncated it silently.

### write_formatted dispatch-contract fix (2026-11-07)

- Reproduced live: every `write_formatted` call whose checks passed failed with the harness's opaque "Tool batch execution failed", independent of file, size, or content; files failing the checks still reported clean explicit denials because they throw before the dispatch.
- Root cause read from the running harness (`dsh-tools/lib/pipeline.js`): `tools.execute` takes a batch `{calls: [{id, name, arguments}], signal, agent}` and answers `{results: [{callId, result}], additionalContexts, concluded}`; the plugin's flat single-call input left `calls` undefined and the batch loop's `toolCalls.map` threw, wrapped as `ToolBatchExecutionError` with the cause discarded by the transport.
- `npm test`: 161 cases, 161 pass, 0 fail, 0 skipped — `makeTools` and the integration tool stub now answer in harness batch form, and "reports the real cause when the dispatcher itself rejects" pins the cause-surfacing wrapper.
- `npx biome check src tests`: clean. Live end-to-end probe: `write_formatted` wrote and formatted a JavaScript scratch file and returned the normal receipt.

### Header Usage-requirement removal (2026-11-07)

- Reproduced live: a `.js` file whose header matches the current standard exactly (Author, Summary, Description, Changelog — as specified in `skill/SKILL.md` and all four golden `example.*` files) was blocked with "Missing 'Usage:' in file header".
- Fix: the `Usage:` label was dropped from every header requirement site in `src/hook/checker.py` (compose root, C/C++ prose/Doxygen, and the three family label sets). `checker.py` was also reformatted with the pinned Ruff; it had drifted and every edit to it was failing the formatting pass.
- `npm test`: 162 cases, 162 pass, 0 fail, 0 skipped — including the new "accepts current-standard headers without a Usage section" (JavaScript and Python fixtures) and an inverted Compose fixture that is now genuinely incomplete (missing Summary) rather than merely missing the retired Usage block.
- `npx biome check src tests`: clean. `ruff format --check src/hook/checker.py`: already formatted. Live probe: the exact file that was rejected above wrote cleanly after the change.

### Pack-declared doc syntax (2026-11-08)

- `npm test`: 171 cases, 171 pass, 0 fail, 0 skipped (baseline 162; added 7 codec/contract/golden cases in `tests/engine.test.mjs` and 2 `--header-covered` cases in `tests/checker.test.mjs`).
- `npx biome check src tests`: clean. `ruff format --check src/hook/checker.py`: already formatted. `npm run verify` and `node scripts/install/verify-install.mjs`: bundle assets complete.
- DS-06 golden self-test: "every pack decodes its own golden example without findings" — each registered pack must declare a codec and ship a `skill/example.*` that satisfies its own standard with zero findings (the full lua pack through its unit verdicts too).
- DS codec coverage in engine tests: block extraction with continuation stripping, tag drop, and unlabeled routing ("block syntax decodes tagged and unlabeled header prose", "unknown tags decode as no content and plain prose routes to the declared field"), unterminated block absence ("an unterminated block header is no header at all"), and docstring prefixes, alternate triple quotes, and the coding-comment preamble ("docstring syntax decodes labeled fields behind prefixes and comments"). Spelling rendering and alternate satisfaction: "missing fields are reported by their first declared spelling", "an alternate declared spelling satisfies a field". The REQ-038 inversion updated "missing required header fields each produce a named finding" (Author and Summary only) and replaced the usage-reference rule with "a Usage section carries no checking obligation".
- DS-07 no-duplicate-coverage property, checker cases: a headerless Python file with documented public units passes under `--header-covered` while an undocumented public unit still blocks; a headerless Compose file with documented services passes while an undocumented service still blocks.
- Live probes through the reloaded link-install gate: a TypeScript header without an author is denied naming `'@author'` under `[packs]`; a conforming TypeScript header without any Usage section writes; a Compose root header with a documented service writes; a service without its summary comment is denied under `[documentation]` (the checker keeps service checks under `--header-covered`); a headerless Python file with a fully documented public unit yields exactly the pack header denials with no duplicate `[documentation]` header finding.
- ADR-0008 accepted with all three gates (golden self-test, suite parity, live probes) satisfied. `repo_conform doctor`: healthy (the missing governance schemas were added through `repo init apply`; the docs branch was skipped while the tree carries uncommitted work).
- Recorded tension with the spec criterion "the write path spawns no interpreter for documentation checks": Python and Compose keep one checker spawn for public-unit and service verdicts — the deliberate REQ-037 split. Header-only judgment needs no interpreter; retiring the remaining unit verdicts means moving those unit contracts into pack unit providers.

### Checker retirement via pack providers (2026-11-09)

- CR-01/CR-02: `src/hook/checker.py`, `src/hook/tree-sitter-public-docs.mjs`, and both of their test files are deleted; `run.mjs` runs no `documentation` or `tree-sitter` pass and spawns no interpreter for documentation. Fourteen new language packs (c, cpp, csharp, dart, go, haskell, java, kotlin, php, ruby, scala, shell, swift, rust) plus tree-sitter unit providers added to the python and compose packs cover every formerly checker-covered family. The TypeScript profile's placeholder `units` block was removed so its source-level public-unit pass keeps running; the `[public units]` and project-adapter passes are unchanged.
- CR-03/CR-04: engine tests "python units enforce docstrings while underscore names stay private" and "compose services each need a summary comment" pin both behaviors end to end through `validateWithPacks`. CR-05 is pinned by the python golden: `call_with_retry` carries a summary docstring without a Parameters section and decodes to zero findings, so name cross-matching is not reported.
- CR-06: the golden self-test now discovers units for every pack that declares them (the old `formatterOnly` guard skipped python and compose), so all eighteen packs pass their own examples with zero findings.
- CR-07: bare-file probes named each family's declared first spellings (`'@author'` for java/scala, `'Author:'` for csharp/ruby, `'Summary:'` everywhere); the golden examples with one documented and one undocumented unit produced exactly one `Missing unit documentation for '<name>'` finding each. Haskell, cpp, and dart use the regex unit provider where grammar node shapes fight a query; Go captures `type_declaration` so doc comments above named types bind.
- `npm test`: 137 cases, 137 pass, 0 fail, 0 skipped (36 checker and legacy tree-sitter-table cases removed, 2 pack unit cases added; the budget tests now hang on the Biome subprocess with a compliant TypeScript candidate instead of the checker interpreter). `npx biome check src tests scripts languages`: clean. `npm run verify` and `node scripts/install/verify-install.mjs`: bundle assets complete. `node scripts/install/install.mjs` placed all eighteen pack skills under `~/.dsh/skills`.
- Live probes through the reloaded link-install gate: a headerless Go file is denied twice under `[packs]` with no `[documentation]` pass; a conforming Go header writes; a headerless Python file is denied for `Author:`, `Summary:`, and `Missing unit documentation for 'bare'` — tree-sitter unit discovery with no interpreter; a conforming Doxygen C header writes.
- Deliberate relaxations shipped as recorded in REQ-042: Python signature-to-Parameters/Returns name matching and the exact C/C++ `@file <basename>` and `@param`/`@return` shape rules are dropped; unit enforcement uniformly requires a summary-bearing document.

### Pre-PR verification (2026-11-26)

- `npm test`: 196 tests, 195 passed, 1 failed. The file-mode Biome formatting test fails with Windows `Access is denied (os error 5)` on its temporary TypeScript file. A direct invocation of the pinned Biome executable against a separately created temporary file reproduces the same error; stdin formatting tests pass. This failure remains unresolved and must not be reported as a clean suite.
- `npm run verify` and `node scripts/install/verify-install.mjs`: bundle assets complete.
- `node node_modules/@biomejs/biome/bin/biome check src tests scripts languages`: 78 files checked, no findings.
- New process regressions pass: a pack formatter returns all 1 MB of stdout, and cancellation terminates a running project public-unit adapter before its own timeout. Formatter collection now waits for stream closure, and adapter cancellation receives the validator's combined signal.
- The developer pack probe accepts `--tree` for a header-only TypeScript profile without throwing. Manual probe inputs are preserved separately from the maintained pack golden examples and are not a supported application.
- Before publication, GitHub advertised only `main` at `178ad0d6cb1d64cb3c5135cb2aefb096f7f5e3ef`, which is the feature branch's ancestor. Final publication must recheck the remote target; merge compatibility is a point-in-time observation, not a guarantee against later target changes.

