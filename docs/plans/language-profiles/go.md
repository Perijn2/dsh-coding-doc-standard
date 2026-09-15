# Go Profile Plan

Author: Perijn Huijser

## Evidence

Go's official [doc-comment guide](https://go.dev/doc/comment) defines doc
comments as immediately preceding top-level declarations and states that exported
(capitalized) names should have doc comments. [Effective Go](https://go.dev/doc/effective_go)
describes `gofmt` / `go fmt` as the standard formatter and notes that it also
reformats comments.

## Candidate scope

- Candidate extensions: `.go`; confirm generated-code markers and vendored-path
  exclusions from real target repositories before routing them.
- Native header: package documentation comment immediately preceding `package`.
- Public units: exported package names, functions, types, methods, constants,
  and variables. Use a Go parser/AST rather than capitalization-only regexes so
  receiver methods, grouped declarations, and build-tag files are handled.

## Implementation decisions to prove

1. Decide whether every `.go` file needs a module header or only package-level
   documentation files. Go's native model is package documentation, so forcing a
   per-file header needs explicit user approval.
2. Verify `gofmt` can compare pending stdin content while retaining the target
   filename for build tags and imports. If not, classify formatting as
   project-aware detailed verification.
3. Confirm whether `go vet` is sufficient for the detailed baseline or whether
   the project already selects additional analysis.

## Repository changes

Add a `go` language flag and optional formatter flag in `defaults.json`; route
`.go` in `checker.py`, `run.mjs`, and `verify.mjs`; expose matching host-schema
and client controls; add Go header/public-unit/parser fixtures; and promote this
file to `skill/references/go.md` only after those checks work.

## Acceptance fixtures

Include package docs before `package`, an exported declaration with and without
a doc comment, an unexported declaration, build tags before the package docs,
and gofmt pass/fail/missing-tool cases. Verify detailed commands run once from
the Go module root, not once per file.
