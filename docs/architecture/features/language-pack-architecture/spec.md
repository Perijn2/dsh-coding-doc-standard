# Feature: language-pack-architecture

- Slug: `language-pack-architecture`
- GitButler branch: `language-pack-architecture`
- Status: open

## Scope

Replace per-language engine hardcoding with self-contained language packs. Each pack is a data directory holding a manifest (`pack.json`), one or more version-scoped profiles (`profiles/<id>/profile.json`), unit-discovery query assets, and its own skill reference. The engine discovers packs, selects the profile matching the workspace language version (detection first, user pin overriding), decodes language-native documentation syntax through the pack codec into one universal contract, discovers units through the profile's declared dependency provider (tree-sitter, regex, npm, or external-command), and enforces the universal contract with the existing aggregated write gate.

Boundaries: packs carry no executable hook code — executable behavior enters only through declared, pinned dependency providers. Engine-owned behavior (master switch, budget, fail-open policy, ignored paths, matched tools, candidate building) stays in the core. The Python checker is retired from the write path in favor of the unified contract engine.

Delivered in phases: Phase 1 registry + contract engine + codec + providers + Lua pilot; Phase 2 formatter declarations + skill composition + Go/Shell ports; Phase 3 Python/TS/C++/Compose ports and checker.py removal; Phase 4 pack distribution.

Per ADR-0008 the file-header syntax itself is pack-declared data: a profile codec names its syntax (`line`, `block`, or `docstring`), its open/close/continuation tokens, its tag-drop and unlabeled-prose routing, its preamble patterns, and a spelling list per contract field. Formatter-only packs may carry a codec and then own the file header, while their unit verdicts stay with the existing passes, which no longer rejudge a covered header (checker `--header-covered`). The universal header contract is Author and Summary (REQ-038); tree-sitter remains reserved for unit discovery.

## Acceptance Criteria

- A language is portable by adding one pack directory with no engine source edits.
- A malformed pack manifest excludes that pack with a logged warning; other packs keep enforcing.
- The same decoded document produces identical findings regardless of which pack's codec decoded it.
- Shebang-leading and pragma-leading files decode their headers correctly per the profile preamble.
- Two detected language versions of one language resolve to two different profiles; a settings pin overrides detection.
- The settings menu renders one group per installed pack with a toggle per profile and visible version ranges; policy entries for absent packs render as not installed.
- The write path spawns no interpreter for documentation checks; one pending write yields one aggregated decision.
- An unavailable provider skips one profile with a visible notice while remaining packs still report.
