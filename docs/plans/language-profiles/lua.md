# Lua Profile Plan

Author: Perijn Huijser

## Evidence

[LDoc](https://stevedonovan.github.io/ldoc/) is a Lua documentation generator;
the project describes it as compatible with LuaDoc-style annotations. The
[lunarmodules LDoc repository](https://github.com/lunarmodules/ldoc) states that
it supports LuaDoc-compatible documentation and optional Markdown rendering.

## Candidate scope

- Candidate extension: `.lua`; decide generated/vendor directories and whether
  Luau is explicitly out of scope or needs its own profile.
- Native header: `---` LuaDoc/LDoc annotations or a project-approved multiline
  comment; select one normative shape after inspecting target projects.
- Public units: module-table fields, returned tables, globals, functions, and
  metatable methods have no single language-level public marker. Public API
  enforcement needs an explicit module convention and a Lua parser.

## Implementation decisions to prove

1. Select LDoc/LuaDoc annotation style and how the shared Author/Summary/Usage
   header maps onto it.
2. Select formatter/linter only after project evidence; StyLua and luacheck are
   candidates, not package commitments.
3. Define module discovery (`return M`, globals, framework conventions) before
   claiming public-unit coverage.

## Repository changes

Add Lua routing/policy/settings, native header extraction, and only
convention-backed public API checks. Add a formatter adapter after its stdin
behavior, configuration lookup, and host distribution are proven. Add an LDoc
detailed-verification mode only with a testable project config.

## Acceptance fixtures

Cover a returned module table, global function, local function, annotation
blocks, multiline comments, framework-specific convention exclusion, formatter
pass/fail, and missing-tool optional behavior.
