# C and C++ Documentation Rules

Author: Perijn Huijser

Load this reference only for C or C++ after applying `SKILL.md`.

## File and public-API rules

Use expanded `/** ... */` Doxygen blocks. At the top of each file, place
`@file <name>` on its own line, then the shared author, summary, and Usage
content. Use `@author` for the verified author and `@brief` for a concise
summary. Under Usage, keep the shared **Core principle**, **Setup**,
**Workflow**, **API guide**, and **Worked example** labels wherever they apply;
use `@code` / `@endcode` for a runnable example only when the project API
establishes it. Do not add an Includes list or an API inventory disguised as
`@details`.

Public declarations need a non-empty `@brief`. Document every named parameter
exactly once with `@param[in]`, `@param[out]`, or `@param[in,out]`. Non-`void`
APIs need an accurate `@return` or `@retval`. Use `@throw`, `@code` /
`@endcode`, and `@note` only for known errors, examples, and caveats.

The write guard mechanically requires a leading Doxygen header with `@author`
and `Usage:`. Parameter directions, return contracts, tag layout, and semantic
truth need review because the guard does not parse C or C++ declarations.

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
 *   Core principle: Keep normalization behind one documented API.
 *   Setup: Include "label_normalizer.hpp" in callers that compare labels.
 *   Workflow: Pass source text and use the returned normalized label.
 *   API guide: normalize_label returns one normalized string for each input.
 *   Worked example:
 *   @code{.cpp}
 *   const auto label = normalize_label("  Ready ");
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
node scripts/verify.mjs --doxygen path/to/Doxyfile
```

The Doxyfile must explicitly set `WARN_IF_UNDOCUMENTED`, `WARN_IF_DOC_ERROR`,
`WARN_AS_ERROR`, and `EXTRACT_ALL` to `YES`. The verifier rejects a configuration
that omits any of those values. Do not generate a Doxyfile from this skill: its
inputs, excludes, and output locations are project-specific.
