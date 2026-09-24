# Lua Documentation Rules

Author: Perijn Huijser

Load this reference for Lua after applying `SKILL.md`.

## Scope and comment form

This profile applies to `.lua` files. Write the file header as consecutive
LuaDoc/LDoc-style `---` lines at the beginning of the file, after an optional
BOM and whitespace. Ordinary `--` comments and long comments (`--[[ ... ]]`)
are valid Lua comments, but are not the header shape this profile recognizes.

Shebangs, Luau (`.luau`), generated or vendor files, and framework-specific
preambles need explicit project policy. Do not assume that Lua, LuaJIT, and
Luau share a runtime or documentation convention.

## Implement the shared file header with LuaDoc comments

`SKILL.md` defines the required header fields and the substance of `Usage:`.
In Lua, render them as a readable leading `---` block:

```lua
--- Author: Established Author
--- Summary: Builds the verified request object used by this module's caller.
---
--- Usage:
---   Load the module with `require` and call its documented builder with the
---   established configuration. The caller handles the returned value or the
---   documented failure result according to the module's contract.
---
--- Notes:
---   The builder does not mutate caller-owned configuration when that behavior
---   is established by the implementation.
local M = {}
```

This demonstrates Lua comment layout, not a contract to copy. Replace every
claim with facts established for the target module. Keep a blank `---` line
between Summary, Usage, and optional Notes groups. Use prose, lists, and
Lua-shaped examples within `Usage:` as needed; do not duplicate the universal
requirements from `SKILL.md`.

A module whose interface is its returned table should explain loading and use
from the caller's perspective:

```lua
--- Author: Established Author
--- Summary: Provides the verified archive operations for Lua callers.
---
--- Usage:
---   Load the module with `local archive = require("project.archive")`, then
---   call its documented operations. Callers inspect the documented result and
---   perform any cleanup required by the established interface.
local archive = {}
```

## Document Lua interfaces at their definition

Lua has no language-level `public` marker. Establish the boundary from project
evidence: fields on a table returned by `require`, documented globals,
metatable methods intended for callers, and callbacks consumed by a framework.
A local function is not automatically private in a useful documentation sense,
and a returned table does not describe its fields by itself.

Place consecutive `---` lines immediately before the public function, table
field, metatable method, or callback definition. Translate shared public-unit
sections into labels that fit Lua contracts, such as `Parameters:`, `Returns:`,
`Errors:`, `Fields:`, `Mutates:`, or `Callback:`. Use LDoc tags such as
`@param` and `@return` only when the project has adopted their exact convention;
plain labelled prose is the default safe form.

```lua
--- Creates the requested archive and returns its established result.
---
--- Parameters:
---   source: Directory accepted by this module's archive workflow.
---   options: Table containing the documented archive options.
---
--- Returns:
---   The archive result described by this module's public contract.
---
--- Errors:
---   Reports the validation or archive failure established by the implementation.
function archive.create(source, options)
    -- Implementation established by the target project.
end
```

Document the shape of a public options or result table where callers need it,
using field names exactly as the code uses them:

```lua
--- Fields:
---   format: Selects a supported output format when provided by the caller.
---   destination: Overrides the verified default destination when provided.
```

Only document `nil` behavior, multiple return values, table ownership or
mutation, globals, metatable dispatch, coroutine yields, callback ordering, and
raised or returned failures when code, tests, or project guidance establish
them. Document a local helper when a non-obvious lifecycle, resource, or safety
constraint warrants it; otherwise, routine private-helper documentation is not
required.

## Lua-specific writing conventions

- Keep the comment directly adjacent to the declaration or assignment it
  documents. For `M.name = function(...)`, document the assignment rather than
  a detached local helper.
- Distinguish `nil`, `false`, absent table fields, and empty tables when the
  module contract distinguishes them. State multiple return positions in order
  when callers rely on them.
- Name method-call syntax accurately: `object:method(value)` passes the receiver
  as `self`, while `object.method(value)` does not. Describe the distinction only
  when it matters to the established API.
- For callbacks and coroutines, document who invokes or resumes whom, the
  expected arguments, yield/return behavior, and cleanup only when known.
- Use implementation comments to explain non-obvious metamethod, scoping,
  iteration, or resource-lifetime choices; do not narrate obvious Lua syntax.

## Tooling boundaries

Use a Lua-aware adapter for module return values, globals, metatables, framework
exports, and generated bindings. Do not infer or mandate LDoc, StyLua, Luacheck,
Lua/LuaJIT versions, or documentation generation without target-project
configuration.
