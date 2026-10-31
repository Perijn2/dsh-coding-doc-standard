# Architecture

Author: Perijn Huijser

## Boundaries

`bundle.patch.yml` mounts one host plugin. The host plugin persists user policy
under `~/.dsh/plugins/coding-doc-standard/` and registers one async
`tools/pre-execute` handler. That handler covers every agent scope and preset.
It builds the pending candidate in the host process, then runs the pure Python
header checker, the parser-backed declaration passes against pinned Tree-sitter
WASM grammars, the pinned formatter, and any configured project adapter
concurrently under one shared budget. Nothing on this path blocks the host event
loop, and no check has a ten-second cap: the budget is `validatorTimeoutMs`,
20000 ms by default. The Tree-sitter baseline covers Go, C#, Java, Kotlin,
Shell, PHP, Ruby, Swift, Dart, Haskell, Lua, and Scala without requiring their
compiler SDKs. It checks named module declarations and direct type members
rather than attempting semantic visibility resolution.

## Validation passes

`validateCandidate` in `src/hook/run.mjs` runs five passes in parallel so one
round trip reveals the complete picture:

| Pass | Source of truth |
|---|---|
| formatting | The pinned formatter for the language profile. |
| documentation | The pure Python header checker in `src/checker.py`. |
| public units | Direct-export JSDoc and doc-comment inspection. |
| tree-sitter | Declaration coverage for the parser-backed languages. |
| project adapter | An optional project-owned native tool, if configured. |

The passes race the budget as a group. Real findings outrank internal failures,
so a denial already found still denies when the budget expires, and the message
carries a `Not fully checked: …` trailer naming what did not finish. A pass that
throws records a failure instead of aborting its siblings.

The documentation checker receives its candidate over standard input, decoded
explicitly as UTF-8 with a leading byte-order mark stripped, and the host pins
`PYTHONUTF8` and `PYTHONIOENCODING` for the child process. Without both, a
BOM-prefixed file reached the checker through the Windows locale codec as
mojibake, every header pattern missed the block comment, and a fully documented
file was reported as missing its header.

The checker is also handed the policy the host is enforcing *right now*, as JSON
in `CODING_DOC_STANDARD_POLICY_JSON`, and prefers it over the durable
`policy.json` path. Passing only a path made the pass depend on a file write
that had already happened: a failed or interrupted `savePolicy` left the checker
judging the candidate against a stale rule set while the gate used the live one.
A serialized policy above 16 kB falls back to the file, because a child process
environment is a bounded block and failing to start is worse than a stale read.

## Outcomes

`evaluatePendingWrite` in `src/host/index.mjs` is the reusable core; the handler
is a thin adapter over it. It returns one of four actions.

| Action | Meaning |
|---|---|
| `skip` | Disabled, not a matched tool, or no candidate could be built. The write proceeds silently. |
| `allow` | Every applicable pass passed. |
| `deny` | Findings exist, or the check was incomplete while `validatorFailOpen` is off. |
| `warn` | The check could not finish while `validatorFailOpen` is on. The write proceeds and a visible notice is injected into the agent's conversation. |

A candidate that cannot be built is never a denial. An unreadable file, an
`old_string` matching zero or several copies, an ignored path, a payload with
neither complete content nor an edit pair, and a file above the byte limit all
skip with an explicit reason. The plugin also never blocks while it is disabled:
`enabled: false` short-circuits the handler and every check, including the
Python checker and the public-unit passes.

Every blocking message is a single aggregated denial: a header with the finding
count, the findings numbered up to `aggregateMaxFindings`, the formatter
pointer when a formatting finding is shown, and the rule pointer
`skill coding-doc-standard → references/<language>.md`.

## Master switch

`enabled` is one switch, not one gate. `createSurfaces` in `src/host/index.mjs`
owns every surface the plugin adds to the host and applies the current policy to
all of them together:

| Surface | While `enabled: false` |
|---|---|
| `tools/pre-execute` handler | Registered, but short-circuits to `skip` |
| system-prompt advisory | Section removed |
| `format_code`, `write_formatted` | Unregistered, so the agent never sees them |
| `/coding-doc-verify`, `/code-formatter` | Unregistered |

That table is the whole point. A master switch that only stopped the deny gate
would leave the advisory telling the model to route every edit through
`write_formatted`, which keeps reformatting files the user believes are
untouched — the switch would look broken for a reason no setting mentions. Both
the tools and commands registries return an effect disposer, so `sync` mounts on
the transition to enabled, retracts on the transition to disabled, and does
nothing when the switch is unchanged, so an ordinary policy edit never churns a
registration. The tools read the policy through a live getter rather than a
captured value, so a re-registration can never pin a stale policy.

`formatOnWrite` keeps the value the user chose. While the master switch is off,
the only tool that could act on it is unregistered, which is what makes it inert
without silently rewriting a second setting.

