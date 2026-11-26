---
name: coding-doc-standard-scala
description: >-
  Native Scaladoc syntax for the coding documentation standard: the /** */
  header block and attached class, object, trait, and method documents.
  Load together with coding-doc-standard for any task touching .scala files.
---

# Scala Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Scala. The file `example.scala` next to this skill is the
golden reference — a complete, working file documented to the standard;
copy its shape when unsure.

## Declaration naming

Use the [Scala style guide naming conventions](https://docs.scala-lang.org/style/naming-conventions.html)
for new declarations. These are guide conventions, not universal syntax
requirements or a claim that the whole guide is enforced.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Classes and traits | `UpperCamelCase`: `RequestState` | Classes/traits except directly identified `StaticAnnotation` subclasses |
| Objects | UpperCamelCase (`RequestState`); function-like objects may use lowerCamelCase (`readLabel`) | Unchecked |
| Functions/methods | `lowerCamelCase`: `readLabel`; symbolic methods are valid | Named function definitions; symbolic and backtick names exempt |
| True constants | UpperCamelCase: `MaxRetries`, not necessarily ALL_CAPS | Unchecked; ordinary `val` bindings are not inferred to be constants |
| Variables and parameters | lowerCamelCase: `requestLabel` | Unchecked |

Annotation classes conventionally start lowercase; only directly recognizable
`StaticAnnotation` inheritance is excluded, not semantically resolved ancestry.
Other inherited/foreign names may still be blocked. Leading/trailing underscores
are ignored for casing, not permission to use reserved identifiers. Acronym
spelling, references, strings, and comments are not checked. Check/block only
reports or rejects naming violations; it never renames declarations.

## File header — leading `/** */` block

```scala
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

Attach a `/** */` block directly above every class (including case
classes), object, trait, and `def`; the first prose line is the imperative
summary.

```scala
/**
 * Normalize a status label to lowercase.
 * Returns None when the label is unknown and strict is false.
 */
def normalize(label: String, strict: Boolean): Option[String] = {
	// ...
}
```

- The block must end on the line directly above the declaration (blank
  lines between are fine); anything else is a comment, not documentation.
- `val` and `var` members need no document; every declared class, object,
  trait, and `def` in the file carries one.

## Examples

State the example in prose under a `Usage:` header line or inside the unit
document; comment the result after each call.

```scala
/**
 * Turn a title into a URL slug.
 * Falls back to "untitled" when no usable letters remain.
 *
 * slugify("Hello, World!")   // "hello-world"
 */
def slugify(title: String): String = {
	// ...
}
```
