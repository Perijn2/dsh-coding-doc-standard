# Architecture

Author: Perijn Huijser

## Boundaries

`bundle.patch.yml` mounts one host plugin. The host plugin persists user policy
under `~/.dsh/plugins/coding-doc-standard/` and registers one native global DSH tool
guard. That guard covers every agent scope and preset, then synchronously launches
`src/hook/run.mjs` with a ten-second cap. The runner constructs the pending candidate
text and invokes the pure Python checker.

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
