# Project Public-Unit Adapters

Author: Perijn Huijser

## Purpose

Use a project-owned adapter when public API documentation depends on compiler or
analyzer semantics. The write guard supplies the proposed candidate content; the
adapter resolves exports, visibility, generated-source policy, and native
comment binding using the target project's selected toolchain.

The guard never writes a pending candidate to disk. An adapter that needs a
virtual overlay is responsible for constructing and cleaning it up.

## Enablement

Each project adapter is disabled by default and optional. Tree-sitter provides the
baseline declaration-documentation check for supported language profiles without
an adapter. Configure an adapter only when a project needs compiler-level exports,
visibility, generated-source, macro, or re-export semantics. Once configured, an
unavailable, invalid, failing, or timed-out adapter fails closed.

This package includes native-tool adapters for Rust and C/C++, but they are
explicitly configured. The pre-write checker does not guess a compiler, infer
include paths, or invoke Clang/Doxygen without a project-owned adapter.

The Rust and project-configured C/C++ adapters remain available as explicit
adapter commands:

```json
{
  "publicUnitDocs": { "rust": true, "cCpp": true },
  "publicUnitAdapters": {
    "rust": {
      "command": "node",
      "args": ["scripts/rust-public-unit-adapter.mjs"]
    },
    "cCpp": {
      "command": "node",
      "args": ["scripts/cpp-public-unit-adapter.mjs"]
    }
  }
}
```

The Rust adapter invokes `rustdoc --deny missing_docs` against an isolated
candidate. The C/C++ adapter invokes Doxygen against an isolated candidate; its
coverage is limited by the installed Doxygen version and project include/config
requirements. When a project has Clang or a richer Doxygen configuration, prefer
an adapter owned by that project for complete public-surface semantics.

```json
{
  "publicUnitDocs": {
    "go": true
  },
  "publicUnitAdapters": {
    "go": {
      "command": "path/to/project-doc-adapter",
      "args": ["--project", "path/to/go.mod"],
      "cwd": "path/to/project",
      "timeoutMs": 10000
    }
  }
}
```

`command` is required. `args` is an optional string array. `cwd` is optional and
otherwise inherits the pending write's working directory. `timeoutMs` defaults
to 10 seconds and must be between 1 and 60,000 milliseconds.

## Input and output protocol

The guard writes exactly one JSON input object to adapter stdin:

```json
{
  "path": "relative-or-absolute/candidate-path",
  "content": "the complete pending candidate text",
  "cwd": "the pending write working directory"
}
```

An adapter exits zero and writes exactly one JSON result object to stdout:

```json
{
  "violations": [
    {
      "line": 42,
      "kind": "exported function",
      "name": "normalize",
      "message": "Missing native documentation."
    }
  ]
}
```

`violations` must be an array. `message` is required; `line`, `kind`, and `name`
are optional. Nonzero exits, malformed output, unavailable commands, and
timeouts are blocking only for enabled adapter modes.

## Native responsibilities

An adapter must use the project-selected parser/compiler/analyzer rather than
regular expressions to establish its public surface. It must define the
project's treatment of protected/internal access, re-exports, generated or
vendor sources, partial declarations, enum cases/constructors/properties, and
intentionally suppressed documentation.

Use native forms: Go doc comments, XML documentation, Javadoc, KDoc, rustdoc,
PHPDoc, YARD, Dart docs, Swift DocC comments, Scaladoc, Haddock, or Elixir
`@moduledoc`/`@doc`. Shell, Lua, and Compose need an explicit project API
convention before an adapter can assert public-unit coverage.
