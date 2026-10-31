---
id: ADR-0006
status: accepted
date: 2026-10-31
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-022, REQ-023, REQ-024]
diagrams: []
supersedes: null
superseded_by: null
verification: "Installing and removing a pack changes the rendered settings groups without any settings schema source edit, and a policy entry for a removed pack renders as not installed."
evidence:
  - claim: "The settings schema was a hand-built flat field list, so every new language multiplied schema code and the panel drifted from actual enforcement."
    artifact: "src/host/index.mjs installSettings history"
    verified: owner
---


# Registry-Driven Settings

## Context and Problem Statement

The settings menu was built by hand: one flat schema listing every language toggle, adapter field, and knob. Adding a language meant editing schema code, and the panel could disagree with what enforcement actually did. With language packs, the set of enforceable languages is dynamic — whatever packs are installed — so a hand-built schema cannot stay correct.

The question: how does the settings surface stay correct as packs come and go?

## Decision Drivers

- The menu is generated from the installed pack registry, not hand-maintained.
- One group per pack, one toggle per profile, version ranges visible.
- Policy references profile ids; entries for absent packs remain visible as not installed.
- General behavior knobs (master switch, budget, fail-open, ignored paths, matched tools) stay engine-owned.

## Considered Options

- Option A: continue with a hand-built schema extended per language.
- Option B: generate the settings schema from the pack registry at mount time, with engine-owned general fields as a fixed prefix.

## Decision Outcome

Chosen option: **Option B**. The engine renders the settings section from the registry: a fixed General group, then one group per installed pack with a toggle per profile and the profile's language version range as its description. Durable policy stores profile ids; when a referenced pack is not installed, the entry renders as not installed instead of disappearing, so users see what their policy asked for.

### Consequences

- Good, because install or remove a pack and the menu follows with zero settings code changes.
- Good, because the panel cannot drift from enforcement: both render from the same registry.
- Bad, because the settings schema is dynamic, so stored user sections written against an older pack set can name fields that no longer exist; unknown fields are ignored on resolution.
- Bad, because UI-level schema validation of pack-provided values depends on manifest validation being strict at load time.

### Confirmation

Install and remove a pack and compare the rendered settings groups; keep a policy referencing the removed pack and assert the not-installed rendering.

## Pros and Cons of the Options

### Option A — hand-built schema

Good, because every field is statically known.

Bad, because it is exactly the drift-prone path that motivated packs, and it cannot represent a dynamic pack set.

## More Information

The gate decision shape surfaced by the panel is contracted in `docs/architecture/contracts/gate-decision.schema.json`.
