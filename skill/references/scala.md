# Scala Documentation Rules

Author: Perijn Huijser

Load this reference for Scala after applying `SKILL.md`.

## File and public-API rules

Start with an expanded `/** ... */` block after an optional BOM and whitespace.
The header must contain verified `@author`, a one-sentence prose Summary, and
`Usage:`. Scala CLI directives, package/import/annotation preambles, shebangs,
`.sc` scripts, and generated sources require project-specific policy.

Document every public or protected class, trait, object, enum, enum case,
constructor, method, value, variable, type alias, extension, given, and opaque
type that callers can use with adjacent Scaladoc. Scala visibility includes
package qualifiers, companions, inherited members, and extension methods; do
not infer the public boundary from a single keyword.

Use this order when applicable: Summary, Behavior, `@param`, `@tparam`,
`@return`, `@throws`, Example, and Notes. Document effect types, ownership,
variance, implicit/given requirements, concurrency, and known failures only
when established by the source, types, tests, or project API.

## Native documentation examples

`SKILL.md` supplies the header content; implement it in the leading Scaladoc
block and attach Scaladoc directly to the callable declaration:

```scala
/** Builds the report requested by the caller.
  *
  * @param source source accepted by the report workflow
  * @return the report defined by this API
  * @throws ReportException when the known report operation fails
  */
def build(source: String): Report = ???
```

This is syntax only. Use `@tparam`, `@param`, `@return`, and `@throws` only for
facts established by the type and implementation.

## Layout and review

Use multiline Scaladoc with the Summary first and blank separation between
logical sections. Keep tags adjacent and match parameter and type-parameter
names exactly. Do not invent a companion or extension contract.

## Tooling boundaries

Use a Scala compiler-aware adapter for packages, companions, extensions, givens,
inherited members, and Scala 2/3 visibility. Do not infer or mandate Scalafmt,
sbt, Mill, Scala CLI, compiler checks, tests, or Scaladoc; select them from the
target project.
