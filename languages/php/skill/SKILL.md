---
name: coding-doc-standard-php
description: >-
  Native PHPDoc syntax for the coding documentation standard: the /**
  header block after the <?php tag and the block attached to every class,
  interface, trait, enum, function, and method. Load together with
  coding-doc-standard for any task touching .php files.
---

# PHP Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in PHP. The file `example.php` next to this skill is the golden
reference — a complete, working module documented to the standard; copy its
shape when unsure.

## Declaration naming

Use [PHP-FIG PSR-1](https://www.php-fig.org/psr/psr-1/) for its specified kinds.
PSR-1 is a **community interoperability standard**, not PHP syntax or a universal
PHP mandate. Its MUST rules apply to code adopting that standard, and the
checker enforces only the subset below, not the whole standard.

| Kind | PSR-1 convention and example | Actual check/block coverage |
| --- | --- | --- |
| Classes, interfaces, traits | StudlyCaps (`UpperCamelCase`): `RequestState` | Classes/interfaces/traits |
| Methods | camelCase (`lowerCamelCase`): `readLabel` | Methods except magic `__` names |
| Class constants | UPPER_CASE (`SCREAMING_SNAKE_CASE`): `MAX_RETRIES` | Class/interface/trait constants |
| Properties | Deliberately unspecified by PSR-1 | Unchecked |
| Free functions and enum cases | PSR-1 prescribes no casing | Unchecked |

[PHP's enum documentation](https://www.php.net/manual/en/language.enumerations.basics.php)
uses cases such as `Hearts` and `Diamonds`; do not invent an ALL_CAPS enum rule.
Enum type names and global constants are also unchecked by this profile.
Inherited or foreign method names have no semantic exemption beyond magic
methods. Leading/trailing underscores are ignored for casing, not permission
for reserved names. Acronym spelling, references, strings, and comments are not
checked. Check/block only reports or rejects naming violations; it never
renames declarations.

## File header — `/** */` block after `<?php`

```php
<?php
/**
 * @author Perijn Huijser
 * Summary: Convert temperatures between Celsius and Fahrenheit.
 *
 * Description:
 *     Expand the summary briefly, then work an example through the
 *     module: how a caller feeds values in, what comes back under each
 *     condition, what to do when the input is out of range.
 *
 * Changelog:
 *     2026-08: Added the converter class for polling callers.
 */
```

- The header comes after the opening `<?php` line, before any code.
- `@author` and `Summary:` are required; the prose after `Description:` is
  indented one level under it.

## Unit documents

Attach a block directly above every class, interface, trait, enum, function,
and method — private ones included. The first content line is the imperative
summary.

```php
/** Convert Celsius to Fahrenheit; exact for finite inputs. */
function celsius_to_fahrenheit(float $celsius): float
{
    return $celsius * 9 / 5 + 32;
}
```

- One-line blocks suit short units; longer units wrap prose inside the same
  block. The declaration follows the block directly (a blank line between is
  fine).
- Types come from the signature; do not restate them in prose.
- An `@param` or `@return` line closes the summary; keep those tags only
  where the signature cannot say it (shape of an array, unit of a float).

## Other public kinds

Enums, interfaces, and traits are units like everything else; their members
that declare a body or a signature (`method_declaration`) need documents,
cases and properties do not.

```php
/** Temperature scale a reading is expressed in. */
enum TemperatureScale: string
{
    case Celsius = 'C';
}
```
