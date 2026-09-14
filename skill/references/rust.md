# Rust Documentation Rules

Author: Perijn Huijser

Use crate-level and public-item rustdoc comments. When enabled, check each pending
candidate with the project toolchain's `rustfmt` before writing; use `cargo fmt
--check` and Clippy during detailed verification. Public crates should enable
compiler and Clippy missing-documentation lints where their public API warrants it.
