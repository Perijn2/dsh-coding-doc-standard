/**
 * @module naming-tests
 * Check syntax-driven naming rules and their failure channel.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { checkNaming } from "../src/engine/naming.mjs";
import { ProviderUnavailableError } from "../src/engine/providers.mjs";

const profile = (style, extra = {}) => ({
	naming: {
		source: "test conventions",
		grammar: "javascript",
		rules: [
			{
				query: "(function_declaration name: (identifier) @name)",
				style,
				...extra,
			},
		],
	},
});

test("absent naming has no dependency requirement", async () => {
	assert.deepEqual(await checkNaming("not source", {}), []);
});

test("checks only queried declarations and reports one-based lines", async () => {
	assert.deepEqual(
		await checkNaming(
			'// function BadName() {}\nconst s = "BadName";\nfunction BadName() {}\nfunction good_name() {}',
			profile("snake_case"),
		),
		[
			{
				line: 3,
				message:
					"Identifier 'BadName' must use snake_case. See test conventions.",
			},
		],
	);
});

test("supports all styles, Unicode and conservative underscore escapes", async () => {
	const cases = [
		[
			"snake_case",
			["good_name", "école_名", "__good_name__", "école"],
			["BadName", "bad__name"],
		],
		["UpperCamelCase", ["GoodName", "École", "名称"], ["badName", "Bad_name"]],
		[
			"lowerCamelCase",
			["goodName", "écoleNom", "名称"],
			["BadName", "bad_name"],
		],
		["SCREAMING_SNAKE_CASE", ["GOOD_NAME", "ÉCOLE_名"], ["bad_name", "Good"]],
		["MixedCaps", ["goodName", "GoodName", "名称"], ["bad_name"]],
		["lowercase", ["good", "école", "名称"], ["Good", "bad_name"]],
	];
	for (const [style, good, bad] of cases) {
		for (const name of good)
			assert.deepEqual(
				await checkNaming(`function ${name}() {}`, profile(style)),
				[],
				`${style}: ${name}`,
			);
		for (const name of bad)
			assert.equal(
				(await checkNaming(`function ${name}() {}`, profile(style))).length,
				1,
				`${style}: ${name}`,
			);
	}
});

test("supports raw-name exclusions, ancestor exemptions and @exclude", async () => {
	assert.deepEqual(
		await checkNaming(
			"function ExternalName() {}",
			profile("snake_case", { excludeNamePattern: "^External" }),
		),
		[],
	);
	assert.deepEqual(
		await checkNaming(
			"function BadName() {}",
			profile("snake_case", { skipAncestors: ["function_declaration"] }),
		),
		[],
	);
	assert.deepEqual(
		await checkNaming(
			"function BadName() {}",
			profile("snake_case", {
				query: "(function_declaration name: (identifier) @name) @exclude",
			}),
		),
		[],
	);
});

test("ignores string captures", async () => {
	assert.deepEqual(
		await checkNaming(
			'const key = "BadName";',
			profile("snake_case", { query: "(string) @name" }),
		),
		[],
	);
});

test("allows Rust raw identifiers and Ruby method punctuation", async () => {
	const rust = {
		naming: {
			source: "Rust",
			grammar: "rust",
			rules: [
				{
					query: "(function_item name: (identifier) @name)",
					style: "snake_case",
				},
			],
		},
	};
	assert.deepEqual(
		await checkNaming("fn r#type() {}\nfn __good_name__() {}", rust),
		[],
	);
	const ruby = {
		naming: {
			source: "Ruby",
			grammar: "ruby",
			rules: [
				{ query: "(method name: (identifier) @name)", style: "snake_case" },
			],
		},
	};
	assert.deepEqual(
		await checkNaming("def ready?\nend\ndef save!\nend", ruby),
		[],
	);
});

test("exempts Rust trait methods without exempting inherent methods", async () => {
	const candidate = {
		naming: {
			source: "Rust",
			grammar: "rust",
			rules: [
				{
					query:
						"(impl_item trait: (_)? @exclude body: (declaration_list (function_item name: (identifier) @name)))",
					style: "snake_case",
				},
			],
		},
	};
	const findings = await checkNaming(
		"impl Foreign for Thing { fn ForeignName() {} }\nimpl Thing { fn BadName() {} }",
		candidate,
	);
	assert.equal(findings.length, 1);
	assert.equal(findings[0].line, 2);
	assert.match(findings[0].message, /BadName/);
});

test("fails closed on bad grammar, rule, regexp or query and recovers", async () => {
	const invalid = [
		{ naming: { source: "test", grammar: "missing-language", rules: [] } },
		profile("unknown"),
		profile("snake_case", { excludeNamePattern: "[" }),
		profile("snake_case", { query: "(missing_node) @name" }),
		profile("snake_case", { query: "(identifier) @other" }),
	];
	for (const candidate of invalid)
		await assert.rejects(
			checkNaming("function Good() {}", candidate),
			ProviderUnavailableError,
		);
	assert.deepEqual(
		await checkNaming("function good() {}", profile("snake_case")),
		[],
	);
});

test("excludes only names captured by an exclusion query and validates it", async () => {
	const candidate = profile("snake_case", {
		excludeQuery:
			'((function_declaration name: (identifier) @name) (#eq? @name "ForeignName"))',
	});
	const findings = await checkNaming(
		"function ForeignName() {}\nfunction BadName() {}",
		candidate,
	);
	assert.equal(findings.length, 1);
	assert.equal(findings[0].line, 2);
	for (const excludeQuery of [
		"(missing_node) @name",
		"(identifier) @other",
		42,
	]) {
		await assert.rejects(
			checkNaming(
				"function BadName() {}",
				profile("snake_case", { excludeQuery }),
			),
			ProviderUnavailableError,
		);
	}
});

test("normalizes C# verbatim identifiers", async () => {
	const candidate = {
		naming: {
			source: "C#",
			grammar: "c_sharp",
			rules: [
				{
					query: "(method_declaration name: (identifier) @name)",
					style: "UpperCamelCase",
				},
			],
		},
	};
	assert.deepEqual(
		await checkNaming("class C { void @GoodFunction() {} }", candidate),
		[],
	);
	const findings = await checkNaming(
		"class C { void @badFunction() {} }",
		candidate,
	);
	assert.equal(findings.length, 1);
});

test("leaves backtick-escaped names exempt in Swift, Kotlin and Scala", async () => {
	for (const [grammar, query, content] of [
		["swift", "(simple_identifier) @name", "func `BadName`() {}"],
		["kotlin", "(simple_identifier) @name", "fun `Bad Name`() {}"],
		["scala", "(identifier) @name", "def `BadName`() = 1"],
	]) {
		assert.deepEqual(
			await checkNaming(content, {
				naming: {
					source: "test",
					grammar,
					rules: [{ query, style: "snake_case" }],
				},
			}),
			[],
			grammar,
		);
	}
});

test("deduplicates findings across repeated rules", async () => {
	const candidate = profile("snake_case", { label: "Function" });
	candidate.naming.rules.push({ ...candidate.naming.rules[0] });
	assert.deepEqual(await checkNaming("function BadName() {}", candidate), [
		{
			line: 1,
			message: "Function 'BadName' must use snake_case. See test conventions.",
		},
	]);
});
