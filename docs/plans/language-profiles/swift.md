# Swift Profile Plan

Author: Perijn Huijser

## Evidence

Apple's [DocC documentation overview](https://www.swift.org/documentation/docc/)
describes its compiler as converting Markdown-based text into framework and
package documentation. Apple's [swift-format README](https://github.com/apple/swift-format/blob/main/README.md)
describes formatting technology used by SourceKit-LSP.

## Candidate scope

- Candidate extension: `.swift`; determine exclusions for generated sources and
  Xcode/Sources package layout from real projects.
- Native header: consecutive `///` doc comments, optionally with Markdown
  headings; file-level DocC semantics need an explicit project convention.
- Public units: public/open/package visibility, protocols, extensions, actors,
  enums, properties, initializers, and async/throws declarations require a
  SourceKit/SwiftSyntax/compiler-backed approach.

## Implementation decisions to prove

1. Decide whether to enforce API docs at symbol level only or also a shared
   file header, because DocC primarily models symbol and article documentation.
2. Evaluate `swift-format` only after verifying installation, version pinning,
   stdin behavior, Swift toolchain compatibility, and host support.
3. Decide whether `swift build`, `swift test`, or DocC generation forms the
   detailed verifier, and how workspace/Xcode projects are discovered.

## Repository changes

Add Swift routing/policy/settings, a `///` extractor that supports attributes
and access modifiers, and a compiler-aware public-symbol strategy. Add tool
provisioning only if the selected formatter can be distributed and checked
safely; otherwise retain detailed-only validation.

## Acceptance fixtures

Cover actor/protocol/extension docs, public versus internal symbols, async
throws comments, attributes before declarations, SwiftPM project discovery, and
missing-tool behavior.
