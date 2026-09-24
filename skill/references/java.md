# Java Documentation Rules

Author: Perijn Huijser

Load this reference for Java after applying `SKILL.md`.

## File header

Start with an expanded `/** ... */` file block after an optional BOM and
whitespace. The block must contain verified `@author`, a one-sentence prose
summary, and `Usage:`. Usage is a detailed guide to actual initialization,
normal call order, capabilities, lifecycle, limitations, known failures, and a
complete workflow when the source establishes them.

## Public declarations

Document every public or protected class, interface, enum, record, annotation,
constructor, method, field, enum constant, and externally used constant with an
attached Javadoc block. Begin with a concise summary. Use `@param` once for each
meaningful parameter, `@return` for non-`void` results, `@throws` only for known
exceptions, and `@see`, `@example`, or `@implNote` only when verified. Use
`@param <T>` for generic type parameters whose meaning needs explanation.

Package exports, inherited members, annotations, modules, sealed hierarchies,
and generated sources require project context. Private implementation details
are not public API unless project policy says otherwise.

## Native documentation examples

`SKILL.md` defines header content; implement it in the leading Javadoc block and
attach Javadoc directly to each public declaration:

```java
/**
 * Builds the report requested by the caller.
 *
 * @param source source accepted by the report workflow
 * @return the report defined by this API
 * @throws ReportException when the known report operation fails
 */
public Report build(String source) { throw new UnsupportedOperationException(); }
```

This is a syntax illustration only. Use `@param <T>`, `@return`, and `@throws`
only where the declaration and established contract require them.

## Layout and accuracy

Use multiline Javadoc blocks with the summary first and one blank documentation
line between prose and tag groups. Keep tags adjacent within a group and match
parameter and exception names exactly. Do not invent nullability, threading,
side effects, exceptions, or examples.

## Verification boundary

Use a Java-aware project adapter for public-member and module-graph coverage.
Select Javadoc, DocLint, Maven or Gradle, formatting, compilation, and tests
from the target project rather than assuming a build system.
