---
name: coding-doc-standard-swift
description: >-
  Native Swift syntax for the coding documentation standard: leading ///
  lines for the file header and the /// block attached to every type and
  function. Load together with coding-doc-standard for any task touching
  .swift files.
---

# Swift Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Swift. The file `example.swift` next to this skill is the
golden reference — a complete, working module documented to the standard;
copy its shape when unsure.

## Declaration naming

Use the [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/)
for new declarations: UpperCamelCase types/protocols and lowerCamelCase for
other names. These guide conventions are not syntax requirements or a promise
of whole-guide enforcement.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Types and protocols | `UpperCamelCase`: `RequestState` | Type declarations (classes, structs, enums) and protocols |
| Functions and methods | `lowerCamelCase`: `readLabel` | Identifier-named functions except `override` methods |
| Enum cases | `lowerCamelCase`: `ready` | Enum cases |
| Constants, variables, properties | lowerCamelCase: `maxRetries`, `requestLabel` | Ordinary bindings unchecked; no semantic constant inference |

Operators and backtick identifiers are exempt. Type aliases and generic
parameters are not selected by these rules. Preserve conventional acronym
capitalization (`URL`, `utf8` as appropriate to position); acronym spelling is
unchecked. Inherited/foreign names without explicit override markers can still
be blocked. Leading/trailing underscores are ignored for casing, not permission
for reserved identifiers. References, strings, and comments are not checked.
Check/block only reports or rejects naming violations; it never renames
declarations.

## File header — leading `///` lines

Terminate the header with a blank line before the first declaration.

```swift
/// Author: Perijn Huijser
/// Summary: Convert temperatures between Celsius and Fahrenheit.
///
/// Description:
///     Expand the summary briefly, then work an example through the
///     module: how a caller feeds values in, what comes back under each
///     condition, what to do on bad input.
///
/// Changelog:
///     2026-08: Added the converter class for polling callers.
```

## Unit documents

Attach `///` lines directly above every class, struct, enum, protocol, and
function — methods and private declarations included. The first line is the
imperative summary.

```swift
/// Convert Celsius to Fahrenheit; exact for finite inputs.
func celsiusToFahrenheit(_ celsius: Double) -> Double {
	celsius * 9 / 5 + 32
}
```

- The document must touch the declaration: no blank line between the last
  `///` line and the code.
- Protocol requirements (`var` requirements) are not units; protocol
  declarations themselves are.
- Types come from the signature; do not restate them in prose.

## Other public kinds

Every enum case and stored property may carry a `///` line, but only the
enclosing type, function, and protocol declarations are required.

```swift
/// Temperature scale a reading is expressed in.
enum TemperatureScale {
	case celsius
}
```
