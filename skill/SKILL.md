---
name: coding-doc-standard
description: >-
  Enforces evidence-based documentation and formatter requirements for Python,
  TypeScript, JavaScript, Rust, C/C++, and Docker Compose. Load only the
  language references relevant to the task.
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

Every supported source file begins with one native multiline documentation
header. Docker Compose uses a leading YAML-comment header instead. Keep these
fields in order:

1. **Author** — a real, established author; never guessed.
2. **Summary** — one sentence describing the file or module responsibility.
3. **Usage** — an evidence-based guide for a new caller or operator. Cover each
   applicable part in this order:
   - **Core principle** — the design model and responsibility the file owns.
   - **Setup** — the real import, include, configuration, or initialization.
   - **Workflow** — normal ordering, state changes, side effects, and cleanup.
   - **API guide** — public entry points grouped by task and how their results
     are used; do not duplicate declaration-level contracts.
   - **Worked example** — an end-to-end primary workflow that handles a real
     result or a known failure when the implementation defines one.
4. **Notes** — optional; omit it when there is no verified operational caveat.

Do not add an `Includes` inventory. It duplicates declarations and becomes
stale; the task-oriented API guide is the durable replacement.

### Public-unit documentation

Document every public function, method, class, struct, trait, enum, exported
constant, or externally linked API in its language-native form. Keep only
sections whose content is known:

1. **Summary** — first content line; one sentence ending in a period.
2. **Behavior** — when the name and signature do not already make it clear.
3. **Parameters** — each externally meaningful input.
4. **Returns** — meaningful result, ownership, or state effect.
5. **Errors** — only known thrown, returned, or reported failures.
6. **Example** — only when a small correct usage is derivable.
7. **Notes** — verified caveats, invariants, concurrency, or safety details.

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
incomplete Compose root or service comments. It cannot determine whether a
semantic claim is true; review code and tests for that.

Formatter policy is intentionally split by tool capability:

- Python, TypeScript/JavaScript, and Docker Compose have pinned pre-write
  formatters enabled by default and fail closed when their pinned tool is absent.
- Rust formatting is opt-in because it uses the project-selected `rustfmt`.
- C/C++ formatting and analysis are project-aware detailed verification, using
  project-provided `clang-format` and `clang-tidy`; Doxygen is pinned separately
  for project-level documentation checks.

Use the applicable reference for exact tools, commands, and document syntax.

## Review checklist

Treat a missing required header, public-unit document, known contract section,
or unsupported factual claim as a **blocker**. Treat a missing useful but
non-required detail as **major** and layout-only deviations as **minor**.

1. Does the file begin with Author, Summary, and complete applicable Usage?
2. Is every factual statement established by code, configuration, tests, or the
   user — including author and examples?
3. Does Usage explain setup, workflow, task-oriented APIs, and an end-to-end
   usage when they apply?
4. Does each public unit have an accurate summary and all known contract detail?
5. Are empty sections omitted and `Includes` inventories absent?
6. Is the language-native layout readable and consistently spaced?
7. Did the matching formatter and detailed verification run where available?
