---
id: ADR-0001
status: accepted
date: 2026-10-31
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-002, REQ-003, REQ-004, REQ-010]
diagrams: [pack-structure]
supersedes: null
superseded_by: null
verification: "A language can be ported by adding one pack directory with no edits to engine source; a broken pack degrades to a logged exclusion without affecting other packs."
evidence:
  - claim: "Per-language knowledge is currently smeared across checker.py, tree-sitter-public-docs.mjs, run.mjs, index.mjs, and the skill, so porting a language touches six files."
    artifact: "src/hook/checker.py, src/hook/tree-sitter-public-docs.mjs, src/hook/run.mjs, src/host/index.mjs, skill/references/"
    verified: owner
---


# Language Pack Architecture

## Context and Problem Statement

Supporting a language today means hand-editing header regexes in a Python checker, a profile table in a Node tree-sitter module, formatter branches in the hook runner, adapter slots in the host, a settings schema, and a skill reference. Adding or versioning a language is expensive and error-prone, and per-language rules drift apart because they live in different files with different implementations.

The question: how should a language capability be packaged so it is self-contained, versioned, and portable without touching engine source?

## Decision Drivers

- Porting a language adds files only; no engine source edits.
- A language's rules, parser/formatter dependencies, and skill content live in one place.
- Language syntax changes across versions are handled by multiple profiles per pack, not by editing one profile in place.
- A broken pack degrades to a logged exclusion; other languages keep enforcing.
- Packs stay reviewable data; arbitrary executable pack code is not introduced.

## Considered Options

- Option A: keep per-language knowledge hardcoded across the engine (status quo).
- Option B: each language pack is its own Cordis plugin registering into a core service.
- Option C: each language pack is a self-contained data directory (manifest, profiles, dependency declarations, skill) that the engine discovers and interprets.

## Decision Outcome

Chosen option: **Option C — data-only language packs**. A pack declares metadata, one or more version-scoped profiles, a documentation codec, dependency declarations for parsers and formatters, and its own skill reference. The engine discovers packs, validates manifests, and interprets the declarations. Executable behavior enters only through declared dependency providers (see ADR-0004).

Option B was rejected because plugin-per-language couples every pack to the Cordis plugin lifecycle and multiplies version surfaces; Option A was rejected because it is the problem being solved.

### Consequences

- Good, because porting a language is authoring one directory of data.
- Good, because multiple profiles per pack give an explicit compatibility story for syntax changes between language versions.
- Good, because a manifest validation failure excludes one pack without touching the others (REQ-003, REQ-027).
- Bad, because the engine must contain an interpreter for pack declarations, which is new code to maintain.
- Bad, because expressiveness is bounded by what the manifest schema can declare; genuinely novel checks must wait for a provider or an engine extension.

### Confirmation

Port a language end to end (the Lua pilot) by adding files only, and verify a deliberately broken pack logs an exclusion warning while other languages still enforce.

## Pros and Cons of the Options

### Option A — hardcoded engine knowledge

Good, because no interpreter is needed and behavior is directly readable in code.

Bad, because every language port edits six files, and per-language rules drift because they live in different implementations.

### Option B — Cordis plugin packs

Good, because packs could ship arbitrary logic and lifecycle hooks.

Bad, because each pack becomes a versioned plugin with full access to host services, multiplying supply-chain and compatibility surface for what is fundamentally rule data.

## More Information

Codec mechanics are decided in ADR-0003; dependency providers in ADR-0004; version profile selection in ADR-0005. The pack manifest and profile shapes are contracted in `docs/architecture/contracts/`.
