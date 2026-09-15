# Haskell Profile Plan

Author: Perijn Huijser

## Evidence

[Haddock's markup documentation](https://haskell-haddock.readthedocs.io/latest/markup.html)
states that Haddock understands special source annotations and propagates them
into generated documentation. [Fourmolu](https://hackage.haskell.org/package/fourmolu)
is documented as a Haskell source formatter and a fork of Ormolu.

## Candidate scope

- Candidate extensions: `.hs` and, only after a separate decision, `.lhs`.
- Native header: Haddock `-- |` module docs before `module`; account for language
  pragmas and shebang-like script preambles.
- Public units: exported module members, types, constructors, classes, methods,
  pattern synonyms, and records. Publicness depends on the explicit export list,
  so a real Haskell parser/compiler model is required.

## Implementation decisions to prove

1. Decide whether module documentation is mandatory only when a module export
   list exists, and how implicit exports are handled.
2. Choose Fourmolu, Ormolu, or a project formatter only after cabal/Stack/Nix
   toolchain and config evidence is collected.
3. Confirm Haddock invocation, package root detection, and compiler version
   compatibility before adding detailed verification.

## Repository changes

Add Haskell policy/settings/router support, pragma-aware header extraction, and
export-list-aware public-unit checks. Add a project-aware formatter/doc verifier
adapter and tests for Cabal and Stack project roots before enabling by default.

## Acceptance fixtures

Include language pragmas, module docs, explicit/implicit export lists, Haddock
links, constructors, a literate-Haskell scope decision, and unavailable-tool
optional behavior.
