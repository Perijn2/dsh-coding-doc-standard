# Kotlin Profile Plan

Author: Perijn Huijser

## Evidence

Kotlin's [KDoc documentation guide](https://kotlinlang.org/docs/kotlin-doc.html)
states that KDoc combines Javadoc-style block tags with Markdown inline markup.
Kotlin's [coding conventions](https://kotlinlang.org/docs/coding-conventions.html)
document the language's code-style guidance.

## Candidate scope

- Candidate extensions: `.kt` and, only after a separate decision, `.kts`.
- Native header: expanded `/** ... */` KDoc before declarations; decide whether
  script headers have the same requirement.
- Public units: public/internal visibility, top-level declarations, extension
  functions, properties, constructors, and expect/actual declarations require a
  Kotlin-aware parser or compiler model.

## Implementation decisions to prove

1. Keep Kotlin separate from Java: KDoc and Kotlin visibility semantics differ
   even in one Gradle project.
2. Choose formatter and verifier from the project's authoritative Kotlin build
   tooling; do not select ktfmt, detekt, or IntelliJ formatting without proof.
3. Determine whether Dokka generation is part of detailed documentation
   verification and record its required project configuration.

## Repository changes

Add Kotlin settings/policy/routing, a KDoc header extractor, parser-backed
public-declaration coverage, and project-root-aware verification. Test `.kt`
and any approved `.kts` behavior separately. Add package dependencies or native
provisioning only after formatter host support is demonstrated.

## Acceptance fixtures

Include top-level and class members, extension functions, KDoc tags, an
undocumented public declaration, generated/build output exclusion, and a
project-tool unavailable case.