# Coding Documentation Standard

Author: Perijn Huijser

A clean, bundle-loaded DeepSeek Harness plugin that blocks undocumented pending
source and Docker Compose writes, while reserving detailed formatter and static
analysis checks for `verify`.

## Design

The package manifest declares `dsh.bundle.patch`, which points to
`bundle.patch.yml`. That patch is the only Cordis loader content this package
supplies. Registration itself belongs to `dsh plugin`, which owns the dependency
spec, the lockfile, the installed package link, and the profile's ordered
`dsh.profile.bundles` entry. This package's installer provisions the pinned
toolchain and the machine-wide skill only — it writes no package link and
**never changes a profile's `cordis.patch.yml`**.

```text
bundle.patch.yml → host plugin → native global tool guard → Node candidate adapter → Python checker
                                      └──────→ durable policy in ~/.dsh/plugins/
```

## Supported profiles

- Python: Ruff formatting and linting in detailed verification.
- TypeScript / JavaScript: Biome by default, or project-owned ESLint + Prettier.
- Rust: opt-in pre-write rustfmt, plus Clippy during detailed verification.
- C / C++: pinned Doxygen 1.18.0 project-level documentation verification, plus
  project-provided clang-format and clang-tidy.
- Docker Compose: comment-header documentation, pinned Prettier 3.9.6 before
  writes, plus yamllint and `docker compose config -q` during detailed verification.
- Go, C#, Java, Kotlin, Shell, PHP, Ruby, Swift, Dart, Haskell, Lua, and Scala:
  native source or module headers plus Tree-sitter-backed declaration documentation
  enabled by default. The guard checks named module declarations and direct type
  members regardless of visibility; optional project adapters can add semantic checks.

All supported documentation profiles are enabled by default and can be disabled
individually in the plugin settings. TypeScript and JavaScript routing includes
`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, and `.cjs`.

Compose documentation uses root and service-adjacent YAML comments. It does not
require `x-...` extension fields for prose.

## Install

Register the bundle with the supported DSH mechanism. It runs pnpm in the profile
directory and then reconciles `dsh.profile.bundles`, so the dependency spec, the
lockfile, the installed package link, and the loader registration all agree:

```text
dsh plugin --profile web add .
```

Relative path specs are anchored to the directory you invoke `dsh plugin` from,
not to the profile directory, so `add .` from this checkout links this package
rather than self-linking the profile.

Then provision the pinned toolchain and the machine-wide skill:

```text
node scripts/verify-install.mjs
node scripts/install.mjs
```

Restart DSH after installation so the bundle's patch layer is composed during
profile boot. Use `node scripts/install.mjs --dry-run` to preview its mutations.
Neither step edits a profile's `cordis.patch.yml`.

## Verify

```text
npm test
npm run verify
```

Without paths, `npm run verify` checks package completeness. Pass target paths
for detailed checks, for example `npm run verify -- compose.yaml src/main.py`.
Use `--optional` to report unavailable external tools without failing.

## Pinned pre-write formatters

Python uses Ruff `0.16.6`; TypeScript and JavaScript use `@biomejs/biome`
`2.5.12`; and Docker Compose uses Prettier `3.9.6`. Agents call the structured
`format_code` tool with `language`, intended `file_path`, and complete UTF-8
`content`, then pass its `formatted_content` to `write` or `edit`. The destination
need not exist and the formatter never writes the candidate.

Humans can invoke the same managed binaries through the slash command:

```text
/code-formatter --python --file test.py -- --line-length 100
/code-formatter --typescript --file src/main.ts
/code-formatter --javascript --file src/main.js -- --indent-style space
/code-formatter --docker-compose --file compose.yaml
```

The command formats an existing file in place by default. Add formatter-specific
`--check` after `--` for a check-only run. For a candidate that does not exist on
disk, pass its intended path with `--file` and either quoted UTF-8 source through
`--content-utf8` or Base64-encoded UTF-8 through `--content-base64`. Direct UTF-8
is convenient for simple text; Base64 is robust when source contains conflicting
quotes or command-like syntax. The formatter reads the candidate from stdin and
returns formatted source under `Output:` without creating the file. Results include
the resolved executable, arguments, workspace, exit status, and formatter output.
See `docs/toolchain.md` for provisioning, settings controls, and why Rust and C++
remain detailed-only.

## Public-unit adapters

TypeScript and JavaScript can opt into direct-export JSDoc checks. Python also
checks known parameter and return sections on documented public functions. Rust
and C/C++ can opt into the bundled native-tool adapters: rustdoc enforces Rust's
`missing_docs` lint, while C/C++ supports explicitly configured project-owned
native adapters. Doxygen remains available for detailed project verification. Configure them using [`docs/public-unit-adapters.md`](docs/public-unit-adapters.md).
The adapter receives pending candidate text without disk staging and native tools
remain responsible for resolving the project's actual public surface.

The evidence and remaining design decisions for language-specific adapters are in
[`docs/plans/language-profile-expansion.md`](docs/plans/language-profile-expansion.md).
Elixir remains deferred until an AST-aware `@moduledoc` / `@doc` adapter exists.
