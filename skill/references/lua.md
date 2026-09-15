# Lua Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It checks only a conservative leading
`---` house header for `.lua` files. It has no LDoc semantic validation,
module/public-symbol parser, formatter, linter, or detailed verifier yet.

## Supported header shape

Start the file with consecutive `---` lines after an optional BOM and whitespace.
The block must contain `Author:`, `Summary:`, and `Usage:`. This is an explicit
package house contract; it does not claim that every Lua project or LDoc setup
uses a file-level header in this form.

Shebangs, ordinary `--` comments, long comments, Luau (`.luau`), generated or
vendor files, and other preambles are unsupported in this version. The profile
fails when enabled instead of inferring a Lua dialect or module convention.

## Native Lua guidance

Lua supports line and long comments. LDoc/LuaDoc-compatible annotations require
project conventions, and exports vary with return-table, global, and framework
patterns. Do not approximate public API coverage with a regular expression.

## Current limits

Do not infer that this profile runs StyLua, Luacheck, Lua, or LuaJIT. Dialect,
module roots, tool versions, and verification commands require target-project
evidence.