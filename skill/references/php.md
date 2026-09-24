# PHP Documentation Rules

Author: Perijn Huijser

Load this reference for PHP after applying `SKILL.md`.

## Preamble and file header

Begin with the literal `<?php` tag. Place the expanded file DocBlock immediately
after it, before other PHP constructs; `declare`, namespaces, imports,
attributes, and generated-file markers need project-specific policy. `SKILL.md`
defines the shared header content; render it in PHPDoc form:

```php
<?php
/**
 * @author Established Author
 * Summary: Builds the verified request object for application callers.
 *
 * Usage:
 *   Import this file through the project's configured loader, then call the
 *   documented API and handle its established result or failure contract.
 */
```

The sample shows syntax only. Replace each claim with facts from the target file.

## Attach PHPDoc to exposed declarations

Use an expanded `/** ... */` block immediately before public classes,
interfaces, traits, enums, functions, methods, properties, constants, or
configuration values that callers use. Protected members belong only when an
established extension contract exposes them.

```php
/**
 * Builds the report requested by the caller.
 *
 * @param string $source Source accepted by the report workflow.
 * @param array<string, mixed> $options Documented report options.
 *
 * @return Report The result defined by this API.
 *
 * @throws ReportException When the known report operation fails.
 */
function buildReport(string $source, array $options): Report
{
    // Implementation established by the target project.
}
```

Use PHPDoc types, `@param`, `@return`, and `@throws` only when they match code
and known behavior. Describe nullable and union behavior, mutation, generators,
or magic methods only when established.

## PHP-specific writing conventions

- Keep the block attached to its declaration; namespace, trait, promoted
  property, attribute, and magic-method semantics require PHP-aware context.
- Match parameter names including `$`, and describe array shapes or generics only
  when the project convention and implementation establish them.
- Do not document private or internal implementation as a public contract.

## Tooling boundaries

Do not infer or mandate Composer, PHP-CS-Fixer, Pint, PHPStan, phpDocumentor,
PHPUnit, or PHP syntax checks. Discover project configuration and commands from
the target project.
