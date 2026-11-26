---
id: ADR-0003
status: accepted
date: 2026-10-31
deciders: [owner]
consulted: []
informed: []
requirements: [REQ-011, REQ-012, REQ-013]
diagrams: []
supersedes: null
superseded_by: null
verification: "A pack with a shebang-declaring preamble decodes a shebang-leading file correctly, and a header placed after non-preamble content is reported as missing."
evidence:
  - claim: "Header placement rules for shebangs, PHP open tags, Go build tags, and Haskell pragmas were hardcoded per language in checker.py and tree-sitter-public-docs.mjs."
    artifact: "src/hook/checker.py _source_header, src/hook/tree-sitter-public-docs.mjs leadingHeaderEnd"
    verified: owner
---


# Codec and Preamble Handling

## Context and Problem Statement

Before the universal contract can be checked, the engine must find the documentation header in the file and decode its fields. Every language puts the header after something different: a shebang, an XML open tag, build tags, compiler pragmas, or nothing. Handcoding that per language produced special cases in the engine and inconsistent header-placement rules.

The question: how does the engine know where the header starts in any language without learning each language's file anatomy?

## Decision Drivers

- Header placement mechanics belong to the pack, not the engine.
- Shebang lines and other leading file constructs are skipped before header decoding.
- A header that is not the first content after the preamble is a missing header.
- Field spelling (for example `Author:` versus `@author`) is pack data, decoded into universal field names.

## Considered Options

- Option A: the engine hardcodes preamble and header patterns per language family (status quo).
- Option B: each profile declares a codec — preamble pattern, header syntax, and field spellings — and the engine interprets the declaration.

## Decision Outcome

Chosen option: **Option B**. A profile's codec declares:

- `preamble` — the leading constructs to skip (shebang, XML declaration, build tags, pragmas).
- `header` — the native header syntax family (block comment, line comment, docstring, Haddock) with its tokens.
- `fields` — the native spelling of each universal field name; text matching a declared spelling decodes into that field.

The engine interprets these declarations for every pack. It validates placement (header first after preamble) and decodes fields; it holds no per-language patterns of its own.

### Consequences

- Good, because shell scripts, PHP files, Go build-tagged files, and Haskell pragmas stop being engine special cases.
- Good, because fixing a header-placement bug is a pack data change, not an engine release.
- Bad, because the codec interpreter must correctly implement several syntax families (block, line, docstring, Haddock); a family bug affects every pack using it.
- Bad, because exotic file anatomies that fit no declared preamble pattern need an engine extension.

### Confirmation

Decode a shebang-leading shell file and a pragma-leading Haskell file through their pack declarations; place prose before the header and assert the missing-header finding.

## Pros and Cons of the Options

### Option A — engine-hardcoded patterns

Good, because patterns are directly visible in code.

Bad, because every preamble variant is an engine edit and placement rules already drifted between the two existing implementations.

## More Information

The codec declaration shape is contracted in `docs/architecture/contracts/language-profile.schema.json`.
