# Swift Documentation Rules

Author: Perijn Huijser

Load this reference for Swift after applying `SKILL.md`.

## Scope and comment form

This profile applies to `.swift` files. Swift's native documentation model is
DocC: Markdown written in `///` line comments (or `/** ... */` block comments)
immediately above a declaration. DocC renders the first paragraph as the
symbol's abstract and turns the rest into a documentation page. The header this
profile recognizes is a leading run of `///` lines at the start of the file,
after an optional BOM and whitespace.

Attributes (`@available`, `@_exported`), `import` lines, build directives,
`.swiftinterface` files, macro-expanded declarations, and generated files need
explicit project ownership and exclusion policy. Do not move a required
attribute or generated preamble merely to fit this header shape, and do not
treat a declaration's presence in a public module as evidence that its DocC is
accurate.

## Implement the shared file header with DocC comments

`SKILL.md` defines the required header fields and the substance of `Usage:`.
In Swift, render them as a readable leading `///` block, using DocC Markdown
inside `Usage:` as needed:

```swift
/// Author: Established Author
/// Summary: Builds and validates the verified request used by this module.
///
/// Usage:
///   Create a ``RequestBuilder``, set its documented properties, and call
///   ``build()`` to obtain a validated ``Request``. Callers own the returned
///   value and release any resources it documents. The build throws the
///   documented validation error when required fields are missing.
///
/// Notes:
///   The builder does not mutate the configuration it was given when that
///   behavior is established by the implementation.
```

This demonstrates DocC layout, not a contract to copy. Replace every claim with
facts established for the target file. Keep one blank `///` line between the
Summary, Usage, and optional Notes groups. For a library target, describe the
public entry points a caller reaches through the module rather than restating
`SKILL.md`:

```swift
/// Author: Established Author
/// Summary: Provides the verified archive operations for Swift callers.
///
/// Usage:
///   Import the module and use ``Archive`` to create and open archives. Callers
///   handle the documented thrown errors and close any handle the API exposes.
///   See each operation's own documentation for its parameters and failures.
```

## Document Swift API at its declaration

Swift provides native access control, so the public boundary is a declared
modifier: `public` and `open` declarations are public, and `internal` is public
only where the module's project API deliberately exposes it. Confirm the
boundary against the target project's access-control policy, including
`package` access and `@_exported` re-exports. A declaration is not public
merely because it is top-level or named in prose.

DocC is Markdown-first. Structure each public unit with the abstract first, then
DocC's own special sections in their native form. Use `- Parameters:` with
indented `- name:` entries, `- Returns:`, and `- Throws:` only when the content
is known. Write asides as block quotes (`> Important:` or `> Note:`). Link
related symbols with double backticks, and name parameters by their external
argument label and full signature form (for example, `save(to:format:)`):

```swift
/// Writes the archive to the destination and reports the written location.
///
/// Use this after configuring the source. The returned value is owned by the
/// caller.
///
/// - Parameters:
///   - destination: File URL accepted by this archive workflow.
///   - format: One of the documented output formats.
/// - Returns: The URL of the archive that was written.
/// - Throws: The validation or I/O failure established by the implementation.
///
/// - Important: This performs blocking file I/O; call it off the main thread
///   when the project's threading contract requires it.
public func save(to destination: URL, format: ArchiveFormat) throws -> URL {
    // Implementation established by the target project.
}
```

Document async and concurrency only where the code defines it: whether a method
is `async`, `throws`, or `async throws`; the actor or isolation domain it runs
in; `Sendable` conformance and any task-cancellation behavior. Document
mutability and value semantics (copy-on-write), optionality of each parameter and
return, generic constraints, and availability (`@available`) when they affect
callers. Describe protocol requirements at the protocol and their conformance at
each conforming type when both are part of the public surface.

```swift
/// Loads and returns the verified resource for the caller.
///
/// - Parameter identifier: Identifier accepted by this module's lookup.
/// - Returns: The resolved resource value.
/// - Throws: The documented error when the resource cannot be resolved.
///
/// - Note: Safe to call concurrently under the actor isolation this type
///   declares.
public func load(identifier: String) async throws -> Resource {
    // Implementation established by the target project.
}
```

Only document thread safety, cancellation, locking, generated or synthesized
members, property wrappers, macros, and availability when code, tests, or
project guidance establish those facts. A private or `fileprivate` helper needs
no routine documentation; document it when a non-obvious lifecycle, safety, or
resource constraint matters.

## Swift-specific writing conventions

- Put the abstract in the first paragraph of the DocC comment; everything that
  follows is the rendered discussion. Do not place a tag on the abstract line.
- Use double backticks (`` ``Symbol`` ``) to link Swift symbols in prose, and
  single backticks for literal code. The distinction controls DocC linking.
- Match argument labels exactly in prose and examples: `save(to:format:)`, not
  just `save`. Name a type with its module when the link would otherwise be
  ambiguous.
- Distinguish `throws`, `rethrows`, `try?`, and `try!` handling and state the
  real failure mode; never claim a specific error type the code does not throw.
- State `async`/await, actor isolation, `Sendable`, and value-versus-reference
  semantics precisely when the declaration uses them; these are part of the
  contract, not incidental detail.
- Keep implementation comments focused on why a Swift-specific choice (copy-on-
  write, generic constraint, concurrency domain, availability gate) is
  necessary; do not narrate obvious syntax.

## Tooling boundaries

Use a DocC- and access-control-aware adapter to resolve public surface,
extensions, protocol conformances, actors, macros, and generated `.swiftinterface`
API. Do not infer or mandate `swift-format`, Swift Package Manager, Xcode
builds, tests, or `docc` catalog generation; select those from the target
project's configuration.
