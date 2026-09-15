# Dart Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It checks only a conservative leading
`///` house header for `.dart` files. It has no dart-doc semantic validation,
public-library parser, formatter, analyzer, or detailed verifier yet.

## Supported header shape

Start the file with consecutive `///` lines after an optional BOM and whitespace.
The block must contain `Author:`, `Summary:`, and `Usage:`. These are this
package's explicit structural header fields, not native dart-doc coverage rules.

Library, import, export, and `part` directives, annotations, shebangs,
`.g.dart`, Flutter-generated output, and other preambles are unsupported in this
version. The profile fails when enabled rather than guessing which library or
declaration owns a comment.

## Native Dart guidance

Dart documentation comments use `///`, but library and public API semantics
need Dart analyzer/parser knowledge. Do not approximate visibility, generated
source, or package boundaries with a regular expression.

## Current limits

Do not infer that this profile runs `dart format`, `dart analyze`, Dart tests,
or documentation generation. Pub package/Flutter root discovery, tool versions,
and project rules remain a later project-aware phase.