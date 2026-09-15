# Scala Profile Plan

Author: Perijn Huijser

## Evidence

[Scalafmt's configuration documentation](https://scalameta.org/scalafmt/docs/configuration)
describes dialect selection and configuration. Scala documentation conventions
must be verified against the selected Scala version and generated Scaladoc tool,
because Scala 2 and Scala 3 build/tooling models differ.

## Candidate scope

- Candidate extensions: `.scala` and, only after a separate decision, `.sc`.
- Native header: expanded `/** ... */` Scaladoc comments before declarations;
decide package/object-level mapping for the shared file header.
- Public units: public classes, traits, objects, enums, givens, extension
methods, constructors, fields, and type aliases. Scala 2/3 syntax requires a
Scala-aware parser/compiler model.

## Implementation decisions to prove

1. Choose supported Scala versions and build tools (sbt, Mill, Scala CLI, or
others) before defining verifier/root-discovery behavior.
2. Treat Scalafmt as project-aware until version/configuration resolution and
non-mutating pending-content checks are tested. Dialect is a required input, not
a filename inference.
3. Decide whether Scaladoc generation is part of detailed verification and how
warning settings are made strict enough for documentation enforcement.

## Repository changes

Add Scala policy/settings/routing, Scala 2/3-aware comment extraction, and
compiler/parser-backed public API analysis. Add project-aware formatter and
detailed-verifier adapters plus test fixtures for the explicitly supported
version/build matrix. Do not group Scala with Java merely because both run on the
JVM.

## Acceptance fixtures

Cover Scala 2 and Scala 3 syntax decisions, traits/objects/enums, extension
methods and givens, Scaladoc tags, sbt/Mill/Scala-CLI discovery, formatter
pass/fail, and unsupported-version/tool behavior.
