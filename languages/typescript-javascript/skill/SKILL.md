---
name: coding-doc-standard-typescript-javascript
description: >-
  Native TSDoc/JSDoc syntax for the coding documentation standard: the header
  block and attached export documents. Load together with
  coding-doc-standard for any task touching .ts, .tsx, .mts, .cts, .js, .jsx,
  .mjs, or .cjs files.
---

# TypeScript / JavaScript Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in TypeScript and JavaScript. The file `example.ts` next to
this skill is the golden reference — a complete, working module documented
to the standard; copy its shape when unsure.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Preserve existing project conventions; the formatter never renames declarations.
Neither language has a universal official casing policy; choose casing with the
project. [ECMAScript's identifier rules](https://tc39.es/ecma262/#sec-names-and-keywords)
define syntax, including Unicode identifier characters and `$`/`_`, not a
class/function casing scheme. Reserved words are restricted in binding names,
even though property names can use them.

[MDN's example-code style guide](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/JavaScript)
recommends PascalCase classes and camelCase functions/methods; it is not a
language requirement. `const status = readStatus()` need not become `STATUS`
merely because it uses `const`. JavaScript has no native enum declaration.
The [TypeScript enum handbook](https://www.typescriptlang.org/docs/handbook/enums.html)
documents enums, while the [compiler contributor guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines)
recommend PascalCase types/enum values and camelCase functions only for that
repository. Thus `enum Status { Ready, Busy }` is an illustrative convention,
not an enforced language-wide rule. See the source survey in
[Declaration naming](../../../docs/naming.md).

## File header — leading block above the first declaration

```ts
/**
 * @module label-normalizer
 * @author Perijn Huijser
 * Normalize request labels for case-insensitive lookup.
 *
 * @remarks
 * Description:
 *   Expand the summary briefly, then work a real call through the module:
 *   what the caller passes, what comes back under each condition, what to
 *   do when the lookup misses.
 *
 * Changelog:
 *   2026-08: Added strict mode for unknown labels.
 */
```

## Export documents

Attach an expanded block to every exported function, class, interface, type
alias, enum, and variable; the first line is the imperative summary.

```ts
/**
 * Normalize leading, trailing, and case differences in a label.
 *
 * @param label (in) - Text supplied by the caller.
 *
 * @returns Always the stripped, lowercase form of label; empty input
 * comes back empty. This function never throws.
 *
 * @deprecated Use normalizeText instead.
 */
export function normalizeLabel(label: string): string {
	return label.trim().toLowerCase();
}
```

- The `(in)` / `(out)` / `(in-out)` marker follows the `@param` name.
- `@returns` prose must cover every distinct case, including the
  never-throws claim when the function cannot fail; `@throws` only for known
  thrown errors, `@yields` on generators.
- JavaScript may add `{type}` to `@param` when the type is not otherwise
  evident.
- One blank `*` line between sections; never a one-line block.

## Examples

Use `@example` with a fenced code block; show the result in a trailing
comment when the value is the point:

```ts
/**
 * Turn a human title into a URL slug.
 *
 * @param title (in) - Title in any case and spacing.
 *
 * @returns Lowercase, hyphen-separated text; a title with no usable
 * letters comes back as `"untitled"`. Never throws.
 *
 * @example
 * ```ts
 * slugify("Hello, World!"); // "hello-world"
 * ```
 */
```

## Other public kinds

Every exported thing carries an attached block the same way: enums and their
members, interfaces and object types, type aliases, and exported constants.

```ts
/**
 * Pick how many attempts one call may spend. Chosen by caller patience.
 */
export enum Budget {
	/** No retries: callers that only log the outcome. */
	Once = 1,
	/** Two retries: interactive callers waiting on the result. */
	Fast = 3,
}

/**
 * Shape a status response must match for the retry layer to parse it.
 */
export interface StatusResponse {
	/** True when the service answered within its own timeout. */
	ok: boolean;
}

/** Seconds to wait between attempts; range 1..10. Change only with the network team. */
export const ATTEMPT_INTERVAL_SECONDS = 5;
```

- Every enum member and interface field gets its own one-fact block stating
  what the caller does on it.
- A constant's block states meaning, unit, range, and who may change it.
