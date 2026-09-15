# PHP Profile Plan

Author: Perijn Huijser

## Evidence

PHP's [manual](https://www.php.net/manual/en/language.basic-syntax.comments.php)
notes that API documentation can be generated from comments. The official
[phpDocumentor documentation](https://docs.phpdoc.org/) and its
[DocBlock definition](https://docs.phpdoc.org/guide/getting-started/what-is-a-docblock.html)
provide the documentation-generator baseline.

## Candidate scope

- Candidate extension: `.php`; decide generated framework/cache paths from real
  projects before routing.
- Native header: PHPDoc `/** ... */` after an optional `<?php` opening tag,
  `declare(strict_types=1)`, and any permitted file preamble.
- Public units: classes, interfaces, traits, enums, methods, functions,
  properties, constants, and namespaced symbols. Use a PHP parser rather than
  matching `public` text because promoted properties and attributes matter.

## Implementation decisions to prove

1. Establish whether the shared file header is required after the opening tag or
   whether only API DocBlocks are practical in target codebases.
2. Select exactly one formatter/linter policy only after project evidence. PHP-
   CS-Fixer, Pint, and PHPStan are candidates, not current package behavior.
3. Confirm Composer project-root discovery and how tool absence maps to
   `--optional` before changing `verify.mjs`.

## Repository changes

Add PHP defaults/settings/router/header parsing; add a parser-backed public API
adapter; then add a project-aware formatter/verifier adapter. If a managed tool
is chosen, add a version, source, integrity strategy, and supported-host matrix
before provisioning it.

## Acceptance fixtures

Cover opening tag and strict-types preambles, compliant/missing DocBlocks,
attributes, promoted properties, namespace declarations, generated-file
exclusion, and Composer-tool pass/fail/missing behavior.
