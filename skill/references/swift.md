# Swift Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It checks only a conservative leading
`///` house header for `.swift` files. It has no DocC semantic validation,
public-declaration parser, formatter, or detailed verifier yet.

## Supported header shape

Start the file with consecutive `///` lines after an optional BOM and whitespace.
The block must contain `Author:`, `Summary:`, and `Usage:`. Treat these as this
package's explicit structural header contract, not as a universal native DocC
file-documentation construct.

Imports, attributes, directives, shebangs, Swift scripts, `.swiftinterface`,
generated-source markers, and other preambles are unsupported in this version.
The profile fails when enabled rather than guessing which declaration a comment
belongs to.

## Native Swift guidance

Swift DocC documents modules and declarations. Access control, extensions,
actors, protocol requirements, and generated interfaces require a Swift-aware
parser or compiler model before public API coverage can be enforced.

## Current limits

Do not infer that this profile runs `swift-format`, SwiftPM, Xcode builds,
tests, or DocC. Tool selection and package/workspace discovery remain a later
project-aware phase.