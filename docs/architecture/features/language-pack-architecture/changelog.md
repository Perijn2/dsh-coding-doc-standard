# Changelog: language-pack-architecture

## Unreleased

- Created the feature lifecycle record for `language-pack-architecture`.
- Initialized the architecture scaffolding: EARS schema, templates, feature catalog, layout seed.
- Wrote 26 requirements across 7 groups (pack-contract, doc-contract, codec, unit-discovery, version-profiles, settings-surface, write-gate).
- Wrote ADR-0001 … ADR-0007 covering the pack architecture, universal contract, codec, providers, version profiles, registry-driven settings, and the unified check engine.
- Created the `pack-manifest`, `language-profile`, `discovered-unit`, `decoded-documentation`, and `gate-decision` contracts.
- Added the `pack-structure` component and `write-gate-flow` flowchart diagrams.
- Wrote the requirement-mapped test plan (`docs/architecture/test-plan.md`).
- Added the formatter adapter layer: REQ-028…031 in a `formatter-adapters` group, ADR-0004 rewritten around providers plus adapter contracts (`stdin-binary`, `npm-function`, `external-command`), adapter fields in `language-profile.schema.json`, and the FA test series.
- Accepted ADR-0001 … ADR-0007 (all frozen).
- Added the remaining boundary contracts: `profile-resolution`, `formatting-result`, `adapter-candidate`, `dependency-record`, `skill-contribution`, and `settings-entry`.
- Phase 2a: shipped the formatter adapter layer (`stdin-binary`, `npm-function`, `external-command`) in `src/engine/formatters.mjs`; moved Ruff, Biome, and Prettier into formatter-only embedded packs (python, typescript-javascript, docker-compose); deleted the engine's per-tool formatter branches and default pins (rustfmt stays as the documented REQ-028 migration exception).
- Rendered the settings packs group from the registry: one group per pack, per-profile toggles with version ranges, stale-entry rendering, and `packProfiles` policy wiring.
- Phase 1 engine implemented: registry, profile selector, codec, contract engine, tree-sitter/regex providers, and the Lua pilot pack with gate integration.
