---
name: coding-doc-standard-cpp
description: >-
  Native Doxygen syntax for the coding documentation standard: leading
  /** blocks with @author/@brief tags for file headers, classes, and
  functions. Load together with coding-doc-standard for any task touching
  .cpp, .cc, .cxx, .hpp, or .hh files.
---

# C++ Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in C++. C and C++ share one toggle and one syntax; the file
`example.cpp` next to this skill is the golden reference — a complete,
working file documented to the standard; copy its shape when unsure.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Preserve existing project conventions; the formatter never renames declarations.
C++ has no universal official casing policy: casing is a project-specific
choice. For example, [Google's C++ naming guide](https://google.github.io/styleguide/cppguide.html#Naming)
uses `StatusBuffer` types, `ReadStatus` functions, `status_code` variables,
`kReady` constants/enum members, and uppercase macros, with exceptions for
accessors and STL-like entities. These are Google conventions, not C++ syntax
requirements or universal rules. Do not rename overrides or external API names
to match those examples. See the source survey in
[Declaration naming](../../../docs/naming.md).

## File header — leading `/**` block

The header must be the first content in the file; document it with tags.

```cpp
/**
 * @author Perijn Huijser
 * @brief Buffer incoming status lines for one batched write.
 *
 * @details
 *     Expand the summary briefly, then work an example through the
 *     file: how a caller feeds lines in, what comes back on flush,
 *     what to do when the writer lags.
 *
 * @changelog
 *     2026-08: Added pending() for drain checks.
 */
```

## Class and function documents

Attach a `/** @brief ... */` block directly above every class and every
function definition — a forward declaration or in-class prototype needs
none. The text after `@brief` is the imperative summary.

```cpp
/**
 * @brief Buffer status lines until a caller flushes them in one batch.
 */
class StatusBuffer {
public:
	/**
	 * @brief Append one status line to the buffer.
	 */
	void push(const std::string& line);

	/**
	 * @brief Return how many lines are waiting to be flushed.
	 */
	int pending() const;
};
```

- The `@brief` prefix is stripped; the remainder seeds the summary.
- A blank line must not sit between the closing `*/` and the declaration,
  or the block no longer belongs to it.
- `detail` and `static`-only helpers need no document; anything callers
  reach for carries one.

## Other public kinds

`struct`, `enum`, and free constants are not units here — function
definitions and `class` definitions are. Document a public `struct` or
enum with the same `/** @brief ... */` block anyway; readers expect it.
