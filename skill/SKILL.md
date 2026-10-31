---
name: coding-doc-standard
description: >-
  Enforces evidence-based documentation and formatter requirements across the
  supported language references. Load only the language references relevant to
  the task.
---

# Coding Documentation Standard

Author: Perijn Huijser

Apply this shared contract before loading the relevant language reference. Load
only the profiles that match files in scope; load every applicable reference for
a multi-language task.

| File kind | Reference |
|---|---|
| Python | [references/python.md](references/python.md) |
| TypeScript / JavaScript | [references/typescript-javascript.md](references/typescript-javascript.md) |
| Rust | [references/rust.md](references/rust.md) |
| C / C++ | [references/c-cpp.md](references/c-cpp.md) |
| Docker Compose | [references/docker-compose.md](references/docker-compose.md) |
| Go | [references/go.md](references/go.md) |
| C# | [references/csharp.md](references/csharp.md) |
| Java | [references/java.md](references/java.md) |
| Kotlin | [references/kotlin.md](references/kotlin.md) |
| Shell | [references/shell.md](references/shell.md) |
| PHP | [references/php.md](references/php.md) |
| Ruby | [references/ruby.md](references/ruby.md) |
| Swift | [references/swift.md](references/swift.md) |
| Dart | [references/dart.md](references/dart.md) |
| Haskell | [references/haskell.md](references/haskell.md) |
| Lua | [references/lua.md](references/lua.md) |
| Scala | [references/scala.md](references/scala.md) |

## The hard rule: establish facts or ask

Never invent an author, behavior, parameter meaning, unit, range, return shape,
error, failure mode, operational step, or usage example. Derive documentation
from implemented code, tests, configuration, and established project guidance.
When a required fact is unavailable, ask the user for that precise fact instead
of adding a plausible sentence or placeholder.

Ask for the smallest missing detail:

| Missing fact | Ask the user |
|---|---|
| Author | Who is the author of this file or module? |
| Behavior | What is the intended behavior of `<unit>`? The implementation does not establish it. |
| API contract | What are the parameters, return value, and known errors for `<unit>`? |
| Usage | What is the setup, normal workflow, and supported call pattern for this module? |

Illustrations in the language references demonstrate **documentation syntax and
layout only**. Do not paste them into production code until every factual claim
matches the target implementation.

## Required document shapes

### File or module header

Every supported source file begins with a shebang if requierd followed by one native multiline documentation
header. Docker Compose uses a leading YAML-comment header instead. Keep these
fields in order:

1. **Author** - a real, established author; never guessed.
2. **Summary** - one sentence describing the file or module responsibility.
3. **Usage** - a detailed, evidence-based guide for a new caller or operator.
   Usage is not a fixed five-part template. Choose native prose, headings, and
   examples that materially help someone use this specific file. Depending on
   the implementation, explain its real responsibility, setup and prerequisites,
   normal workflow and lifecycle, capabilities and limitations, public APIs by
   task, result/error handling, cleanup, and a complete worked workflow. Include
   only the topics that add value; omit inapplicable topics rather than forcing
   empty labels. A one-expression toy example is insufficient when the file
   exposes setup, state, cleanup, multiple APIs, or operational constraints.
   Every claim must be established by the implementation, tests, configuration,
   or project owner; never invent detail to make the guide look complete.
4. **Notes** - optional; omit it when there is no verified operational caveat.

Do not add an `Includes` inventory. It duplicates declarations and becomes
stale; the task-oriented API guide is the durable replacement.

### Public-unit documentation

Document every public function, method, class, struct, trait, enum, exported
constant, or externally linked API in its language-native form. Keep only
sections whose content is known:

1. **Summary** - first content line; one sentence ending in a period.
2. **Behavior** - when the name and signature do not already make it clear.
3. **Parameters** - each externally meaningful input.
4. **Returns** - meaningful result, ownership, or state effect.
5. **Errors** - only known thrown, returned, or reported failures.
6. **Example** - only when a small correct usage is derivable.
7. **Notes** - verified caveats, invariants, concurrency, or safety details.

Stale documentation is a review blocker. Omit an empty section; never fabricate
text merely to satisfy a template.

## Layout and readability

