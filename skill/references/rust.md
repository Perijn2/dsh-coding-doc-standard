# Rust Documentation Rules

Author: Perijn Huijser

Load this reference only for Rust after applying `SKILL.md`.

## Crate and public-item rules

Use expanded `//!` inner-doc lines at the top of a crate root or module file. Use
`# Author`, `# Summary`, `# Usage`, and optional `# Notes` headings for the
shared fields. `# Usage` is a file-specific guide, not a mandatory subsection
template: choose headings and prose that explain the real setup, workflow,
capabilities, limitations, result/error handling, and useful complete examples.
A worked example should be a rustdoc-tested code block only when the code and
its outcome are established. Do not add `# Includes`; Usage explains public APIs
by task instead.

Use expanded consecutive `///` lines immediately above public items. Rustdoc
already renders the signature and types, so do not add redundant Arguments or
Returns headings. Public `unsafe` items require a code-derived `# Safety`
section. Add `# Errors` and `# Panics` only for known behavior; never guess at
either section.

The write guard mechanically requires a leading rustdoc header containing
Author and Usage, and checks recognized public functions, structs, enums, traits,
constants, and type aliases for attached docs. Public unsafe items also require
`# Safety`. Complex project-item coverage and semantic error claims still require
review or a configured native adapter.

## Documentation-shape example

This is a syntax illustration. Its claims describe only the sample function;
replace them with facts established by the crate before documenting production
code.

```rust
//! # Author
//! Perijn Huijser
//!
//! # Summary
//! Normalizes labels for case-insensitive comparison.
//!
//! # Usage
//! Getting started: Import `normalize_label` from this module. The function has
//! no configuration, mutable state, or cleanup requirement.
//!
//! Using the result: Pass raw text, retain the returned `String` for comparison,
//! and keep the original input when reporting an unknown value. Use the result
//! for canonical lookup keys, not for user-facing text that preserves formatting.
//!
//! Boundaries and failures: The function has no error channel, so callers decide
//! whether an empty normalized value is acceptable.
//!
//! Complete workflow: Normalize a lookup key, distinguish a missing map entry,
//! and retain the raw input for the failure message.
//! ```
//! use std::collections::HashMap;
//!
//! let raw_label = "  Ready ";
//! let mut states = HashMap::new();
//! states.insert(String::from("ready"), "enabled");
//! let state = states.get(&normalize_label(raw_label));
//! assert_eq!(state, Some(&"enabled"));
//! ```

/// Normalizes leading, trailing, and case differences in a label.
///
/// # Examples
/// ```
/// assert_eq!(normalize_label("  Ready "), "ready");
/// ```
pub fn normalize_label(label: &str) -> String {
    label.trim().to_lowercase()
}
```

## Layout and review

Never use a single-line required rustdoc comment. Leave a blank `///` line
between the Summary and prose or each `#` heading, and between heading sections.
Missing `# Safety` for a public unsafe item or known `# Errors`/`# Panics`
behavior is a blocker. A one-line required document or missing heading
separation is a minor layout defect.

## Formatter and verifier

Rust uses the project-selected toolchain rather than a bundled binary. The
pre-write `rustfmt` check is **optional** (`formatRust` is disabled by default),
because the active toolchain and `rustfmt.toml` belong to the project. When it
is enabled, the guard compares pending content with `rustfmt --emit stdout` and
fails closed if rustfmt is unavailable.

Run project-aware detailed checks from the Rust project root:

```text
cargo fmt --check
cargo clippy -- -D warnings
```

Use `cargo fmt` to apply formatting only after reviewing semantic documentation
changes. Rustfmt and Clippy cannot establish whether a prose claim is true; ask
the author when code and tests do not define the contract.
