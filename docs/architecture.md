# Architecture

Author: Perijn Huijser

## Boundaries

`bundle.patch.yml` mounts one host plugin. The host plugin persists user policy
under `~/.dsh/plugins/coding-doc-standard/`, then delegates PreToolUse registration
to the DSH Claude Code hooks bridge. The bridge launches `src/hook/run.mjs`, which
constructs the pending candidate text and invokes the pure Python checker.

## Policy

`src/policy/defaults.json` is the canonical policy source. It lists enabled
language profiles, supported Compose paths, formatter defaults, and detailed
verification tools. Browser settings must only modify durable policy state; they
must not duplicate checker rules.

## Compose profile

The checker recognizes only configured Compose filenames. It requires a leading
YAML comment header and a nearby Summary comment for each service. Semantic
Compose validation belongs to `verify` because interpolation and external
resources make it unsuitable for every write hook.
