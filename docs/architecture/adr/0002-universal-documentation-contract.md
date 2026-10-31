---
id: ADR-0002
status: accepted
date: 2026-10-31
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009]
diagrams: []
supersedes: null
superseded_by: null
verification: "The contract-engine test suite proves identical findings for the same decoded document across two languages whose packs use different native syntaxes."
evidence:
  - claim: "checker.py enforced different label spellings per language family, so a valid header in one language was a denial in another."
    artifact: "src/hook/checker.py check_content and the Author:/@author unification patch history"
    verified: owner
---


# Universal Documentation Contract

## Context and Problem Statement

Header and unit documentation requirements must be identical for every language, yet each language writes documentation in its own native syntax (docstrings, JSDoc, Doxygen, Haddock, line comments). Earlier implementations hardcoded both the requirement and the spelling per language family, producing inconsistent enforcement: one language demanded `Author:`, another `@author`, a third a Doxygen `@file` block.

The question: how is one documentation contract enforced uniformly without flattening languages into one syntax?

## Decision Drivers

- One contract, identical quality bar, for every language.
- Native syntax per language is preserved; the contract is about content, not spelling.
- Summary and Description are brief, with no sentence-count rule.
- Usage is optional and, when present, must be an API-oriented guide grounded in real units.
- Changelog is optional and intended for top-level or large scripts.
- The evidence rule holds everywhere: no invented facts, authors, or behavior.

## Considered Options

- Option A: per-language contract rules (status quo).
- Option B: one universal contract checked on a decoded, language-independent document representation produced by each pack's codec.

## Decision Outcome

Chosen option: **Option B**. The engine validates one universal contract over a decoded document:

- Header fields in order: **Author** (required), **Summary** (required, brief — any length, no sentence-count rule), **Description** (required, brief prose), **Usage** (optional; when present it must reference at least one unit discovered in the file), **Changelog** (optional, for top-level or large scripts), **Notes** (optional).
- Public units: **Summary** first, then **Parameters**, **Returns**, **Errors** where each is meaningful, plus optional Behavior, Example, Notes.
- Layout rules: native multiline syntax, summary first, one blank documentation line between sections.
- The evidence rule: every factual claim must be established by implementation, tests, configuration, or the user; the engine enforces only the mechanical parts (presence, non-emptiness, Usage-references-a-unit) and review enforces truth.

The engine never sees raw syntax — it sees decoded fields, so spelling lives entirely in the pack codec (ADR-0003).

### Consequences

- Good, because the quality bar cannot drift between languages: the same engine produces the same findings from the same decoded document.
- Good, because a header rule change is one engine change, not one change per language.
- Bad, because a purely mechanical engine cannot judge whether prose is truthful or detailed; that remains a review and skill concern.
- Bad, because the Usage-references-a-unit check is necessarily shallow (name matching); a mention without substance passes mechanically.

### Confirmation

Decode the same document content through two different packs (different native syntaxes) and assert the contract engine reports identical findings.

## Pros and Cons of the Options

### Option A — per-language contract rules

Good, because each language's rules can be arbitrarily tailored.

Bad, because the tailoring is exactly what produced inconsistent label families and drift; uniformity is enforced by discipline, not by construction.

## More Information

Decoded document shape is contracted in `docs/architecture/contracts/decoded-documentation.schema.json`. The user-facing statement of this contract lives in the core skill text.
