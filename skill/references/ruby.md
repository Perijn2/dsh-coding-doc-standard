# Ruby Documentation Rules

Author: Perijn Huijser

Load this reference for Ruby after applying `SKILL.md`.

## Preamble and file header

Keep a shebang first. Ruby magic comments (`coding`, `frozen_string_literal`, or
`typed`) must remain in their required positions; place the `#` header after that
preamble and before code. `SKILL.md` defines the header content; implement it as
consecutive comments:

```ruby
#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Author: Established Author
# Summary: Loads the verified report configuration for callers.
#
# Usage:
#   Require this file, construct the documented object, and handle the result or
#   failure behavior established by the target implementation.
```

This is syntax only. Replace its claims with target facts. Extensionless Ruby
files, `__END__`, generated files, and framework preambles need project policy.

## Attach YARD documentation to caller-facing units

Ruby has no static public boundary. Use project evidence for public classes,
modules, constants, methods, singleton methods, and DSL interfaces. Put a YARD
block directly before the declaration it documents; `private` and `protected`
methods are not public without an established extension contract.

```ruby
# Builds the report requested by the caller.
#
# @param source [String] source accepted by the established report workflow.
# @param options [Hash] documented report options.
# @return [Report] result described by this API's contract.
# @raise [ReportError] when the known report operation fails.
def build_report(source, options)
  # Implementation established by the target project.
end
```

Use tags only when the project uses YARD. Describe yielded values, mutation,
return shape, and exceptions only when established; comments on dynamic methods
or DSL declarations must identify the actual caller-facing contract.

## Ruby-specific writing conventions

- Keep documentation adjacent to `def`, `class`, `module`, or the DSL call it
  describes; reopened classes and generated methods require project context.
- Document keyword arguments and blocks by their real names, including whether a
  block is yielded to or required, when known.
- Use prose for lifecycle, ownership, or callback obligations that cannot be
  expressed by a YARD tag; do not invent a type or exception merely for tags.

## Tooling boundaries

Do not infer or mandate Bundler, RuboCop, StandardRB, YARD, or Ruby tests.
Project roots, tool versions, and documentation coverage must be proven by the
target project.
