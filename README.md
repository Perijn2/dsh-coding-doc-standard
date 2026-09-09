# Coding Documentation Standard

Author: Perijn Huijser

A clean, bundle-loaded DeepSeek Harness plugin that blocks undocumented pending
source and Docker Compose writes, while reserving detailed formatter and static
analysis checks for `verify`.

## Design

The package manifest declares `dsh.bundle.patch`, which points to
`bundle.patch.yml`. That patch is the only Cordis loader registration. The
installer installs the package link and machine-wide skill, but **never changes a
profile's `cordis.patch.yml`**.

```text
bundle.patch.yml → host plugin → hooks bridge → Node candidate adapter → Python checker
                                      └──────→ durable policy in ~/.dsh/plugins/
```

## Supported profiles

- Python: Ruff formatting and linting in detailed verification.
- TypeScript / JavaScript: Biome by default, or project-owned ESLint + Prettier.
- Rust: rustfmt and Clippy.
- C / C++: clang-format and clang-tidy.
- Docker Compose: comment-header documentation, Prettier YAML, yamllint, and
  `docker compose config -q` during detailed verification.

Compose documentation uses root and service-adjacent YAML comments. It does not
require `x-...` extension fields for prose.

## Install

```text
node scripts/verify-install.mjs
node scripts/install.mjs
```

Restart DSH after installation so bundle discovery occurs during profile boot.
Use `node scripts/install.mjs --dry-run` to preview installation. The installer
makes no profile-patch edits.

## Verify

```text
npm test
npm run verify
```

Without paths, `npm run verify` checks package completeness. Pass target paths
for detailed checks, for example `npm run verify -- compose.yaml src/main.py`.
Use `--optional` to report unavailable external tools without failing.
