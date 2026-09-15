# Haskell Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It checks only a conservative Haddock-style
module header for `.hs` files. It has no Haddock semantic validation,
export-list-aware public API parser, formatter, or detailed verifier yet.

## Supported header shape

A file may begin with zero or more canonical single-line `{-# LANGUAGE ... #-}`
pragmas, separated from the header by whitespace. Then place a `-- |` Haddock
module header with `--` continuation lines immediately before an explicit
`module Name where` declaration. The block must contain `Author:`, `Summary:`,
and `Usage:` as package house fields.

No other pragmas, comments, CPP, shebangs, `.lhs`, extensionless scripts, or
generated-source conventions are supported. The profile fails when enabled
rather than guessing whether an arbitrary comment documents a module.

## Native Haskell guidance

Haddock supports source documentation, but public API depends on module export
lists, types, constructors, classes, and re-exports. Coverage must wait for a
Haskell-aware parser or compiler model.

## Current limits

Do not infer that this profile runs GHC, Cabal, Stack, Ormolu, Fourmolu, tests,
or Haddock generation. Project roots, tool versions, and strictness settings are
a later project-aware decision.