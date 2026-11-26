---
name: coding-doc-standard-haskell
description: >-
  Native Haddock syntax for the coding documentation standard: leading
  -- | blocks for file headers and type signatures. Load together with
  coding-doc-standard for any task touching .hs files.
---

# Haskell Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Haskell. The file `example.hs` next to this skill is the
golden reference — a complete, working module documented to the standard;
copy its shape when unsure.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Preserve existing project conventions; the formatter never renames declarations.
The [Haskell 2010 lexical rules](https://www.haskell.org/onlinereport/haskell2010/haskellch2.html)
require variable identifiers to start lowercase or with an underscore, and
constructor identifiers to start uppercase. Subsequent characters may include
letters, digits, underscores, and apostrophes: these rules do not mandate
whole-word camelCase. For example, `data Status = Ready | Busy` uses constructor
names, while `defaultStatus = Ready` is an ordinary value binding, not an
ALL_CAPS constant declaration. Operators have separate lexical rules, including
colon-initial constructor operators. Beyond these syntax constraints there is
no universal official casing policy; choose casing with the project. See the
source survey in [Declaration naming](../../../docs/naming.md).

## File header — leading `-- |` block

Pragma lines may precede the header; up to two of them are skipped. The
header is a run of `--` comment lines, opened with `-- |`, ended by a
blank line.

```haskell
-- | Author: Perijn Huijser
-- Summary: Retry a flaky call with a bounded backoff.
--
-- Description:
--     Expand the summary briefly, then work an example through the
--     module: how a caller feeds values in, what comes back under each
--     condition, what to do when the retry budget runs out.
--
-- Changelog:
--     2026-08: Added a strict mode for unknown statuses.
```

## Type-signature documents

Attach a `-- |` block directly above every top-level type signature — the
signature is the public API; the first line is the imperative summary.

```haskell
-- | Double an integer.
double :: Int -> Int
double x = x * 2
```

- The doc block must sit directly above the signature line, no blank
  between them.
- Only top-level `name ::` signature lines count as units; a `data`
  declaration or an indented helper clause is not discovered on its own.
- Point-free one-liners and value definitions still document through their
  signature; give every exported binding one.

## Other public kinds

Data types, records, and type classes are not enforced units here — the
signatures are. Document an exported `data` type with a `-- |` block
saying what it represents and how values are obtained anyway; readers
expect it.
