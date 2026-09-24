/**
 * @module tree-sitter-public-docs-tests
 * @author Perijn Huijser
 * Verifies parser-backed documentation coverage across baseline languages.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise every pinned grammar with in-memory candidate text.
 *   Setup: Run through Node's built-in test runner after installing dependencies.
 *   Workflow: Check undocumented and documented declarations for each profile.
 *   API guide: Each table row defines one language's native comment syntax.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkTreeSitterPublicUnits } from "../src/hook/tree-sitter-public-docs.mjs";

const policy = JSON.parse(readFileSync("src/policy/defaults.json", "utf8"));
const cases = [
	[
		"example.go",
		"package example\nfunc Run() {}",
		"// Run executes the operation.\n",
	],
	["Example.cs", "class Example {}", "/// Documents Example.\n"],
	["Example.java", "class Example {}", "/** Documents Example. */\n"],
	["Example.kt", "class Example", "/** Documents Example. */\n"],
	["example.sh", "run() { echo ok; }", "# Documents run.\n"],
	["Example.php", "<?php\nclass Example {}", "/** Documents Example. */\n"],
	["example.rb", "class Example\nend", "# Documents Example.\n"],
	["Example.swift", "class Example {}", "/// Documents Example.\n"],
	["example.dart", "class Example {}", "/// Documents Example.\n"],
	["Example.hs", "module Example where\nrun x = x", "-- | Documents run.\n"],
	["example.lua", "function run() end", "--- Documents run.\n"],
	["Example.scala", "class Example", "/** Documents Example. */\n"],
];

function documentedSource(path, source, documentation) {
	const header = `${documentation}\n`;
	if (path.endsWith(".go") || path.endsWith(".php") || path.endsWith(".hs")) {
		const split = source.indexOf("\n") + 1;
		return `${header}${source.slice(0, split)}${documentation}${source.slice(split)}`;
	}
	return `${header}${documentation}${source}`;
}

for (const [path, source, documentation] of cases) {
	test(`enforces Tree-sitter documentation for ${path}`, async () => {
		const missing = await checkTreeSitterPublicUnits(
			{ path, content: source },
			policy,
		);
		assert.ok(missing.length > 0, path);
		assert.match(missing[0], /Missing native documentation/u);
		assert.deepEqual(
			await checkTreeSitterPublicUnits(
				{
					path,
					content: documentedSource(path, source, documentation),
				},
				policy,
			),
			[],
		);
	});
}

test("ignores generated Dart candidates", async () => {
	assert.deepEqual(
		await checkTreeSitterPublicUnits(
			{ path: "example.g.dart", content: "class Generated {}" },
			policy,
		),
		[],
	);
});
