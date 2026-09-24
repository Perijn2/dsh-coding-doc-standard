# C# Documentation Rules

Author: Perijn Huijser

Load this reference for C# after applying `SKILL.md`.

## File header

Start the file with consecutive `///` lines after an optional BOM and
whitespace. The header must contain verified `@author`, a one-sentence prose
Summary, and `Usage:`. Usage must explain the real setup, workflow, exposed
capabilities, limitations, and result or failure handling that the file proves.
Do not treat XML tags as a substitute for this file guide.

## Public declarations

Document every externally visible public or protected type, constructor, method,
property, field, event, delegate, enum, enum member, and constant with an
attached `///` XML documentation block. Use `<summary>` first. Use `<param
name="...">` once for each meaningful parameter, `<returns>` for non-void
results, `<exception cref="...">` only for known thrown exceptions, and
`<remarks>` or `<example>` only for verified details. Document generic type
parameters with `<typeparam>` when their meaning is not self-evident.

Internal and private members are not public API unless project policy exposes
them. Partial declarations, generated files, source generators, extension
methods, inherited members, and nullable annotations require project context.

## Native documentation examples

`SKILL.md` defines header content; render it in leading `///` comments, then use
XML documentation directly above public declarations:

```csharp
/// <summary>Builds the report requested by the caller.</summary>
/// <param name="source">Source accepted by the report workflow.</param>
/// <returns>The report defined by this API.</returns>
/// <exception cref="ReportException">Thrown for a known report failure.</exception>
public static Report Build(string source) => throw new NotImplementedException();
```

This is syntax only: replace all claims with target facts. Use `<remarks>` or
`<example>` for established guidance; do not turn the shared header into XML tags.

## Layout and accuracy

Use multiline `///` blocks. Keep `<summary>` as the first content, then separate
logical XML elements with one blank comment line. Wrap prose inside the XML
element and keep parameter names exact. Do not claim an exception, nullability,
threading guarantee, ownership rule, or example that code and tests do not prove.

## Verification boundary

Use a Roslyn or project-owned adapter for public-member discovery, partial types,
source-generated APIs, and compiler documentation warnings. Select `dotnet
format`, build, test, and XML documentation settings from the target solution;
this standard does not invent a project configuration.
