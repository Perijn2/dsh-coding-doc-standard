---
name: coding-doc-standard-c
description: >-
  Native Doxygen syntax for the coding documentation standard: leading
  /** blocks with @author/@brief tags for file headers and functions. Load
  together with coding-doc-standard for any task touching .c or .h files.
---

# C Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in C. The file `example.c` next to this skill is the golden
reference — a complete, working file documented to the standard; copy its
shape when unsure.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Preserve existing project conventions; the formatter never renames declarations.
C has no universal official casing policy: choose casing with the project, not
from these documentation examples. The [GNU naming guide](https://www.gnu.org/prep/standards/html_node/Names.html)
recommends lowercase underscore-separated functions/variables (such as
`read_status`) and uppercase macro/enum constants (such as `STATUS_READY`), but
those are GNU project conventions, not ISO C requirements. Its guidance also
warns against reserved identifiers; stylistic casing does not make reserved
names available to application code. See the source survey in
[Declaration naming](../../../docs/naming.md).

## File header — leading `/**` block

The header must be the first content in the file; document it with tags.

```c
/**
 * @author Perijn Huijser
 * @brief Map raw codec status bytes to pipeline stages.
 *
 * @details
 *     Expand the summary briefly, then work an example through the
 *     file: how a caller feeds bytes in, what comes back under each
 *     condition, what to do when the map misses.
 *
 * @changelog
 *     2026-08: Added the BUSY status byte.
 */
```

## Function documents

Attach a `/** @brief ... */` block directly above every function; the text
after `@brief` is the imperative summary.

```c
/**
 * @brief Normalize a status label to lowercase, in place.
 *
 * @param label (in-out) char*: NUL-terminated buffer, modified in place
 */
void normalize_label(char* label);
```

- The `@brief` prefix is stripped; the remainder seeds the summary.
- A blank line must not sit between the closing `*/` and the declaration,
  or the block no longer belongs to the function.
- `static` helpers need no document; anything callers reach for carries one.

## Other public kinds

C declarations (prototypes, `struct`, `enum`, globals) are not units here —
only function definitions are enforced. Document a public `struct` or enum
with the same `/** @brief ... */` block anyway; readers expect it.
