# Kotlin Documentation Rules

Author: Perijn Huijser

Load this reference for Kotlin after applying `SKILL.md`.

## File and public-API rules

Start with an expanded `/** ... */` file header after optional BOM and
whitespace. The header must contain verified `@author`, a one-sentence prose
Summary, and `Usage:`. File annotations (`@file:`), scripts, and other
preambles require project-specific ownership policy.

KDoc uses `/** ... */` directly before public declarations. Document public
classes, interfaces, objects, type aliases, functions, properties, constructors,
and enum entries. Kotlin declarations are public by default; include protected
members of public types when they form a documented inheritance contract. Do
not classify `internal` or `private` declarations as public without evidence.

Use this order and omit unknown sections: Summary, Behavior, `@param`,
`@property`, `@return`, `@throws`, `@sample`, and Notes. The Summary is first
and ends with a period. Document meaningful inputs, results, state effects,
known failures, lifecycle constraints, suspension, nullability, and ownership
only when implemented or tested.

## Native documentation examples

`SKILL.md` supplies the header content; implement it in a leading KDoc block and
attach KDoc directly to the public declaration:

```kotlin
/**
 * Builds the report requested by the caller.
 *
 * @param source Source accepted by the report workflow.
 * @return The report defined by this API.
 * @throws ReportException When the known report operation fails.
 */
fun build(source: String): Report = error("sample only")
```

This demonstrates KDoc syntax only. Use `@property`, `@receiver`, `@sample`,
and `@throws` only when their contents are established.

## Layout and review

Use expanded KDoc, not one-line required comments. Keep the Summary first and
separate tag groups with one blank documentation line. Match parameter,
property, and receiver names exactly. Do not infer coroutine behavior, thread
safety, nullability, exceptions, or examples from names alone.

## Tooling boundaries

Use a Kotlin compiler or project adapter for visibility, expect/actual,
generated API, and module semantics. Do not infer or mandate `ktlint`, `ktfmt`,
Dokka, Gradle, compiler checks, or specific versions; select them from the
target project.
