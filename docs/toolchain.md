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
fails closed by default when a required pinned formatter is absent.

## Pinned Doxygen verification

The native DSH-managed Doxygen installation supports pinned official assets for
Windows x64, Linux x64, macOS arm64, and macOS x64. Its archive SHA-256 is
verified before extraction; unsupported hosts fail closed with the supported-host
list. See `docs/platform-support.md` for runtime requirements and limitations.
Run project-level documentation checks with:

```text
node scripts/verify.mjs --doxygen path/to/Doxyfile
```

The supplied Doxyfile must explicitly set `WARN_IF_UNDOCUMENTED`,
`WARN_IF_DOC_ERROR`, `WARN_AS_ERROR`, and `EXTRACT_ALL` to `YES`. The plugin does
not generate a Doxyfile because its inputs, excludes, and output location are
project-specific.

## Deliberately detailed-only tools

Rustfmt and clang-format are fast but coupled to a project toolchain or native
LLVM installation. They are not pre-write enforced until the plugin can provision
and verify a portable pinned toolchain for each supported platform. `verify`
continues to reserve Rust/C++ formatting and analysis for project-aware checks.
Doxygen now provides pinned project-level C/C++ documentation verification.

## Settings

The Settings card exposes a global formatter switch, individual Python,
TypeScript/JavaScript, and Docker Compose switches, and a fail-closed option for
missing formatters. Documentation-language toggles remain independent.
