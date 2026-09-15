# PHP Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It checks only a conservative leading PHP
house header for `.php` files. It has no PHPDoc semantic validation, public
symbol parser, formatter, or detailed verifier yet.

## Supported header shape

Begin with the literal `<?php` opening tag, then place an expanded `/** ... */`
block before every other PHP construct. The block must contain the shared house
fields `@author` and `Usage:`. Keep every statement evidence-based; `Usage:` is
this package's structural policy and not a native PHPDoc tag.

Short tags, shebangs, templates, `declare`, namespaces, imports, generated-file
markers, and arbitrary preambles are unsupported in this version. The profile
fails when enabled rather than guessing whether a DocBlock belongs to the file
or a later declaration.

## Native PHP guidance

PHP comments can supply source documentation, and PHPDoc DocBlocks document
structural elements. Public API coverage needs a PHP-aware parser because
attributes, namespaces, traits, promoted properties, and visibility affect what
callers can use.

## Current limits

Do not infer that this profile runs Composer, PHP-CS-Fixer, Pint, PHPStan,
phpDocumentor, or PHP tests. Project-root discovery, tool versions, and ruleset
selection remain a later project-aware phase.