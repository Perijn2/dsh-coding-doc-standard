# TypeScript and JavaScript Documentation Rules

Author: Perijn Huijser

Load this reference only for TypeScript or JavaScript after applying `SKILL.md`.

## Header and exported-API rules

Use an expanded leading `/** ... */` module block above the first export. Include
`@module <name>` on its own line, `@author` with a real author, a one-sentence
prose summary, and a `Usage:` guide. Put the Usage guide in prose or an
`@remarks` block and keep the shared **Core principle**, **Setup**, **Workflow**,
**API guide**, and **Worked example** labels wherever they apply. Do not add an
`Includes` inventory.

Use expanded `/** ... */` blocks directly above exported declarations. Document
every externally meaningful parameter with `@param`. Exported non-`void`
functions need `@returns`; exported generators need `@yields`. Add `@throws`
only for known thrown errors. Use TSDoc's `@param name - description` form for
TypeScript; JavaScript may use JSDoc's optional `{type}` notation when the type
is not otherwise evident.

The write guard mechanically requires a leading TSDoc/JSDoc header containing
`@author` and `Usage:`. Tag completeness, layout, and semantic accuracy remain
review requirements because the guard cannot reliably infer every exported API
contract.

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
 *   Core principle: Keep normalization in one pure exported function.
 *   Setup: Import normalizeLabel from this module.
 *   Workflow: Pass raw text and compare the returned normalized label.
 *   API guide: normalizeLabel converts one label without changing the input.
 *   Worked example: normalizeLabel("  Ready ") === "ready".
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
 * normalizeLabel("  Ready "); // "ready"
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

For detailed verification, run `node scripts/verify.mjs path/to/module.ts` from
this package checkout when `biome` is available on the command path. Formatter
success checks syntax and layout only; it does not establish undocumented API
facts.