## Policy

`src/policy/defaults.json` is the canonical policy source. It lists enabled
language profiles, supported Compose paths, formatter defaults, and detailed
verification tools. Browser settings must only modify durable policy state; they
must not duplicate checker rules.

The enforcement knobs added with the async rewrite are:

| Key | Default | Effect |
|---|---|---|
| `enabled` | `true` | The master switch. `false` retracts every enforcement surface, not only the deny gate. |
| `validatorTimeoutMs` | `20000` | Shared budget across all passes, raced against the handler's abort signal. |
| `aggregateMaxFindings` | `15` | Cap on findings rendered into one denial; the rest collapse into a `plus N more` line. |
| `validatorFailOpen` | `true` | An unfinished check allows the write with a visible notice. `false` denies it. |
| `systemPromptAdvisory` | `true` | Injects the short always-on contract section into the system prompt. |
| `matchedTools` | `write`, `edit`, `functions.write`, `functions.edit` | Tool names the handler considers. A name containing `*` or `?` is matched as a glob. |
| `ignoredPaths` | `[]` | Extra ignore patterns, merged with the built-in defaults. |
| `maxValidatedBytes` | `4194304` | Candidates larger than this skip validation entirely. Policy-file only; there is no settings field for it yet. |

`ignoredPaths` merges rather than replaces: the built-in defaults (vendored and
generated trees, `dist`, `build`, `out`, `coverage`, caches, minified and
transpiled artifacts, and lockfiles) always apply, so a custom pattern can never
un-exempt vendored or generated code. `matchedTools` only widens what the
handler looks at; it cannot make the handler inspect tools whose input carries no
complete content, which skip on candidate shape anyway.

## System-prompt advisory

Because the skill is rarely loaded, the plugin states the contract itself.
`installSystemAdvisory` registers a section named
`plugin:coding-doc-standard` at order 120 through the host's `systemPrompt`
service, resolved reflectively so an older host that lacks the service degrades
to a no-op instead of failing to start. The section is about nine short lines:
read the skill reference for the language before writing, put the header and
the public-unit documentation in the same draft, use `write_formatted` with the
language it needs so the format, the check, and the write are one call, say
what `format_code` is for, and a note that a denial already lists every
finding. The advisory is registered only while `enabled` is on, and is removed
when either `enabled` or `systemPromptAdvisory` is turned off.

## Write-through tools

`src/host/write-through.mjs` owns both agent-facing tools so the gate and the
tools can never disagree about what one path is held to. `write_formatted`
formats the pending candidate, documentation-checks the formatted bytes so the
reported line numbers match the file that lands, and dispatches the inner
`write` when the candidate is clean. `format_code` runs the identical cycle
through `previewFormat` and stops before the filesystem. That single split is
the only difference between them, so no tool can both preview and write, and
there is nothing for the two to drift apart over. When the formatter itself
fails, the check still runs against the raw candidate so one response carries
both problems instead of one per round trip.

`language` is required on both tools, and the path is the evidence it is
checked against. `languageOfExtension` resolves what a path says it is with
every formatter toggle forced on, so a workspace that switched a language off
cannot hide what the bytes are. A contradiction is refused with both readings
and the skill reference for that path, rather than formatting one language's
bytes with another language's parser. A Rust path is refused because `rustfmt`
belongs to the project toolchain, and a path no managed formatter is wired up
for is refused in favour of the plain `write` tool, which still gates it. Where
the policy keeps the formatter for a declared language switched off,
`write_formatted` writes the candidate documentation-checked exactly as sent
and reports `formatter: "none"`, while `format_code` refuses it: a preview of
nothing has nothing to show.

The inner `write` rides the tool registry with the enclosing execution's `agent`
and `signal`, a freshly minted `callId` correlated with the enclosing call, and
`parent` set to the registry-minted `token` of the enclosing execution. Two
things depend on that `parent`. It is what makes the call legal in a
`code`-presentation deployment, where the registry rejects a direct call to any
tool other than `run_code` but treats a call carrying a parent as a transport
sub-dispatch. It is also what the gate keys on: the token joins a module-level
set before the dispatch and leaves it in a `finally`, and `evaluatePendingWrite`
returns `skip` while `execution.parent` is in that set, so a write-through never
validates its own write twice or formats one candidate twice.

Formatting runs with the target file's nearest existing ancestor directory as
the working directory rather than the host's. Biome infers its project root from
the process working directory, so an unrelated cwd produced `internalError/fs`
plus a nested-root warning and made every candidate look unformattable, which
the gate can only report as a formatter failure that blocks the write.

## Compose profile

The checker recognizes only configured Compose filenames. It requires a leading
YAML comment header and a nearby Summary comment for each service. Semantic
Compose validation belongs to `verify` because interpolation and external
resources make it unsuitable for every write hook.
