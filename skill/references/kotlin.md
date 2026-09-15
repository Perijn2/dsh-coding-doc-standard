# Kotlin Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It currently checks only a leading
`/** ... */` structural header for `.kt` files. It has no KDoc semantic
validation, public-declaration parser, formatter, or detailed verifier yet.

## Supported header shape

Start the file with an expanded `/** ... */` block after an optional BOM and
whitespace. The block must contain the shared house fields `@author` and
`Usage:`. Every documented behavior must be established by the source and tests.

Kotlin file annotations such as `@file:`, scripts (`.kts`), and other preambles
are intentionally unsupported in this first version. The profile fails when
enabled instead of guessing which block owns the file-level contract.

## Native Kotlin guidance

KDoc uses `/** ... */`, Markdown, and language-specific tags around Kotlin
declarations. Public API coverage needs a Kotlin-aware parser/compiler model;
this profile does not infer it from `public` text or a regular expression.

## Current limits

Do not infer that this profile runs ktlint, ktfmt, Dokka, Gradle, or Kotlin
compiler checks. Tool selection, versions, rulesets, and project-root discovery
remain a later evidence-based phase.