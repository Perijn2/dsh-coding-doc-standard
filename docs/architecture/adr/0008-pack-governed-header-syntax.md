---
id: ADR-0008
status: accepted
date: 2026-11-08
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038]
diagrams: []
supersedes: null
superseded_by: null
verification: "Review this proposed decision and run /repo doctor before accepting it."
evidence:
  - claim: "This ADR was created by the architecture creation core."
    artifact: "repo_adr action new"
    verified: owner
---


# Pack Governed Header Syntax

## Context and Problem Statement

The file-header rules live in two places: the skill (the generation source of
truth) and `checker.py` (the enforcement layer, with a hardcoded per-family
label table). They drifted twice without any test noticing: the standard
dropped the `Usage:` header block while the checker kept demanding it (every
skill-conformant file was denied), and REQ-005/`contract.mjs` still required a
Description the standard made optional. Each language's header syntax (block
comments, docstring quotes, line tokens) is also hardcoded as regex branches
in `checker.py`, so adding or changing a language means touching engine code.

## Decision Drivers

- One source of truth: enforcement must read the same grammar the skill
  teaches, so drift becomes impossible rather than untested.
- Language knowledge must be data owned by packs, not code owned by the
  engine, matching the established codec declaration of ADR-0001/ADR-0003.
- Header extraction must stay cheap: it is a comment-structure problem, not a
  full-grammar problem, so no per-language parser or interpreter spawn is
  justified for it.
- Migration must not change unit-documentation verdicts for any language.

## Considered Options

- Option A: keep per-language header regexes in `checker.py` and fix each
  drift by hand.
- Option B: pack-declared documentation syntax — profiles declare header
  syntax tokens (line prefix, block open/close/continuation, docstring
  quotes), field spellings, tag sigil, and the unlabeled-prose target; the
  engine's codec decodes every declared syntax into the universal contract.
- Option C: tree-sitter for everything, headers included.

## Decision Outcome

Chosen option: **Option B**. The codec already models line-token headers as
pack data (the Lua pilot); Option B extends that data model with block and
docstring syntax, spelling lists, and prose routing instead of inventing a
second mechanism. Header checking moves into the pack path for every
installed pack. `checker.py` loses the header labels and the family table for
covered languages (REQ-037: it keeps its unit rules — Python public-unit
sections, Compose service summaries — and skips only the header labels the
pack now owns). Tree-sitter stays exactly where it earns its cost: unit
discovery and attachment (Option C rejected for headers — booting a grammar to
find a leading comment buys nothing a token scan does not). Option A is what
produced the two drifts this ADR closes.

The universal contract is corrected to the standard: Author and Summary
required; Description, Usage, Changelog, and Notes are optional content with
no checking obligation (REQ-038 supersedes the Description clause of REQ-005
and the Usage-reference rule of REQ-007). Missing-field findings name the
field's first accepted spelling from the pack, preserving the message format
agents already know (`@author` for TypeScript, `Author:` for Python).

### Consequences

- Positive: header rules exist in exactly one place per language — the pack —
  and the golden `example.*` file of each pack is checked by that pack in the
  test suite (REQ-036), making skill/checker drift a build failure.
- Positive: covered languages check headers in-process; no interpreter spawn
  for the header itself.
- Negative: during migration a file can be judged by the pack header pass and
  the checker unit pass together; ownership per pass is explicit in the gate
  routing and ends when a pack takes its language's units natively.
- Negative: languages without an installed pack (Go, Rust, C/C++, Java, …)
  keep the legacy header rules until their pack lands; the family table
  shrinks per ported language instead of vanishing at once.

### Confirmation

Accepted after: the golden-example self-test passes for every installed pack,
the existing suite reproduces pre-port verdicts for units, and live probes
confirm a Usage-less header writes while a missing author still denies.

## Pros and Cons of the Options

### Option A

Good, because no engine change is needed.

Bad, because every grammar change must be applied in two places and both
known drifts happened under exactly this arrangement.

### Option B

Good, because enforcement reads pack data, the pilot proves the shape, and
drift is structurally prevented by the golden-file self-test.

Bad, because the codec data model grows a few fields and migration leaves a
temporary two-pass ownership split.

### Option C

Good, because one parser answers every structural question.

Bad, because grammar boot and WASM memory are unjustified cost for "find the
leading comment", and it still needs the same spellings data for roles.

## More Information

This ADR is pinned to REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038.