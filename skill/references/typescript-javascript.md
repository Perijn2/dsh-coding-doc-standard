# TypeScript and JavaScript Documentation Rules

Author: Perijn Huijser

Load this reference only for TypeScript or JavaScript after applying `SKILL.md`.

## Header and exported-API rules

Use an expanded leading `/** ... */` module block above the first export. Include
`@module <name>` on its own line, `@author` with a real author, a one-sentence
prose summary, and a `Usage:` guide. Put Usage in readable prose or an
`@remarks` block tailored to this module; there is no mandatory subsection
label set. Explain the useful setup, workflow, capabilities, limitations,
result/error handling, and complete examples established by the implementation.
Do not add an `Includes` inventory.

Use expanded `/** ... */` blocks directly above exported declarations. Document
every externally meaningful parameter with `@param`. Exported non-`void`
functions need `@returns`; exported generators need `@yields`. Add `@throws`
only for known thrown errors. Use TSDoc's `@param name - description` form for
TypeScript; JavaScript may use JSDoc's optional `{type}` notation when the type
is not otherwise evident.

The write guard mechanically requires a leading TSDoc/JSDoc header containing
`@author` and `Usage:`. When the **TypeScript / JavaScript exported
units** setting is enabled, it also requires an attached `/** ... */` JSDoc block
for direct top-level exported functions, classes, interfaces, type aliases,
enums, and variables. Exported function parameters require `@param`; non-void
functions require `@returns`; generators require `@yields`. It intentionally
does not resolve `export *`, named re-exports, or type-derived API surfaces;
those remain project-adapter and review requirements.

## Documentation-shape example

This is a syntax illustration. Its claims describe only the sample function;
derive the wording, error behavior, and examples for real code from the target
implementation and tests.

```ts
/**
 * @module label-normalizer
 * @author Perijn Huijser
 * Normalizes labels for case-insensitive comparison.
 *
 * @remarks
 * Usage:
 *   Getting started: Import normalizeLabel in the request or parsing layer. The
 *   function has no configuration, mutable state, or cleanup step.
 *
 *   Using the result: Pass raw text, retain the returned string for comparison,
 *   and keep the original value for diagnostics. Use the result for canonical
 *   lookup keys, not for user-facing text that must preserve original formatting.
 *
 *   Boundaries and failures: The function has no error channel, so callers must
 *   decide whether an empty result or unknown key is acceptable.
 *
 *   Complete workflow: Normalize a request label, check a map, and handle an
 *   unknown key without losing the original request value.
 */

/**
 * Normalizes leading, trailing, and case differences in a label.
 *
 * @param label - Text supplied by the caller.
 *
 * @returns The stripped, lowercase form of label.
 *
 * @example
 * ```ts
 * const rawLabel = "  Ready ";
 * const states = new Map([["ready", "enabled"]]);
 * const state = states.get(normalizeLabel(rawLabel));
 * if (state === undefined) {
 * 	throw new Error(`Unknown label: ${rawLabel}`);
 * }
 * console.log(state);
 * ```
 */
export function normalizeLabel(label: string): string {
	return label.trim().toLowerCase();
}
```

## Layout and review

Never use a one-line required JSDoc or TSDoc block. Put the summary on its own
line, then leave one blank `*` line before each `@param`, `@returns`, `@yields`,
`@throws`, `@example`, or `@remarks` group. Keep entries in a group adjacent and
indent wrapped tag text. Missing known parameter, return, yield, or error docs
is a blocker; one-line blocks or missing group separation are minor layout
defects.

## Formatter and verifier

The pre-write guard uses the package-owned **@biomejs/biome 2.5.12** executable
for `.ts`, `.js`, `.mjs`, and `.cjs` candidates. It formats pending content with
`biome format --stdin-file-path` and fails closed when that pinned dependency is
absent. It does not switch to project ESLint or Prettier settings.

From this package checkout after `npm install`, use the same pinned package for
manual work:

```text
npx biome format --write path/to/module.ts
npx biome check path/to/module.ts
```

For detailed verification, run `node scripts/verify/verify.mjs path/to/module.ts` from
this package checkout when `biome` is available on the command path. Formatter
success checks syntax and layout only; it does not establish undocumented API
facts.
