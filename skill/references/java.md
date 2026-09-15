# Java Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It currently checks only a leading
`/** ... */` structural header for `.java` files. It has no Javadoc semantic
validation, public-member parser, formatter, or detailed verifier yet.

## Supported header shape

Start the file with an expanded `/** ... */` block after an optional BOM and
whitespace. The block must contain the shared house fields `@author` and
`Usage:`. Document only facts established by the target source and tests.

This first version does not skip package declarations, annotations, directives,
or other preambles before the header. It fails explicitly when enabled rather
than guessing whether an arbitrary block documents the file or a declaration.

## Native Java guidance

Javadoc uses `/** ... */` comments for packages, types, and members. Native
tag completeness and public API coverage require a Java parser/compiler model;
they are not inferred from this structural header check.

## Current limits

Do not infer that this profile runs Javadoc, DocLint, Maven, Gradle, or a Java
formatter. Those commands and their strictness settings must be selected from
the target project's documented build configuration.