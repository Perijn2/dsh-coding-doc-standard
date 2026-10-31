# C and C++ Documentation Rules

Author: Perijn Huijser

Load this reference only for C or C++ after applying `SKILL.md`.

## File and public-API rules

Use expanded `/** ... */` Doxygen blocks. At the top of each file, place
`@file <name>` on its own line, then the verified author, concise `@brief`, and a
file-specific Usage guide. Usage has no mandatory subsection labels: choose
readable prose, headings, and code examples that explain what this file really
provides, how callers configure and use it, what it cannot do, and how callers
handle results or known failures. Use `@code` / `@endcode` only when the project
API establishes a complete useful workflow. Do not add an Includes list or an
API inventory disguised as `@details`.

Public declarations need a non-empty `@brief`. Document every named parameter
exactly once with `@param[in]`, `@param[out]`, or `@param[in,out]`. Non-`void`
APIs need an accurate `@return` or `@retval`. Use `@throw`, `@code` /
`@endcode`, and `@note` only for known errors, examples, and caveats.

The write guard mechanically requires the leading Doxygen header, including
`@file`, `@author`, non-empty `@brief`, and the shared Usage labels. It also
checks recognized externally visible function declarations for attached
non-empty `@brief` text, exactly-once directed parameters, and known non-void
returns. Complex project-specific API surfaces remain adapter responsibilities.

## Documentation-shape example

This is a syntax illustration. Its text describes only the sample declaration;
replace every name, direction, return description, and error claim with facts
from the target header and implementation.

```cpp
/**
 * @file label_normalizer.hpp
 * @author Perijn Huijser
 * @brief Declares label normalization for case-insensitive comparison.
 *
 * Usage:
 *   Getting started: Include "label_normalizer.hpp" and link the implementation
 *   that defines normalize_label. The declaration accepts a string view, so
 *   callers may pass a string literal or an existing string without transferring
 *   it.
 *
 *   Calling the API: Pass the candidate label, retain the returned string for
 *   lookup or comparison, and preserve the original input when it is needed for
 *   logging. The returned value owns normalized text; the input view is not
 *   modified.
 *
 *   Boundaries and failures: This function has no error channel. Whitespace-only
 *   or otherwise unexpected input remains a normal value and must be handled by
 *   the caller's validation policy.
 *
 *   Complete workflow: Normalize a user-provided label before looking it up,
 *   then distinguish a missing lookup result from a successful match.
 *   @code{.cpp}
 *   #include "label_normalizer.hpp"
 *   #include <string>
 *   #include <unordered_map>
 *
 *   const std::unordered_map<std::string, int> states{{"ready", 1}};
 *   const auto key = normalize_label("  Ready ");
 *   const auto found = states.find(key);
 *   const bool recognized = found != states.end();
 *   // Handle `recognized` and `found->second` according to the caller's policy.
 *   @endcode
 */

/**
 * @brief Normalizes leading, trailing, and case differences in a label.
 *
 * @param[in] label Source text to normalize.
 *
 * @return A normalized copy of label.
 *
 * @note The input object is not modified.
 */
std::string normalize_label(std::string_view label);
```

## Layout and review

Never use a one-line Doxygen block. Put `@brief` on its own line and insert one
blank `*` line before each `@param`, `@return` / `@retval`, `@throw`, `@code`,
and `@note` group. Keep entries in one group adjacent and indent wrapped tag
text. Missing `@brief`, parameter direction, or known return documentation is a
blocker; one-line blocks and missing group separation are minor layout defects.

## Formatter, analysis, and Doxygen verification

C/C++ formatting and analysis use the **project-provided** LLVM toolchain. They
are detailed verification rather than a pre-write formatter because this package
does not provision a portable pinned clang toolchain. Run from the project root:

```text
clang-format --dry-run --Werror path/to/file.cpp
clang-tidy path/to/file.cpp
```

The package does provision **Doxygen 1.18.0** for supported host assets. Use it
for project-level documentation verification after provisioning tools:

```text
npm run provision-tools
node scripts/verify/verify.mjs --doxygen path/to/Doxyfile
```

The Doxyfile must explicitly set `WARN_IF_UNDOCUMENTED`, `WARN_IF_DOC_ERROR`,
`WARN_AS_ERROR`, and `EXTRACT_ALL` to `YES`. The verifier rejects a configuration
that omits any of those values. Do not generate a Doxyfile from this skill: its
inputs, excludes, and output locations are project-specific.
