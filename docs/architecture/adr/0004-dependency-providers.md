---
id: ADR-0004
status: accepted
date: 2026-10-31
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-014, REQ-015, REQ-016, REQ-017, REQ-028, REQ-029, REQ-030, REQ-031]
diagrams: []
supersedes: null
superseded_by: null
verification: "Two profiles of different packs use different providers and different formatter adapters against the same gate; an unavailable dependency degrades to a visible skip notice while other packs keep enforcing; the engine carries no formatter-specific branch."
evidence:
  - claim: "Unit discovery was tied to tree-sitter in engine code, formatters were hardcoded branches for Ruff, Biome, and Prettier only, and the engine shipped default formatter pins."
    artifact: "src/hook/tree-sitter-public-docs.mjs, src/hook/run.mjs checkFormatting, src/policy/defaults.json formatters block"
    verified: owner
---


# Dependency Providers and Formatter Adapters

## Context and Problem Statement

Language packs need parsers and formatters, but the engine must not privilege any mechanism or any tool. Tree-sitter is a good default for unit discovery, yet a pack may prefer another parser package, a regex for a trivial language, or a native external tool. Formatting is worse still: the engine today hardcodes Ruff, Biome, and Prettier branches and ships default pins, which both limits packs to the engine's tool list and embeds tool-specific CLI knowledge in engine code.

The question: how do packs declare parser and formatter dependencies, and how are arbitrary formatters invoked when the engine cannot know their syntax or API?

## Decision Drivers

- Unit discovery is a capability — find units with kind, name, and position — not a mechanism.
- Formatting is a capability — format candidate text for a path — never a bundled tool.
- The engine owns mechanisms and protocols; packs own every choice of tool.
- Packs stay declarative; executable dependencies enter through declared providers with pinned versions.
- A missing dependency degrades to a visible skip; other packs are unaffected.
- No tool is provisioned or shipped that no installed pack declared.

## Considered Options

- Option A: engine-hardcoded tree-sitter for units and named formatters with default pins (status quo).
- Option B: packs ship executable plugin code that performs discovery and formatting.
- Option C: a provider registry for dependencies plus a formatter adapter layer — the engine implements generic invocation protocols, and each profile maps its chosen tool onto one protocol.

## Decision Outcome

Chosen option: **Option C** — dependency providers plus formatter adapters.

**Providers** (unit discovery and dependency resolution) behind one capability interface:

| Provider | Mechanism | Typical use |
| --- | --- | --- |
| `tree-sitter` | wasm grammar plus a units query from the bundled tree-sitter dependency | most languages |
| `regex` | declared patterns | trivial grammars, quick ports |
| `npm` | a pinned parser or formatter node package invoked through a declared entry | pack-specific parsing needs |
| `external-command` | native tool invoked as a process with JSON on stdin | rustdoc, Doxygen, clang-based tooling |

**Formatter adapters** are the layer that makes engine-agnostic formatting possible: the engine cannot know a formatter's CLI syntax or JS API, so it implements a small set of generic invocation protocols, and each profile declares which protocol its formatter speaks:

| Adapter contract | Protocol the engine implements |
| --- | --- |
| `stdin-binary` | Spawn the resolved binary with the candidate on standard input; the profile declares the argument template (with `{path}` and `{workspace}` placeholders), which exit codes mean already-formatted, and where diagnostics are read |
| `npm-function` | Import the pinned package from the dependency store and call the declared export with `(content, path, options)`, returning formatted text or a structured result |
| `external-command` | Locate a project-provided binary declared by the profile (never engine-pinned) and apply the same stdin protocol |

The engine implements protocols only. It holds no tool names, no default pins, and no per-tool argument knowledge. A profile that declares no formatter gets no formatting pass. Nothing is provisioned that no installed pack declared: the provisioning runner is the generic mechanism that materializes whatever dependencies packs declare into the per-pack, per-version tools store, at install time and on demand — never on the write path.

Every npm dependency is pinned to one exact version, and npm installs run with lifecycle scripts disabled. The npm provider is the boundary that keeps packs data-only: a pack may pull a parser or formatter package, but the engine invokes it through a declared entry or adapter mapping, not as arbitrary hook code.

### Consequences

- Good, because a pack chooses any formatter and maps it onto a protocol; adding tool support is pack data, not an engine release.
- Good, because the engine carries no tool-specific branch, so formatter knowledge can no longer drift inside engine code.
- Good, because the engine ships zero formatters: with no packs installed, nothing formatter-related exists to provision.
- Bad, because expressive tools may not fit the three protocols exactly; exotic invocation models need a new adapter contract, which is an engine change.
- Bad, because exit-code and diagnostics semantics are declared per profile, so a misdeclared adapter can misread its formatter; adapter fixtures per pack are the mitigation.
- Bad, because pinned npm dependencies are a supply-chain surface; exact pins, disabled lifecycle scripts, and review are the mitigation.

### Confirmation

Run two profiles using different providers and different formatter adapters through the same gate; remove one dependency and assert a visible skip notice while the other profile still enforces; assert an engine source audit finds no tool names outside adapter fixtures.

## Pros and Cons of the Options

### Option A — hardcoded engine branches with default pins

Good, because there is no indirection and the supported tools work out of the box.

Bad, because each new parser or formatter is an engine release, packs cannot bring tooling the engine did not anticipate, and the engine ships tools no pack may have asked for.

### Option B — executable pack code

Good, because packs are maximally flexible.

Bad, because packs stop being reviewable data and every pack is arbitrary code execution inside the agent host.

## More Information

The discovered-unit output shape is contracted in `discovered-unit.schema.json`; the profile's dependency and adapter declarations in `language-profile.schema.json`.
