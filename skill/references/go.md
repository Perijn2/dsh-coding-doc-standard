# Go Documentation Rules

Author: Perijn Huijser

Load this reference for Go after applying `SKILL.md`.

## Package preamble and header

Place consecutive `//` documentation lines immediately before `package name`.
A canonical `//go:build` or legacy `// +build` block may precede the header,
followed by its required blank line. Do not put the package documentation before
the build constraints.

`SKILL.md` defines the required header fields and the substance of `Usage:`. In
Go, write those fields as package documentation:

```go
// Package labels normalizes the verified labels used by callers.
//
// Author: Established Author
// Summary: Normalizes labels for case-insensitive comparison.
//
// Usage:
//   Import this package, call its documented normalization operation, and handle
//   its established result or error contract at the caller boundary.
package labels
```

The example is layout only. Replace all claims with facts established by the
target package. Generated files, package comments separated by other
preambles, and unsupported build conventions require project policy.

## Attach Go documentation to exported declarations

Go documentation is consecutive `//` lines directly preceding a declaration.
Exported identifiers begin with an uppercase letter; document additional
package-facing interfaces only when project policy makes them public. Start the
comment with the identifier name, as Go documentation conventions expect.

```go
// NormalizeLabel returns the canonical form of a caller-provided label.
//
// The returned value and any error behavior follow the contract established by
// this package.
func NormalizeLabel(label string) string {
	return strings.ToLower(strings.TrimSpace(label))
}
```

Use prose when the signature conveys the input and result. Document non-obvious
error handling, ownership, mutation, concurrency, or lifecycle behavior only
when established. For exported types, methods, constants, variables, commands,
and configuration, attach comments to the declaration callers use; do not add a
separate API inventory.

## Go-specific writing conventions

- Keep the package comment immediately adjacent to `package`; keep declaration
  comments immediately adjacent to their declarations.
- For a named result, describe its meaning rather than restating its Go type.
  For an error result, state recognized failure behavior only when known.
- Describe interface contracts at the interface or method that owns them. Do not
  invent guarantees for implementations, embedding, or nil receivers.
- Use `ExampleName` test functions only when project tests establish a complete,
  correct workflow; Go examples may be rendered by `go doc`.

## Tooling boundaries

A project adapter is required for mechanical exported-symbol coverage, build-tag
resolution, generated-source exclusions, or package-graph semantics. Do not
infer or mandate `gofmt`, `go vet`, `go test`, `go doc`, or a documentation
generator; select versions and commands from the target project.
