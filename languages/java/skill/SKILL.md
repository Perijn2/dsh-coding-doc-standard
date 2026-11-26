---
name: coding-doc-standard-java
description: >-
  Native Javadoc syntax for the coding documentation standard: the /** */
  header block and attached class and method documents. Load together with
  coding-doc-standard for any task touching .java files.
---

# Java Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Java. The file `example.java` next to this skill is the
golden reference — a complete, working class documented to the standard;
copy its shape when unsure.

## Declaration naming

Use [Oracle naming conventions](https://www.oracle.com/java/technologies/javase/codeconventions-namingconventions.html)
as the profile's style reference. This is an **archived guide, last revised
1999**, not the current Java specification; it predates enums and records.
The [Java enum tutorial](https://docs.oracle.com/javase/tutorial/java/javaOO/enum.html)
illustrates uppercase enum constants. These are style conventions, not a
claim that the whole guide is enforced or universally mandated by Java.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Types | `UpperCamelCase`: `RequestState` | Classes, interfaces, enums, records |
| Methods | `lowerCamelCase`: `readLabel` | Methods except those marked `@Override` |
| Constants and enum constants | UPPER_CASE (`SCREAMING_SNAKE_CASE`): `MAX_RETRIES`, `READY` | Enum constants and fields explicitly marked both `static` and `final` |
| Variables, parameters, packages | lowerCamelCase variables (`requestLabel`); lowercase packages (`codec`) | Unchecked |

The checker does not infer semantic constants, including implicitly static
final interface fields; ordinary final bindings are unchecked. Inherited or
foreign names without the explicit override marker can still be blocked.
Leading/trailing underscores are ignored for casing, not authorization for
reserved identifiers. Acronym spelling, references, strings, and comments are
not checked. Check/block only reports or rejects naming violations; it never
renames declarations.

## File header — leading `/** */` block

```java
/**
 * @author Perijn Huijser
 * Map raw codec status bytes to pipeline stages.
 *
 * Description:
 *     Expand the summary briefly, then work an example through the
 *     class: how a caller feeds bytes in, what comes back under each
 *     condition, what to do when the map misses.
 *
 * Changelog:
 *     2026-08: Added strict mode for unknown statuses.
 */
package com.example.codec;
```

- The `@author` tag carries the author; the first plain prose line after it
  is the summary. A line starting with `Description:`, `Usage:`,
  `Changelog:`, or `Notes:` opens that field; its prose is indented under
  the `*` so it stays separate from the next field.

## Unit documents

Attach a `/** */` block directly above every class, interface, enum, record,
constructor, and method; the first prose line is the imperative summary.

```java
/**
 * Normalize a status label to lowercase.
 * Returns null when the label is unknown and strict is false.
 */
public String normalize(String label, boolean strict) {
	// ...
}
```

- The block must end on the line directly above the declaration (blank
  lines between are fine); anything else is a comment, not documentation.
- Nested and private-looking members still count: every declared class,
  interface, enum, record, constructor, and method in the file needs one.

## Examples

State the example in prose under a `Usage:` header line or inside the unit
document; comment the result after each call.

```java
/**
 * Turn a title into a URL slug.
 * Falls back to "untitled" when no usable letters remain.
 *
 * slugify("Hello, World!")   // "hello-world"
 */
public static String slugify(String title) {
	// ...
}
```
