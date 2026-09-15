# Java Profile Plan

Author: Perijn Huijser

## Evidence

The JDK's [Javadoc comment specification](https://docs.oracle.com/en/java/javase/25/docs/specs/javadoc/doc-comment-spec.html)
defines the standard-doclet documentation-comment rules. It is the controlling
source for Javadoc syntax and tag behavior.

## Candidate scope

- Candidate extension: `.java`; establish generated-source and annotation-
  processor output exclusions from the target build.
- Native header: expanded `/** ... */` Javadoc before package, type, or member
  declarations; decide how the shared file header coexists with `package-info.java`.
- Public units: public/protected classes, interfaces, records, enums,
  constructors, methods, and fields, parsed with a Java-aware parser or compiler
  model rather than regular expressions.

## Implementation decisions to prove

1. Decide whether the implementation relies on project JDK `javadoc`, a parser
   library, or both; this controls host compatibility and public-unit checks.
2. Select a formatter only after the project style authority is known. Do not
   assume Google Java Format, Spotless, or an IDE formatter is present.
3. Confirm detailed verification command and project-root discovery for Maven,
   Gradle, and nonstandard builds before adding `verify.mjs` behavior.

## Repository changes

Introduce Java policy/settings/router support, a Javadoc header extractor, and
parser-backed public API tests. Add a project-context verifier adapter, fixtures
for package-info and Javadoc tags, and a documented formatter decision. Promote
the active reference only after the selected build/formatter mode is proven.

## Acceptance fixtures

Cover a compliant class, documented/missing public method docs, package docs,
`@param`/`@return` only where signatures require them, malformed Javadoc, and
Maven/Gradle tool discovery failures that honor `--optional`.
