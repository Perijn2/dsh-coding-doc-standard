# Haskell Documentation Rules

Author: Perijn Huijser

Load this reference for Haskell after applying `SKILL.md`.

## Module and public-API rules

A file may begin with canonical single-line `{-# LANGUAGE ... #-}` pragmas,
separated from the header by whitespace. Then place a `-- |` Haddock module
header with `--` continuation lines immediately before `module Name where`. The
header must contain `Author:`, `Summary:`, and `Usage:`. Other pragmas, CPP,
shebangs, `.lhs`, and generated-source conventions require project policy.

Document every declaration exported by the module: functions, values, types,
constructors, classes, methods, fields, type families, pattern synonyms, and
instances when callers rely on them. Use Haddock `-- |` or `-- ^` attached to
the declaration or field. Use this order when applicable: Summary, Behavior,
Parameters, Returns, Errors, Example, and Notes. Document laziness, strictness,
partiality, effects, ownership, and failure behavior only when implementation,
types, or tests establish them.

Export lists and re-exports define the public boundary. A declaration can be
written in the file but not be public, while a re-export can be public without a
local definition.

## Native documentation examples

`SKILL.md` supplies the header content; use `-- |` for module and declaration
documentation, with `--` continuation lines:

```haskell
-- | Builds the report requested by the caller.
--
-- The result and any failure behavior follow this module's established contract.
buildReport :: Source -> Report
buildReport = error "sample only"
```

This is Haddock layout only. Attach `-- ^` field comments to the field they
document, and use Haddock markup or examples only when established.

## Layout and review

Use multiline Haddock with the Summary first and blank separation between logical
sections. Keep field comments attached to fields and use fenced examples only
when they compile under the project's extensions and dependencies.

## Tooling boundaries

Use a Haskell-aware adapter for export lists, re-exports, constructors, type
families, and instance visibility. Do not infer or mandate GHC, Cabal, Stack,
Ormolu, Fourmolu, tests, or Haddock generation; select them from the project.
