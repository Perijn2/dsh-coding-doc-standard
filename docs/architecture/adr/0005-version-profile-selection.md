---
id: ADR-0005
status: accepted
date: 2026-10-31
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-018, REQ-019, REQ-020, REQ-021]
diagrams: []
supersedes: null
superseded_by: null
verification: "A workspace with two different detected versions of one language resolves to two different profiles, and a user pin overrides detection in both."
evidence:
  - claim: "Syntax and documentation conventions shift between language versions, so one ruleset per language cannot fit both legacy and modern files."
    artifact: "docs/plans/language-profile-expansion.md motivation section"
    verified: owner
---


# Version Profile Selection

## Context and Problem Statement

Language syntax and documentation conventions change between versions: docstring conventions, comment forms, and parser grammars all differ across releases. Maintaining one ruleset per language forces that ruleset to be either too strict for legacy files or too loose for modern ones, and evolving it in place breaks previously enforced workspaces.

The question: how does a pack support a range of language versions without one mutable ruleset?

## Decision Drivers

- Each profile declares the language version range it supports.
- Multiple profiles for one language coexist; compatibility is additive.
- Selection must be automatic in the common case and overridable by the user.
- Unmatched versions must degrade to a documented default, not an error.

## Considered Options

- Option A: one ruleset per language, edited in place as syntax evolves.
- Option B: detection only — the engine always picks by detected version.
- Option C: detection plus a manual pin — auto-detect from workspace hints, with a per-language user pin overriding detection, and the pack default as fallback.

## Decision Outcome

Chosen option: **Option C**. Profiles declare version ranges; selection resolves in order: user pin, then detection match, then pack default. Detection reads best-effort workspace hints the pack declares (version files, config manifests, engine fields) and logs the resolved profile so selection is never mysterious. Adding a legacy or newer ruleset means adding a profile, never editing an existing one.

### Consequences

- Good, because compatibility is additive: a new profile cannot break enforcement of files the old profile handled.
- Good, because a user can pin a profile for a workspace with unusual toolchains.
- Bad, because detection hints are best-effort; an unversioned workspace silently uses the pack default.
- Bad, because per-language pins add a settings surface and a policy key that must survive pack updates.

### Confirmation

Select profiles for two detected versions of one language; set a pin and assert it wins; remove detection hints and assert the pack default applies.

## Pros and Cons of the Options

### Option A — one mutable ruleset

Good, because there is nothing to select.

Bad, because evolving the ruleset in place silently changes enforcement for every existing workspace.

### Option B — detection only

Good, because no pin surface exists.

Bad, because a workspace the hints misread cannot be corrected by the user.

## More Information

Profile and pack shapes are contracted in `language-profile.schema.json` and `pack-manifest.schema.json`.
