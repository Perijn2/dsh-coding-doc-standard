---
name: coding-doc-standard-lua
description: >-
  Native LuaDoc syntax for the coding documentation standard: leading ---
  blocks for file headers and public functions. Load together with
  coding-doc-standard for any task touching .lua files.
---

# Lua Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Lua. The file `example.lua` next to this skill is the
golden reference — a complete, working module documented to the standard;
copy its shape when unsure.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Preserve existing project conventions; the formatter never renames declarations.
The [Lua manual §3.1](https://www.lua.org/manual/5.4/manual.html#3.1) defines
case-sensitive identifiers made of letters, digits, and underscores, not
starting with a digit or equal to a reserved word. Avoid underscore-plus-uppercase
names reserved by convention for Lua. Neither it nor
[Programming in Lua §1.3](https://www.lua.org/pil/1.3.html) establishes a universal
snake_case-function, PascalCase-type, or ALL_CAPS-constant policy: choose casing
with the project. `read_status` and `readStatus` are different valid names;
tables used as classes or enums do not acquire a language-mandated casing rule.
See the source survey in [Declaration naming](../../../docs/naming.md).

## File header — leading `---` block

```lua
--- Author: Perijn Huijser
--- Summary: Map raw codec status bytes to pipeline stages.
---
--- Description:
---     Expand the summary briefly, then work an example through the
---     module: how a caller feeds bytes in, what comes back under each
---     condition, what to do when the map misses.
---
--- Changelog:
---     2026-08: Added strict mode for unknown statuses.
```

## Function documents

Attach a `---` block above every public function; the first line is the
imperative summary.

```lua
--- Normalize a status label to lowercase.
--- @param value  (in) string:      the raw label
--- @param strict (in) boolean|nil: raise instead of returning nil on unknown labels
--- @return normalized string|nil: lowercase label; nil when value is not a string or the label is unknown and strict is false
--- @error bad_arg: value is not a string
function normalize_label(value, strict)
	-- ...
end
```

- The `(in)` / `(out)` / `(in-out)` marker follows the `@param` name, before
  the type.
- `@return` prose must cover every distinct result case; `@error` only for
  failures the code actually raises.
- Local helpers need no document; anything the module returns to callers
  carries one.

## Examples

State the example in plain `---` comment prose under an `Example:` line;
comment the result after each call.

```lua
--- Turn a title into a URL slug.
--- @param title (in) string: the human title
--- @return slug string: lowercase hyphenated text; "untitled" when no
---   usable letters remain
--- Example:
---     slugify("Hello, World!")  -- "hello-world"
function slugify(title)
	-- ...
end
```

## Other public kinds

Lua has no enums or visibility: an “enum” is a constant table, and the
module table it returns is the public surface.

```lua
--- Pick how many attempts one call may spend. Chosen by caller patience.
--- @class Budget
--- @field ONCE 1: no retries, for callers that only log the outcome
--- @field FAST 3: two retries, for interactive callers waiting on the result

--- Seconds to wait between attempts; range 1..10. Change only with the network team.
M.ATTEMPT_INTERVAL_SECONDS = 5.0
```

- Document each exported field of the module table with a `---` block or
  `@field` line stating what it controls and its unit.
- A class-like table gets a `@class` block saying what it represents and how
  instances are obtained; its public methods follow the function rules.
