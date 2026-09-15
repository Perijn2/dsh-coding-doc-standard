# Scala Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It checks only a conservative leading
`/** ... */` house header for `.scala` files. It has no Scaladoc semantic
validation, public-symbol parser, formatter, or detailed verifier yet.

## Supported header shape

Start the file with an expanded `/** ... */` block after an optional BOM and
whitespace. The block must contain `@author` and `Usage:`. These are this
package's Javadoc-family structural fields, not a claim of Scaladoc completeness.

Scala CLI directives, package/import/annotation preambles, shebangs, `.sc`
scripts, generated-source conventions, and other preambles are unsupported in
this version. The profile fails when enabled rather than guessing which source
item owns a comment.

## Native Scala guidance

Scaladoc documents definitions with `/** ... */` comments. Scala 2/3 language
features, visibility, companions, extensions, and package structure require a
compiler-aware parser before public API coverage can be enforced.

## Current limits

Do not infer that this profile runs Scalafmt, sbt, Mill, Scala CLI, compiler
checks, tests, or Scaladoc. Version, dialect, configuration, and project-root
discovery remain a later project-aware phase.