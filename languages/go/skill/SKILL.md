---
name: coding-doc-standard-go
description: >-
  Native GoDoc syntax for the coding documentation standard: leading //
  blocks for file headers and functions, methods, and named types. Load
  together with coding-doc-standard for any task touching .go files.
---

# Go Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Go. The file `example.go` next to this skill is the golden
reference — a complete, working package documented to the standard; copy its
shape when unsure.

## Declaration naming

Use [Effective Go: Names](https://go.dev/doc/effective_go#names) for new
declarations. These guide conventions are not a promise of whole-guide
compliance; initial capitalization controls export visibility in Go itself.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Types, functions, methods | `MixedCaps` (MixedCaps or mixedCaps): `RequestState`, `readLabel` | Functions, methods, named types |
| Constants | `MixedCaps`: `MaxRetries`, `maxRetries`, not a special ALL_CAPS style | Every name in constant declarations |
| Packages | Short lowercase names: `codec` | Unchecked |
| Variables and fields | MixedCaps or mixedCaps: `requestID` | Unchecked |

Go has enumerated constants, not enum declarations. The checker retains either
exported or unexported capitalization; it does not choose visibility, resolve
interface/foreign names, or validate initialism spelling (`HTTP`, `ID`). There
is no semantic constant inference. Leading/trailing underscores are ignored for
casing, not permission to use reserved names. References, strings, and comments
are not checked. Check/block only reports or rejects naming violations; it
never renames declarations.

## File header — leading `//` block

```go
// Author: Perijn Huijser
// Summary: Map raw codec status bytes to pipeline stages.
//
// Description:
//     Expand the summary briefly, then work an example through the
//     package: how a caller feeds bytes in, what comes back under each
//     condition, what to do when the map misses.
//
// Changelog:
//     2026-08: Added strict mode for unknown statuses.
```

The header block sits at the very top of the file; a blank line ends it.
The package clause follows, and its own `// Package x ...` doc comment comes
below the header block.

## Unit documents

Attach a `//` block directly above every function, method, and named type;
the first line is the imperative summary (Go convention: start it with the
unit's name).

```go
// Normalize returns the canonical label for value, or "" when value is
// not a known status. Unknown labels in strict mode are the caller's
// error to log, never this function's to hide.
func Normalize(value string, strict bool) string {
	// ...
}
```

- Struct fields carry their own `//` line when their meaning is not obvious
  from the name; state units and bounds ("seconds", "1..10").
- Errors: say in the prose what the function does on failure — returned
  error value, zero value, or panic — instead of listing error types.

## Examples

State examples in plain `//` comment prose; comment the result after each
call.

```go
// Slug turns a title into URL-safe text; "" becomes "untitled".
//
//     Slug("Hello, World!")  // "hello-world"
func Slug(title string) string {
	// ...
}
```
