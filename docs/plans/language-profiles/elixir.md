# Elixir Profile Plan

Author: Perijn Huijser

## Current rollout status

Deferred from the header-only rollout. Elixir's native module documentation is
`@moduledoc` inside `defmodule`, so a leading file-comment guard would invent a
non-native contract and would not validate the documented module. Promote this
plan only with an AST/module-aware implementation that defines `.ex` and `.exs`
scope, `@moduledoc false`, and `@doc` coverage.

## Evidence

Elixir's [writing-documentation guide](https://hexdocs.pm/elixir/writing-documentation.html)
states that `@moduledoc` documents a module and `@doc` documents a function.
The official [`mix format`](https://hexdocs.pm/mix/Mix.Tasks.Format.html) task
formats project files, while [Credo](https://hexdocs.pm/credo/basic_usage.html)
documents its strict static-analysis mode.

## Candidate scope

- Candidate extensions: `.ex` and `.exs`; decide how Mix config and migration
  scripts differ from ordinary module files.
- Native header: `@moduledoc` after module declaration; the shared file-header
  contract needs a language-specific mapping because module docs are attributes,
  not leading comments.
- Public units: public `def`, macros, guards, behaviours, protocols, structs,
  and callbacks. A parser must distinguish `def` from `defp` and account for
  generated code or macro expansion.

## Implementation decisions to prove

1. Decide whether `@moduledoc` / `@doc` are the enforced profile surface and
   how single-file scripts without a module are handled.
2. Treat `mix format`, compiler checks, and Credo as project-aware; confirm Mix
   root discovery and non-mutating formatter behavior.
3. Decide whether ExDoc generation is required for detailed documentation
   verification and record project configuration prerequisites.

## Repository changes

Add Elixir policy/settings/routing, a module-attribute extractor, parser-backed
public-definition checks, and a Mix-root verifier adapter. Keep pre-write
formatting off until stdin/check semantics and tool availability policy are
proven.

## Acceptance fixtures

Cover `defmodule`, `@moduledoc false` (explicit exclusion decision), `@doc`,
public/private functions, macros, `.exs` scripts, Mix project discovery, and
format/lint missing-tool behavior.
