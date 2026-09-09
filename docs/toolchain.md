# Pinned Formatter Toolchain

Author: Perijn Huijser

## Pre-write formatters

The hook uses only fast, deterministic formatters that can process pending content
without rewriting the target file.

| Profile | Tool | Exact version | Distribution |
|---|---|---:|---|
| Python | Ruff | `0.16.6` | PyPI, installed under `~/.dsh/plugins/coding-doc-standard/tools/` |
| TypeScript / JavaScript | `@biomejs/biome` | `2.5.12` | Production npm dependency |
| Docker Compose | Prettier | `3.9.6` | Production npm dependency |
| C / C++ detailed verification | Doxygen | `1.18.0` | Official GitHub archive, SHA-256 verified, Windows x64 |

Run `npm run provision-tools` after package installation. The pre-write setting
fails closed by default when a required pinned formatter is absent.

## Pinned Doxygen verification

The native DSH-managed Doxygen installation currently targets Windows x64. It is
downloaded only from the official `Release_1_18_0` archive and its SHA-256 is
verified before extraction. Run project-level documentation checks with:

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
