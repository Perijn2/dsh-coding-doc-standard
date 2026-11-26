---
name: coding-doc-standard-kotlin
description: >-
  Native KDoc syntax for the coding documentation standard: the /** */
  header block and attached class, object, and function documents. Load
  together with coding-doc-standard for any task touching .kt or .kts files.
---

# Kotlin Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Kotlin. The file `example.kt` next to this skill is the
golden reference — a complete, working file documented to the standard;
copy its shape when unsure.

## Declaration naming

Use [Kotlin coding conventions: Naming rules](https://kotlinlang.org/docs/coding-conventions.html#naming-rules)
for new declarations. These guide conventions are not syntax requirements or
a claim that the whole guide is enforced.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Classes and objects | `UpperCamelCase`: `RequestState` | Classes/objects |
| Functions | lowerCamelCase (`readLabel`); class-like factories may use UpperCamelCase (`RequestState`) | Unmodified, unannotated functions use `MixedCaps`, permitting both initial cases |
| Qualifying constants | UPPER_CASE (`SCREAMING_SNAKE_CASE`): `MAX_RETRIES` | `const` properties only |
| Enum entries | UPPER_CASE (`READY`) or UpperCamelCase (`Ready`) | Unchecked because both conventions are valid |
| Ordinary properties, parameters, local variables | lowerCamelCase: `requestLabel` | Unchecked; not every `val` is a semantic constant |

Modified/annotated functions and backtick names are exempt, including test names
with spaces or underscores. The checker does not infer deeply immutable
constant values or inherited naming requirements. The guide keeps two-letter
acronyms uppercase and longer ones word-cased; acronym spelling is unchecked.
Leading/trailing underscores are ignored for casing, not authorization for
reserved names. References, strings, and comments are not checked. Check/block
only reports or rejects naming violations; it never renames declarations.

## File header — leading `/** */` block

```kotlin
/**
 * @author Perijn Huijser
 * Map raw codec status bytes to pipeline stages.
 *
 * Description:
 *     Expand the summary briefly, then work an example through the
 *     module: how a caller feeds bytes in, what comes back under each
 *     condition, what to do when the map misses.
 *
 * Changelog:
 *     2026-08: Added strict mode for unknown statuses.
 */
package com.example.codec
```

- The `@author` tag carries the author; the first plain prose line after it
  is the summary. A line starting with `Description:`, `Usage:`,
  `Changelog:`, or `Notes:` opens that field; its prose is indented under
  the `*` so it stays separate from the next field.

## Unit documents

Attach a `/** */` block directly above every class, object, and function
(including members); the first prose line is the imperative summary.

```kotlin
/**
 * Normalize a status label to lowercase.
 * Returns null when the label is unknown and strict is false.
 */
fun normalize(label: String, strict: Boolean): String? {
	// ...
}
```

- The block must end on the line directly above the declaration (blank
  lines between are fine); anything else is a comment, not documentation.
- `val` and `var` properties need no document; every declared class,
  object, and function in the file carries one.

## Examples

State the example in prose under a `Usage:` header line or inside the unit
document; comment the result after each call.

```kotlin
/**
 * Turn a title into a URL slug.
 * Falls back to "untitled" when no usable letters remain.
 *
 * slugify("Hello, World!")   // "hello-world"
 */
fun slugify(title: String): String {
	// ...
}
```
