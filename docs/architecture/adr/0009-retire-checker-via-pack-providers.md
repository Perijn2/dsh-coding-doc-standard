---
id: ADR-0009
status: accepted
date: 2026-11-08
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-039, REQ-040, REQ-041, REQ-042]
diagrams: []
supersedes: null
superseded_by: null
verification: "Review this proposed decision and run /repo doctor before accepting it."
evidence:
  - claim: "This ADR was created by the architecture creation core."
    artifact: "repo_adr action new"
    verified: owner
---


# Retire Checker Via Pack Providers

## Context and Problem Statement

ADR-0008 made file-header syntax pack-declared data, but the Python checker (`src/hook/checker.py`) still judges unit documentation and every language family that has no full pack: the Python `ast` unit checks, Compose service summaries by regex, the C/C++ Doxygen contract, and the ten first-batch header families. Every gated write on those paths spawns a `py` interpreter — latency, an external interpreter dependency, encoding edge cases, and a second documentation stack maintained under a different formatter. The legacy engine-side tree-sitter table (`src/hook/tree-sitter-public-docs.mjs`) duplicates unit knowledge in source instead of packs.

## Decision Drivers

- Every covered-path documentation decision shall be pack data (REQ-039) with no interpreter spawn (REQ-040).
- The pinned `tree-sitter-wasm` package already ships all fifteen grammars the checker covers, including YAML, Dart, Haskell, and Scala — verified by probe, so unit discovery moves in-process with no new dependency.
- The contract engine's unit rule (a document with a summary exists) is uniform, fast, and already proven through the Lua pack.

## Considered Options

- Option A: Full migration — new full packs for every checker family (unit providers via tree-sitter queries, headers via codecs), Python and Compose packs gain tree-sitter unit providers, and checker.py plus the legacy grammar table are deleted.
- Option B: Keep checker.py as the unit oracle for Python and Compose while packs own everything else — the interpreter and its stack survive for the two highest-traffic paths.
- Option C: Rewrite checker.py in Node with hand-rolled parsers — no interpreter, but unit knowledge again lives in engine source, contrary to the pack architecture.

## Decision Outcome

Chosen option: **A**. Every checker family becomes a pack: header codecs encode each family's dialect through declared spellings (`@author`/`@brief`, `Author:` lines, `//`, `///`, `#`, `-- |`), and unit discovery runs through profile-declared tree-sitter queries (regex provider where a grammar's node shapes fight the query). Python public units (`function_definition`/`class_definition`, underscore names excluded) and Compose services (YAML `mapping_pair`s under `services`) move to queries per REQ-041. The `--header-covered` mechanism of ADR-0008 becomes obsolete with the checker and is removed.

### Consequences

- Positive: zero interpreter spawns for documentation; one enforcement stack in one language; unit knowledge joins header knowledge as pack data; gated writes lose the `py` process and its startup cost.
- Negative, deliberate relaxations recorded in REQ-042 with no engine replacement: Python signature-to-Parameters/Returns name matching, the exact C/C++ `@file <basename>` rule, and the C/C++ `@param`/`@return` shape contract. Unit enforcement for all packed families converges on "a document with a summary is attached", which is simultaneously stricter: a Summary line becomes uniformly required where some families previously accepted any comment.
- Neutral: the `publicUnitDocs` entries for the migrated families lose their consumer and go inert; the map itself still gates the TypeScript source pass and the project adapter. The checker's preamble strictness is replaced by fail-closed decoding (an unrecognized preamble means no decodable header, which denies).

### Confirmation

Suite parity plus the pack golden self-test (every pack decodes its own `skill/example.*` to zero findings) plus live gate probes on migrated families; see the feature's verification record.

## Pros and Cons of the Options

### Option A

Good, because it completes the pack architecture, deletes two engine-side syntax stacks, and removes the only interpreter dependency from the write path.

Bad, because fifteen pack directories replace one 829-line checker, and the deepest unit rules (signature cross-checks) are dropped rather than ported.

### Option B

Good, because it preserves Python unit semantics exactly with minimal new code.

Bad, because the interpreter, its encoding edge cases, and the second documentation stack survive on the two most-written file types.

### Option C

Good, because it keeps current behavior without an interpreter.

Bad, because it re-hardcodes per-language syntax in engine source — the exact pattern the whole architecture exists to remove.

## More Information

This ADR supersedes the checker-side clauses of ADR-0007 and the `--header-covered` split of ADR-0008; the pack codec model of ADR-0008 is retained and extended with unit document bindings (block, docstring, haddock) and a name-exclusion filter for provider results.