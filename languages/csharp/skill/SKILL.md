---
name: coding-doc-standard-csharp
description: >-
  Native XML-doc-line syntax for the coding documentation standard: the
  /// header lines and attached type and member documents. Load together
  with coding-doc-standard for any task touching .cs files.
---

# C# Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in C#. The file `example.cs` next to this skill is the golden
reference — a complete, working type documented to the standard; copy its
shape when unsure.

## Declaration naming

Use [Microsoft's C# identifier conventions](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/identifier-names)
and [.NET enum naming](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/names-of-classes-structs-and-interfaces#names-of-enumerations)
as style guidance, not compiler requirements or a claim of whole-guide enforcement.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Types and enum members | PascalCase (`UpperCamelCase`): `RequestState`, `Ready`; interfaces conventionally `IReader` | Classes, structs, interfaces, enums, records, enum members; the `I` prefix is not checked |
| Methods | PascalCase (`UpperCamelCase`): `ReadLabel` | Methods except explicit interface implementations and `override` methods |
| Constants, including local constants | PascalCase (`UpperCamelCase`): `MaxRetries` | `const` fields and locals |
| Variables and parameters | camelCase: `requestLabel` | Unchecked |

Private-field prefix choices are team conventions, not universal .NET rules.
Properties and readonly fields are unchecked; the checker does not infer
semantic constants or resolve inherited names without explicit exclusions.
Verbatim identifier prefixes and leading/trailing underscores do not change
casing, nor authorize reserved identifiers. Acronym spelling, references,
comments, and strings are not checked. Check/block only reports or rejects
naming violations; it never renames declarations.

## File header — leading `///` lines

```csharp
/// Author: Perijn Huijser
/// Summary: Map raw codec status bytes to pipeline stages.
/// Description:
///     Expand the summary briefly, then work an example through the
///     type: how a caller feeds bytes in, what comes back under each
///     condition, what to do when the map misses.
/// Changelog:
///     2026-08: Added strict mode for unknown statuses.
```

- Every header line starts with `///`; the block ends at the first blank
  line. `Author:` and `Summary:` are required. A line starting with
  `Description:`, `Usage:`, `Changelog:`, or `Notes:` opens that field;
  its prose is indented so it stays separate from the next field.

## Unit documents

Attach `///` lines directly above every class, struct, interface, enum,
record, constructor, method, and property; the first line is the imperative
summary (with or without a `Summary:` prefix).

```csharp
/// <summary>
/// Normalize a status label to lowercase.
/// </summary>
public string Normalize(string label, bool strict)
{
	// ...
}
```

- The `<summary>` XML tags are fine; what matters is that the first line
  of real prose summarizes the member. Plain prose lines work just as
  well and read better in diffs.
- Blank lines between the document and the declaration are fine;
  anything not starting with `///` is a comment, not documentation.

## Examples

State the example in prose under a `Usage:` header line or inside the unit
document; comment the result after each call.

```csharp
/// Turn a title into a URL slug.
/// Falls back to "untitled" when no usable letters remain.
/// Slugify("Hello, World!")   // "hello-world"
public static string Slugify(string title)
{
	// ...
}
```
