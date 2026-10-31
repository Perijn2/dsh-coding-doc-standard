---
id: ADR-0007
status: accepted
date: 2026-10-31
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-025, REQ-026, REQ-027]
diagrams: [write-gate-flow]
supersedes: null
superseded_by: null
verification: "The write path spawns no interpreter process; one pending write yields one aggregated decision, and a pack that throws is contained with other packs still reporting."
evidence:
  - claim: "The current write path spawns a Python interpreter per candidate for header checks and hardcodes per-language branches, splitting rule ownership across two runtimes."
    artifact: "src/hook/checker.py, src/hook/run.mjs runCheckerOutput"
    verified: owner
---


# Unified Check Engine

## Context and Problem Statement

Documentation checking currently runs in two runtimes: a Python checker process for headers and language-specific unit checks, and Node for formatting, tree-sitter, and adapters. Every pending write spawns an interpreter, rule ownership is split across languages and files, and per-language logic lives in Python while pack structure lives in Node.

The question: where does documentation checking live once packs carry the rules?

## Decision Drivers

- One engine, one runtime, for all documentation checks on the write path.
- Packs contribute declarations; the engine interprets them.
- Aggregate reporting stays: one pending write yields one complete finding list.
- Fail-open remains the default for incomplete checks, with fail-closed as an explicit setting.
- One broken pack never silences the others.

## Considered Options

- Option A: keep the Python checker as the rule engine and have packs feed it data.
- Option B: absorb header and unit-contract checking into the Node engine as interpretation of pack declarations; keep an interpreter only as a declared external-command provider.

## Decision Outcome

Chosen option: **Option B**. The Node contract engine interprets pack codecs and validates the universal contract directly. The Python checker is retired from the write path; where a language genuinely needs a native checker (Python AST docstring analysis during migration), it runs through the external-command provider like any other pack dependency. The gate keeps its existing contract: concurrent checks under one budget, one aggregated denial listing every finding, fail-open with a visible notice when a check cannot finish, and per-pack error containment.

### Consequences

- Good, because the write path spawns no interpreter for documentation checks; latency drops and rule ownership is single-runtime.
- Good, because pack rules are data interpreted by one engine, so the checker.py rule set and the Node rule set can no longer disagree.
- Bad, because the Python checker must be reimplemented as declarative rules or a provider during migration; the migration is a real port, not a rename.
- Bad, because engines that interpret data fail at interpretation time; containment and validation at pack load are the mitigation.

### Confirmation

Assert no child process on the documentation path for a packed language; force one pack to throw and assert the aggregated report still carries other packs' findings.

## Pros and Cons of the Options

### Option A — Python checker as rule engine

Good, because the existing rule set is already written there.

Bad, because two runtimes keep disagreeing, every write pays an interpreter spawn, and packs would need to serialize their rules into a second format consumed by a second engine.

## More Information

The aggregated decision shape is contracted in `docs/architecture/contracts/gate-decision.schema.json`; the gate pipeline is diagrammed in `docs/architecture/diagrams/write-gate-flow.mmd`.
