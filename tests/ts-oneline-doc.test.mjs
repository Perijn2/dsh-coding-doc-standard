/**
 * @module ts-oneline-doc-tests
 * @author Perijn Huijser
 * Verifies that one-line JSDoc satisfies exported variables but not functions.
 *
 * @remarks
 * Usage:
 *   Core principle: The layout rule allows one-line blocks exactly where one
 *   line carries the whole contract (variables, variants, fields).
 *   Setup: Run with Node's built-in test runner.
 *   Workflow: Feed candidates to checkSourcePublicUnits and assert the verdicts.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import test from "node:test";
import { checkSourcePublicUnits, loadPolicy } from "../src/hook/run.mjs";

test("one-line JSDoc satisfies exported variables, not functions", () => {
	const policy = {
		...loadPolicy(),
		publicUnitDocs: { typescriptJavascript: true },
	};
	const oneLiner = checkSourcePublicUnits(
		{
			path: "example.ts",
			content: '/** Fallback. */\nexport const STAGE = "x";\n',
		},
		policy,
	);
	assert.deepEqual(oneLiner, []);
	const bareFunction = checkSourcePublicUnits(
		{
			path: "example.ts",
			content: "/** F. */\nexport function f(s: string) { return s; }\n",
		},
		policy,
	);
	assert.equal(bareFunction.length, 1);
	assert.match(bareFunction[0], /Missing JSDoc for exported function 'f'/);
});
