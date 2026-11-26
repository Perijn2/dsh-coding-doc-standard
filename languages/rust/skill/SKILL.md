---
name: coding-doc-standard-rust
description: >-
  Native Rust syntax for the coding documentation standard: //! lines for
  the module header and /// blocks attached to every public item. Load
  together with coding-doc-standard for any task touching .rs files.
---

# Rust Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Rust. The file `example.rs` next to this skill is the golden
reference — a complete, working module documented to the standard; copy its
shape when unsure.

## Declaration naming

Use the [Rust API Guidelines naming conventions](https://rust-lang.github.io/api-guidelines/naming.html)
for new declarations. These guide conventions are not a claim that the whole
guide is enforced or that every recommendation is a language requirement.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Types, traits, enum variants | `UpperCamelCase`: `RequestState`, `Ready` | Structs, enums, traits, type aliases, variants |
| Functions, methods, modules, fields | `snake_case`: `read_label`, `request_id` | Functions/signatures, inherent methods, modules, named fields |
| Constants and statics | `SCREAMING_SNAKE_CASE`: `MAX_RETRIES` | Constants/statics outside impl blocks and inherent associated constants |
| Local bindings, parameters | snake_case: `request_label` | Unchecked |

Trait implementation methods and constants are exempt: preserve the trait's
names. The guide treats acronyms as words (`Uuid`, not `UUID`), but casing
checks do not validate acronym spelling or other semantic API rules. Raw
identifier prefixes and leading/trailing underscores do not change casing;
this does not authorize reserved identifiers. References, comments, and strings
are not checked. Check/block only reports or rejects naming violations; it
never renames declarations.

## File header — leading `//!` lines

Terminate the header with a blank line before the first item.

```rust
//! Author: Perijn Huijser
//! Summary: Convert temperatures between Celsius and Fahrenheit.
//!
//! Description:
//!     Expand the summary briefly, then work an example through the
//!     module: how a caller feeds values in, what comes back under each
//!     condition, what to do on bad input.
//!
//! Changelog:
//!     2026-08: Added the converter struct for polling callers.
```

## Unit documents

Attach `///` lines directly above every public item — functions, structs,
enums, traits, and modules, including public items nested in a public
module. Private items are not units and need no document. The first line is
the imperative summary.

```rust
/// Convert Celsius to Fahrenheit; exact for finite inputs.
pub fn celsius_to_fahrenheit(celsius: f64) -> f64 {
    celsius * 9.0 / 5.0 + 32.0
}
```

- The document must touch the item: no attribute or blank line between the
  last `///` line and `pub`.
- Trait method signatures inside a trait body are not units; the trait
  itself is. `impl` blocks are not units either — document the inherent
  `pub fn` inside them.
- Types come from the signature; do not restate them in prose.

## Other public kinds

Enum variants and public struct fields may carry `///` lines; give them one
when the value's role or unit is not obvious from the name.

```rust
/// Temperature scale a reading is expressed in.
pub enum TemperatureScale {
    /// Water freezes at this point on the scale.
    Celsius,
}
```
