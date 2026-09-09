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
bundle.patch.yml → host plugin → hooks bridge → Node candidate adapter → Python checker
                                      └──────→ durable policy in ~/.dsh/plugins/
```

## Supported profiles

- Python: Ruff formatting and linting in detailed verification.
- TypeScript / JavaScript: Biome by default, or project-owned ESLint + Prettier.
- Rust: rustfmt and Clippy.
- C / C++: pinned Doxygen 1.18.0 project-level documentation verification, plus
  project-provided clang-format and clang-tidy.
- Docker Compose: comment-header documentation, pinned Prettier 3.9.6 before
  writes, plus yamllint and `docker compose config -q` during detailed verification.

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
`2.5.12`; and Docker Compose uses Prettier `3.9.6`. See `docs/toolchain.md` for
provisioning, the settings controls, and why Rust/C++ remain detailed-only.