Documentation is prose for people first.

- Use native **multiline** documentation syntax, even for a short summary.
- Put the Summary first. Leave exactly one blank documentation line before
  Usage, Behavior, or the first populated tag or heading group.
- Leave exactly one blank documentation line between logical sections. Keep
  entries in one tag group adjacent.
- Keep tags and headings on their own lines. Do not place `@brief`, `@param`,
  `@return`, `@throws`, `@example`, `@note`, or a rustdoc `#` heading on the
  Summary line or beside an unrelated section.
- Wrap at natural phrase boundaries. Indent continuation lines farther than the
  tag, label, bullet, or list marker they continue.
- Avoid decorative blank-line runs and trailing whitespace.

## Enforcement and verification

The write guard mechanically blocks missing leading documentation headers for
all supported source families, missing Python public-unit docstrings, and
incomplete Compose root or service comments. When the TypeScript / JavaScript
exported-units setting is enabled, it also blocks direct top-level exports
without an attached expanded JSDoc block. Compiler-dependent profiles
can use an explicitly configured project adapter that receives the pending
candidate without writing it to disk; an enabled adapter mode fails closed when
its adapter cannot provide structured results. No guard can determine whether a
semantic claim is true; review code and tests for that.

Formatter policy is intentionally split by tool capability:

- Python, TypeScript/JavaScript, and Docker Compose have pinned pre-write
  formatters enabled by default and fail closed when their pinned tool is absent.
- Rust formatting is opt-in because it uses the project-selected `rustfmt`.
- C/C++ formatting and analysis are project-aware detailed verification, using
  project-provided `clang-format` and `clang-tidy`; Doxygen is pinned separately
  for project-level documentation checks.

Write source through the DSH-managed `write_formatted` tool instead of
formatting and then calling `write` or `edit`. It formats the candidate, checks
the formatted text, and writes it when clean; a call that was refused wrote
nothing, and its message lists every finding at once. Do not search `PATH`,
package directories, or global installations:

```json
{
  "file_path": "src/module.ts",
  "language": "typescript",
  "content": "export const value=1\n"
}
```

`file_path` is load-bearing: it selects the formatter parser, the language
profile, and the project configuration, and the destination does not need to
exist. `language` is required and must agree with `file_path`: `python` for
`.py`, `typescript` for `.ts`/`.tsx`/`.mts`/`.cts`, `javascript` for
`.js`/`.jsx`/`.mjs`/`.cjs`, `docker-compose` for a Compose file. A
contradiction is refused rather than formatted with the wrong parser, so state
what the file actually is. Use `format_code` when you want the formatted text
without writing anything: it runs the same check and never writes. Paths with
no managed formatter, such as `.md` or `.rs`, belong on `write`. Optional
`formatter_args` is a string array of native formatter flags. For edits, pass
the complete post-edit file rather than formatting only `new_string`. A
formatter that fails still reports the documentation check against the raw
candidate, so one response carries both problems.

Humans can use `/code-formatter` for existing files or pending content. Pending
slash-command content accepts simple quoted `--content-utf8` text or robust
`--content-base64 <base64>` data. The aliases `--ruff`, `--biome`, and
`--prettier` are accepted. If a managed formatter is unavailable, follow the
reported expected path and run `npm run provision-tools` in the
coding-doc-standard package.

Use the applicable reference for exact tools, commands, and document syntax.

## Review checklist

Treat a missing required header, public-unit document, known contract section,
or unsupported factual claim as a **blocker**. Treat a missing useful but
non-required detail as **major** and layout-only deviations as **minor**.

1. Does the file begin with Author, Summary, and complete applicable Usage?
2. Is every factual statement established by code, configuration, tests, or the
   user - including author and examples?
3. Does Usage explain the real setup, workflow, lifecycle, task-oriented APIs,
   limitations, and an end-to-end usage when they apply?
4. Is the Worked example a complete workflow rather than a trivial isolated
   expression, and does it show result or known-failure handling when applicable?
5. Does each public unit have an accurate summary and all known contract detail?
5. Are empty sections omitted and `Includes` inventories absent?
6. Is the language-native layout readable and consistently spaced?
7. Did the matching formatter and detailed verification run where available?
