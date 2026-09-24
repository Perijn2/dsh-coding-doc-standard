# Dart Documentation Rules

Author: Perijn Huijser

Load this reference for Dart after applying `SKILL.md`.

## Scope and comment form

This profile applies to `.dart` files. Dart's native documentation model is
dartdoc: Markdown written in `///` line comments attached to a declaration.
dartdoc renders the first sentence as the summary and links named API elements
that appear in square brackets, such as `[Archive]` or a parameter `[path]`. The
header this profile recognizes is a leading run of `///` lines at the start of
the file, after an optional BOM and shebang.

Dart marks library privacy with a leading underscore: a name beginning with `_`
is private to its library. Public API is therefore the set of declarations that
do **not** begin with `_`, filtered by the library's `export`/`show`/`hide`
combinators and the package's own visibility policy. A top-level declaration is
not public simply because it exists in a file.

A `library` directive, `import`/`export`/`part` clauses, annotations, the
`dart format`/`dart analyze` baseline, `.g.dart` generated code, and
Flutter-generated files need explicit project ownership and exclusion policy.
Place the doc comment before the `library` directive and any library-level
annotations; do not relocate a required directive to fit this header shape.

## Implement the shared file header with dartdoc comments

`SKILL.md` defines the required header fields and the substance of `Usage:`.
In Dart, render them as a readable leading `///` block. Place it before the
`library` directive when the file has one, using dartdoc Markdown inside
`Usage:` and square brackets to name real API elements:

```dart
/// Author: Established Author
/// Summary: Builds and validates the [Request] used by this library.
///
/// Usage:
///   Create a [RequestBuilder], set its documented properties, and call
///   [RequestBuilder.build] to obtain a validated [Request]. Callers own the
///   returned value. A failed build throws the documented [ValidationException].
///
/// {@category network}
class RequestBuilder {
  // Implementation established by the target package.
}
```

This demonstrates dartdoc layout, not a contract to copy. Replace every claim
with facts established for the target library. Keep one blank `///` line
between the Summary, Usage, and any directives. Use `{@category}` and
`{@template}`/`{@macro}` only when the package already adopts them. For a
provider library, describe the entry points a caller reaches rather than
restating `SKILL.md`:

```dart
/// Author: Established Author
/// Summary: Provides the verified archive operations for Dart callers.
///
/// Usage:
///   Import this library and use [Archive] to create and open archives. Callers
///   handle the documented thrown errors and close any [Archive] handle the API
///   exposes. See each operation's own documentation for its parameters.
library;
```

## Document Dart API at its declaration

Document each public class, mixin, extension, enum, constructor, method, getter,
setter, top-level function, variable, constant, and exported typedef with an
adjacent `///` comment. Dart's documentation style is prose-first: describe each
parameter in a sentence and link it with square brackets (`[path]`), and name
errors with their real type (`[StateError]`) rather than inventing a tagged
template. Include the shared sections only where their content is known.

```dart
/// Writes the archive to [path] and returns the location that was written.
///
/// Use this after configuring the source. The returned path is owned by the
/// caller.
///
/// The [format] selects one of the supported output formats. This performs
/// blocking file I/O, so call it off the UI isolate when the project's
/// threading contract requires it.
///
/// Returns the written archive path. Throws a documented `FileSystemException`
/// when validation or the write fails.
String save(String path, {required ArchiveFormat format}) {
  // Implementation established by the target package.
}
```

Document nullability of each parameter and return, named versus positional
parameters, default values, `Future` results and their completion or error
behavior, `Stream` events and how they terminate, and mutation of caller-owned
objects only when code or tests establish those facts. Document async
`await`/`async` and isolate/thread expectations precisely where the declaration
uses them.

For a public options or configuration type, document each field with its role and
whether it is required:

```dart
/// Options accepted by [Archive.create].
///
/// The required [name] sets the archive name. The optional [compress] flag
/// enables compression for supported [ArchiveFormat] values.
class CreateOptions {
  final String name;
  final bool compress;
  // Constructor and defaults established by the target package.
}
```

Generated code, `part` files, Flutter framework members, export barrels, and
re-exports require analyzer and package context; do not classify a `part`-local
or `_`-prefixed member as public. Mark a declaration deliberately undocumented
with `{@nodoc}` only when the project uses that directive. A private helper needs
no routine documentation; document it when a non-obvious lifecycle, resource, or
safety constraint matters.

## Dart-specific writing conventions

- Put the summary as the first sentence of the `///` comment; everything that
  follows is the rendered description. Do not place a tag on the summary line.
- Use square brackets to link real API elements and parameters (`[Archive]`,
  `[path]`); an unlinked name does not resolve and a wrong one links to nothing.
- Name thrown failures with their real type and explain what triggers them; never
  invent an exception type the code does not throw.
- Distinguish `Future<T>`, `Stream<T>`, and synchronous results and state when
  each completes or errors; this is part of the contract, not incidental detail.
- State nullability and required-versus-default arguments exactly as the
  signature declares them.
- Use `{@template}`/`{@macro}` for reused doc blocks and `{@category}` for
  grouping only when the package already relies on those dartdoc directives.
- Keep implementation comments focused on why a Dart-specific choice (async
  sequencing, null-safety check, isolate boundary, mixin behavior) is necessary;
  do not narrate obvious syntax.

## Tooling boundaries

Use a Dart-analyzer- and dartdoc-aware adapter to resolve library boundaries,
exports, privacy, generated `.g.dart` code, and package visibility. Do not
infer or mandate `dart format`, `dart analyze`, Dart tests, or `dartdoc`
generation; select those from the target package or Flutter project.
