---
name: coding-doc-standard-dart
description: >-
  Native Dart syntax for the coding documentation standard: leading ///
  lines for the file header and the /// block attached to every top-level
  type and function. Load together with coding-doc-standard for any task
  touching .dart files.
---

# Dart Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Dart. The file `example.dart` next to this skill is the
golden reference — a complete, working module documented to the standard;
copy its shape when unsure.

## Declaration naming

Use [Effective Dart: Style](https://dart.dev/effective-dart/style) for new
declarations. These guide conventions are not syntax requirements or a claim
that the whole guide is enforced.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Classes, enums | `UpperCamelCase`: `RequestState` | Classes/enums |
| Typedefs, type parameters, extensions | UpperCamelCase: `RequestReader`, `T`, `RequestParsing` | Unchecked; mixin names are also not selected |
| Functions and methods | `lowerCamelCase`: `readLabel` | Function signatures except explicitly `@override` methods |
| Constants and enum values | Prefer `lowerCamelCase`: `maxRetries`, `ready` | Enum values only; ordinary const bindings unchecked |
| Variables and parameters | lowerCamelCase: `requestLabel` | Unchecked |

Existing APIs and generated code may retain SCREAMING_CAPS; the checker cannot
infer those exceptions or inherited names without explicit override markers.
The guide treats acronyms longer than two letters as words; acronym spelling
is unchecked. A leading underscore denotes library privacy. Leading/trailing
underscores are ignored for casing, not authorization for reserved identifiers.
References, strings, and comments are not checked. Check/block only reports or
rejects naming violations; it never renames declarations.

## File header — leading `///` lines

Terminate the header with a blank line before the first declaration.

```dart
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

Attach `///` lines directly above every top-level class, mixin, enum,
extension, and function. The first line is the imperative summary.

```dart
/// Convert Celsius to Fahrenheit; exact for finite inputs.
double celsiusToFahrenheit(double celsius) {
  return celsius * 9 / 5 + 32;
}
```

- The document must touch the declaration: no blank line between the last
  `///` line and the code.
- Members inside a type may carry docs — give them one whenever the intent
  is not obvious from the name — but the enforced units are the top-level
  declarations.
- Reference other declarations with `[Name]`; types come from the signature
  and are not restated in prose.

## Other public kinds

Enum values and fields need no document of their own; the enclosing
declaration's summary covers the type's role.

```dart
/// Temperature scale a reading is expressed in.
enum TemperatureScale { celsius, fahrenheit }
```
