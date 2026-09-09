# Rust Documentation Rules

Author: Perijn Huijser

Use crate-level and public-item rustdoc comments. Check formatting with `cargo fmt
--check` and analyze with Clippy. Public crates should enable compiler and Clippy
missing-documentation lints where their public API warrants it.
