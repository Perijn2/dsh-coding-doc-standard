# Pinned Formatter Toolchain

Author: Perijn Huijser

## Pre-write formatters

The hook uses fast, deterministic formatters that can process pending content
without rewriting the target file. Rust uses the project-provided `rustfmt` when
its opt-in pre-write setting is enabled; Clippy remains detailed-only because it
requires crate and dependency context.

| Profile | Tool | Exact version | Distribution |
|---|---|---:|---|
| Python | Ruff | `0.16.6` | PyPI, installed under `~/.dsh/plugins/coding-doc-standard/tools/` |
| TypeScript / JavaScript | `@biomejs/biome` | `2.5.12` | Production npm dependency |
| Rust (opt-in) | `rustfmt` | Project toolchain | Installed and selected by the project |
| Docker Compose | Prettier | `3.9.6` | Production npm dependency |
| C / C++ detailed verification | Doxygen | `1.18.0` | Official GitHub archive; SHA-256 verified for Windows x64, Linux x64, and macOS arm64/x64 |

Run `npm run provision-tools` after package installation. The pre-write setting
fails closed by default when a required pinned formatter is absent. Provisioning
first detects both `clang` and `clang++` on PATH or in declared platform paths;
only when either is missing does it invoke the host package manager. It never
performs a direct or speculative compiler download. Use `npm run provision-tools
-- --dry-run` to inspect the package-manager action without changing the host.

## Managed formatter command

`/code-formatter` resolves Ruff from the DSH-owned tool directory and resolves
Biome or Prettier from this package. It does not depend on the invoking agent's
`PATH`. Select one formatter profile and one workspace-relative file:

```text
/code-formatter --python --file test.py -- --line-length 100
/code-formatter --typescript --file src/main.ts
/code-formatter --javascript --file src/main.js
/code-formatter --docker-compose --file compose.yaml
```

The aliases `--ruff`, `--biome`, and `--prettier` are also accepted. Arguments
after `--` are passed to the formatter. Existing-file runs write formatting by
default; a forwarded `--check` requests check-only behavior. For pending content,
add either `--content-utf8 <quoted-text>` or `--content-base64 <base64>` while
keeping `--file` as the intended path. Direct UTF-8 is intended for content that
can be represented safely inside one quoted command argument; Base64 avoids quote
and escape ambiguity for arbitrary source. The command sends decoded content to
the selected formatter over stdin and returns formatted source under `Output:`
without creating the intended file.
Success and failure responses show the managed executable, effective arguments,
workspace, exit status, and captured formatter output. Missing-tool responses show
the expected path and the provisioning command.

## Pinned Doxygen verification

The native DSH-managed Doxygen installation supports pinned official assets for
Windows x64, Linux x64, macOS arm64, and macOS x64. Its archive SHA-256 is
verified before extraction; unsupported hosts fail closed with the supported-host
list. See `docs/platform-support.md` for runtime requirements and limitations.
Run project-level documentation checks with:

```text
node scripts/verify/verify.mjs --doxygen path/to/Doxyfile
```

The supplied Doxyfile must explicitly set `WARN_IF_UNDOCUMENTED`,
`WARN_IF_DOC_ERROR`, `WARN_AS_ERROR`, and `EXTRACT_ALL` to `YES`. The plugin does
not generate a Doxyfile because its inputs, excludes, and output location are
project-specific.

## Project-toolchain formatters

The Rust pack declares `rustfmt` through the `external-command` adapter in
`languages/rust/profiles/modern/profile.json`: when the project toolchain
provides `rustfmt` on PATH, the pre-write gate pipes the candidate through
`rustfmt --emit stdout` and diffs stdout; when the binary does not exist, the
check degrades per `blockOnMissingFormatter` with the pack's own
`unavailableHint`. The opt-in `formatRust` setting gates the check, and the
settings catalog lists the formatter because the pack declares it.

clang-format stays detailed-only: it is coupled to a native LLVM installation,
and the plugin cannot provision a portable pinned toolchain for it, so `verify`
continues to reserve C++ formatting and analysis for project-aware checks.
Doxygen provides pinned project-level C/C++ documentation verification.

## Settings

The Settings page exposes one expandable card per language profile. Each card
uses one documentation control for both file/header and supported public-unit
checks, shows its formatter control when available, and exposes custom adapter
command, argument, working-directory, and timeout fields when project-owned
public-unit hooks are supported. Global controls pause all documentation checks,
pause all formatter checks, or choose whether unavailable formatters fail closed.
