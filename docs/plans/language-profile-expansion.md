# Language Profile Expansion Plan

Author: Perijn Huijser

## Purpose and scope

This is the implementation plan for adding separate profiles for Go, C#, Java,
Kotlin, PHP, Ruby, Swift, Dart, Elixir, Haskell, Shell, Lua, and Scala. Each
language has its own evidence and rollout reference:

| Language | Planning reference |
|---|---|
| Go | [go.md](language-profiles/go.md) |
| C# | [csharp.md](language-profiles/csharp.md) |
| Java | [java.md](language-profiles/java.md) |
| Kotlin | [kotlin.md](language-profiles/kotlin.md) |
| PHP | [php.md](language-profiles/php.md) |
| Ruby | [ruby.md](language-profiles/ruby.md) |
| Swift | [swift.md](language-profiles/swift.md) |
| Dart | [dart.md](language-profiles/dart.md) |
| Elixir | [elixir.md](language-profiles/elixir.md) |
| Haskell | [haskell.md](language-profiles/haskell.md) |
| Shell | [shell.md](language-profiles/shell.md) |
| Lua | [lua.md](language-profiles/lua.md) |
| Scala | [scala.md](language-profiles/scala.md) |

These files are planning artifacts, not active `skill/references/` entries: the
package must not claim support before its guard, formatter, verifier, settings,
tests, and packaged assets work together.

## Evidence-first intake gate

Before implementing any profile, record the target ecosystem decision in its
reference and prove it against an official or project-authoritative source:

1. Confirm extensions and generated-file exclusions with representative projects.
2. Confirm the native documentation syntax and which declarations constitute a
   public API.
3. Confirm a formatter can check pending content without modifying a file, or
   explicitly classify it as detailed-only.
4. Choose a linter, compiler, or documentation generator only after determining
   whether it is project-provided or can be safely pinned and provisioned across
   supported DSH hosts.
5. Add compliant, noncompliant, formatter-invalid, tool-missing, and opt-out
   fixtures before enabling the profile by default.

Do not invent a language's API contracts from comment syntax. The guard may
mechanically require a header or structurally detectable public docs; semantic
correctness remains code and review evidence.

## Repository integration map

A fully supported profile changes every applicable layer below. The current
implementation supports only Python, TypeScript/JavaScript, Rust, C/C++, and
Docker Compose, so there is no generic plug-in registry to update once.

| Layer | Current path | Required language-profile work |
|---|---|---|
| Active skill contract | `skill/SKILL.md` | Add the language only after implementation; link its active reference and describe verified enforcement limits. |
| Active reference | `skill/references/<language>.md` | Promote the matching planning reference into an evidence-based usage guide with no speculative commands. |
| Package asset validation | `scripts/verify-install.mjs` | Add every promoted reference to `required`; also expand the current list to cover all active references consistently. |
| Header classification | `src/hook/checker.py` | Add extensions to `SOURCE_EXTENSIONS`, native leading-header extraction, a family mapping, language labels, and only parser-backed public-unit checks. |
| Policy defaults | `src/policy/defaults.json` | Add `languages.<profile>`, any `format<Profile>` toggle, formatter metadata, and linter metadata. Preserve backward-compatible merging in `_load_policy`. |
| Pending formatter | `src/hook/run.mjs` | Extend `formatterProfile`, select a tool safely, provide stdin/check arguments, define missing-tool behavior, and test byte-for-byte output comparison. |
| Tool manifest/provisioning | `src/policy/tools.json`, `scripts/provision-tools.mjs`, `src/policy/platform.mjs` | Pin package or native versions only after host/platform support is verified; add checksum, executable-path, and version checks for every native asset. |
| Detailed verifier | `scripts/verify.mjs` | Add extensions, project-root-aware commands, optional-tool behavior, and doc-generator configuration validation where relevant. Avoid running project-wide commands once per file. |
| Host settings schema | `src/host/index.mjs` | Add schema fields, policy persistence, and merge-safe defaults for language and formatter controls. |
| Settings UI | `src/client/index.js` | Add documentation and formatter controls with the exact verified version and whether the tool is project-provided or managed. |
| Tests | `tests/checker.test.mjs`, `tests/hook-runner.test.mjs`, `tests/toolchain.test.mjs`, `tests/dsh-integration.test.mjs` | Cover routing, headers, public API checks, formatter pass/fail/missing states, policy toggles, settings persistence, and native DSH guard behavior. |
| Documentation/package | `docs/toolchain.md`, `docs/platform-support.md`, `docs/architecture.md`, `README.md`, `package.json`, lockfile | Explain support boundaries, add direct runtime dependencies only when chosen, regenerate the lockfile through pnpm, and verify `npm pack --dry-run`. |

## Shared implementation sequence

### Phase 0 — profile decision record

For one profile at a time, complete its planning reference's unresolved decisions
with links and a fixture inventory. Do not add extensions or settings flags yet.

### Phase 1 — documentation-only prototype

Create the active reference only after its normative syntax, examples, and tool
policy are factual. Add it to the shared skill table and package-asset verifier.
This phase does not advertise a pre-write check until the guard exists.

### Phase 2 — source routing and header enforcement

Add a narrow extension set and native leading-header extractor. Test an accepted
header, an absent header, an unrelated file, an opt-out policy, and shebang or
encoding preambles where the language permits them. Add declaration parsing only
when a stable parser/library is selected; do not emulate a parser with broad
regular expressions.

### Phase 3 — formatter and detailed verifier

Select one of two modes:

- **Pinned pre-write:** the formatter accepts pending text via stdin, has a
  portable distribution, exact version verification, and deterministic output.
- **Project-aware detailed-only:** the tool needs a workspace, compiler, SDK, or
  project config; expose it through `coding-doc-verify` / `scripts/verify.mjs`
  and default the pre-write toggle off.

Tests must prove unavailable tools obey `blockOnMissingFormatter` and that
formatters do not rewrite pending files.

### Phase 4 — settings, packaging, and release gate

Add host schema and client controls together, test policy persistence in a real
Cordis context, update every user-facing support table, run the complete package
gate, install the skill copy, and restart DSH before claiming live enforcement.

## Cross-profile design decisions

- Java and Kotlin are separate language profiles despite sharing JVM projects:
  they have different documentation syntax, extension routing, formatters, and
  public API models.
- Shell is one profile only after Bash, POSIX `sh`, and any additional dialects
  are explicitly chosen; shell extensions alone do not prove a dialect.
- Do not add generic YAML, SQL, Terraform, or other configuration profiles in
  this program. They need separate scope and parser decisions from programming
  languages.
- Do not pin registry/native tools from memory. Record the source URL, release
  version, checksum or integrity mechanism, supported host matrix, and license
  before writing `tools.json` or `package.json`.

## Completion definition per language

A profile is complete only when its active reference, extension router, checker,
policy, optional formatter, detailed verifier, settings UI, fixtures, package
asset verification, install copy, and documentation all agree. A guide alone is
a plan, not language support.
