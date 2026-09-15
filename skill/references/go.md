# Go Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It currently enforces only a structural
leading package-documentation header for `.go` files. It has no formatter,
public-declaration parser, generated-code exclusion policy, or detailed verifier
yet.

## Supported header shape

Place consecutive `//` documentation lines immediately before `package <name>`.
The block must contain the shared house labels `Author:`, `Summary:`, and
`Usage:`. Derive every value from the package implementation and tests; do not
invent a package contract to satisfy the labels.

A canonical initial Go build-constraint block (`//go:build` or legacy
`// +build`) followed by its required blank separator may appear before the
package documentation header. Other preambles are not supported by this first
profile version and fail when the opt-in policy is enabled.

## Native Go guidance

Go's native documentation convention places `//` doc comments immediately
before the declaration they document. Package documentation belongs immediately
before `package`; exported-name coverage is intentionally not enforced until a
Go parser and package-aware policy are implemented.

## Current limits

Do not infer that this profile runs `gofmt`, `go vet`, `go test`, or a
project-level documentation generator. Select and test those project tools in a
later formatter/verifier phase.