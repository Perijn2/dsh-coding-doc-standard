---
name: coding-doc-standard-lua
description: >-
  Lua documentation rules for the coding documentation standard: the universal
  contract written in Lua's native EmmyLua comment syntax. Load for any task
  touching .lua files.
---

# Lua Language Pack

Lua files follow the shared contract — Author, brief Summary, brief Description,
optional Usage, Changelog, and Notes — written as `---` line comments directly
after any shebang.

## File header

```lua
#!/usr/bin/env lua
--- Author: Perijn Huijser
--- Summary: Keeps integer arithmetic behind one documented module.
--- Description: A short paragraph expanding the summary: what this module is,
--- why it exists, and any behavior a reader should know before using it.
--- Usage: Call M.add for sums and M.divide for guarded division; both are
--- demonstrated below.
--- Notes: Only what is verified belongs here; omit when there is none.

local M = {}
```

- The header must be the first content after the shebang (or line 1 without one).
- Keep fields in order: Author, Summary, Description, then optional Usage,
  Changelog, Notes.
- Summary and Description stay brief; never pad them to look complete.
- Usage, when present, must talk about the functions this file actually exposes.

## Public functions

Every function declaration needs an attached `---` doc block whose first line is
the summary, followed by `@param`, `@return`, and `@error` sections when
meaningful:

```lua
--- Adds two integers and writes the sum.
--- @param left First integer operand.
--- @param right Second integer operand.
--- @return The integer sum of both operands.
function M.add(left, right)
	return left + right
end
```

Omit a section when its content is unknown; never invent facts to fill the
template. Stale documentation blocks writes — fix the doc and the code together.
