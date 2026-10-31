/**
 * @module validator-core-tests
 * @author Perijn Huijser
 * Unit-tests the reusable validation core behind the pending-write gate.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise the pure validator core directly, with no Cordis host.
 *   Setup: Run npm test from the package root.
 *   Workflow: Each test drives one exported core function against a fixture policy.
 *   API guide: globToRegExp, isIgnoredPath, referenceForPath, buildCandidate,
 *     documentedParameterNames, validateCandidate, and renderFindings.
 *   Worked example: node --test tests/validator-core.test.mjs
 */

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	buildCandidate,
	globToRegExp,
	ignoredPathDefaults,
	isIgnoredPath,
	normalizePath,
	referenceForPath,
	renderFindings,
	validateCandidate,
} from "../src/hook/run.mjs";
import { documentedParameterNames } from "../src/hook/typescript-public-docs.mjs";

const workspace = await mkdtemp(join(tmpdir(), "doc-standard-core-"));

test.after(async () => {
	await rm(workspace, { recursive: true, force: true });
});

/**
 * Builds a policy fixture with only the named passes switched on.
 *
 * @param {Record<string, unknown>} [overrides] - Fields that override the baseline.
 * @returns {Record<string, unknown>} A policy with every checker off by default.
 */
function fixture(overrides = {}) {
	return {
		enabled: true,
		languages: {},
		publicUnitDocs: {},
		publicUnitAdapters: {},
		formatOnWrite: false,
		ignoredPaths: [],
		...overrides,
	};
}

test("normalizes native separators", () => {
	assert.equal(normalizePath("src\\hook\\run.mjs"), "src/hook/run.mjs");
	assert.equal(normalizePath("./src/a.ts"), "src/a.ts");
	assert.equal(normalizePath("src//a.ts"), "src//a.ts");
});

test("compiles globs over segments, one segment, and one character", () => {
	assert.ok(globToRegExp("**/node_modules/**").test("a/b/node_modules/c/d.ts"));
	assert.ok(globToRegExp("**/node_modules/**").test("node_modules/c/d.ts"));
	assert.ok(!globToRegExp("**/node_modules/**").test("a/node_modulesx/d.ts"));
	assert.ok(globToRegExp("src/*.ts").test("src/a.ts"));
	assert.ok(!globToRegExp("src/*.ts").test("src/nested/a.ts"));
	assert.ok(globToRegExp("src/?.ts").test("src/a.ts"));
	assert.ok(!globToRegExp("src/?.ts").test("src/ab.ts"));
	assert.ok(globToRegExp("a.ts").test("a.ts"));
	assert.ok(!globToRegExp("a.ts").test("xts"));
	assert.ok(globToRegExp("**").test("any/deep/path.ts"));
});

test("keeps built-in exemptions when a custom ignore list is configured", () => {
	assert.ok(ignoredPathDefaults.length > 0);
	const custom = { ignoredPaths: ["src/app.ts"] };
	for (const path of [
		"node_modules/pkg/index.js",
		"vendor/lib/thing.ts",
		"dist/bundle.js",
		"build/out.js",
		"out/app.js",
		"coverage/lcov.info",
		".git/config",
		"src/__pycache__/mod.py",
		"src/generated/api.ts",
		"assets/app.min.js",
		"assets/app.min.css",
		"assets/app.js.map",
		"src/types/api.d.ts",
		"package-lock.json",
		"pnpm-lock.yaml",
		"Cargo.lock",
	]) {
		assert.ok(isIgnoredPath(path, custom), path);
	}
	assert.ok(isIgnoredPath("src\\app.ts", custom));
	assert.ok(isIgnoredPath("src/app.ts", custom));
	assert.ok(!isIgnoredPath("src/other.ts", custom));
});

test("maps a candidate onto its skill reference", () => {
	const compose = {
		composePatterns: [
			"compose.yaml",
			"compose.yml",
			"docker-compose.yaml",
			"docker-compose.yml",
		],
	};
	assert.equal(referenceForPath("src/a.ts"), "typescript-javascript.md");
	assert.equal(referenceForPath("src/a.py"), "python.md");
	assert.equal(referenceForPath("src/a.rs"), "rust.md");
	assert.equal(
		referenceForPath("deploy/docker-compose.yml", compose),
		"docker-compose.md",
	);
	assert.equal(
		referenceForPath("compose.override.yaml", {
			composePatterns: ["compose.*.yaml"],
		}),
		"docker-compose.md",
	);
	assert.equal(referenceForPath("notes/plain.txt"), null);
	assert.equal(referenceForPath("config.yaml"), null);
});

test("skips payloads it cannot build instead of blaming the standard", async () => {
	const notAnObject = await buildCandidate("nope", fixture());
	assert.equal(notAnObject.applicable, false);
	assert.match(notAnObject.reason, /no input object/u);

	const noPath = await buildCandidate(
		{ tool_input: { content: "x" } },
		fixture(),
	);
	assert.match(noPath.reason, /carries no file path/u);

	const noContent = await buildCandidate(
		{ tool_input: { file_path: "src/a.ts" } },
		fixture(),
	);
	assert.match(noContent.reason, /neither complete content nor/u);

	const ignored = await buildCandidate(
		{ tool_input: { file_path: "node_modules/pkg/a.ts", content: "x" } },
		fixture(),
	);
	assert.equal(ignored.applicable, false);
	assert.match(ignored.reason, /ignored-path list/u);
});

test("accepts every file path key and a complete content write", async () => {
	for (const key of ["file_path", "path", "file"]) {
		const built = await buildCandidate(
			{ tool_input: { [key]: "src/a.ts", content: "export const a = 1;\n" } },
			fixture(),
		);
		assert.equal(built.applicable, true, key);
		assert.equal(built.candidate.path, "src/a.ts", key);
		assert.equal(built.candidate.content, "export const a = 1;\n", key);
	}
});

test("materializes an edit that matches exactly once", async () => {
	const target = join(workspace, "editable.ts");
	await writeFile(target, "one\ntwo\nthree\n", "utf8");
	const built = await buildCandidate(
		{ tool_input: { file_path: target, old_string: "two", new_string: "2" } },
		fixture(),
	);
	assert.equal(built.applicable, true);
	assert.equal(built.candidate.content, "one\n2\nthree\n");
});

test("skips an edit that does not match exactly once", async () => {
	const target = join(workspace, "ambiguous.ts");
	await writeFile(target, "dup\ndup\n", "utf8");
	const twice = await buildCandidate(
		{ tool_input: { file_path: target, old_string: "dup", new_string: "x" } },
		fixture(),
	);
	assert.equal(twice.applicable, false);
	assert.match(twice.reason, /matched 2 copies/u);
	const never = await buildCandidate(
		{
			tool_input: { file_path: target, old_string: "absent", new_string: "x" },
		},
		fixture(),
	);
	assert.match(never.reason, /matched 0 copies/u);
});

test("skips an edit whose file cannot be read", async () => {
	const built = await buildCandidate(
		{
			tool_input: {
				file_path: join(workspace, "does-not-exist.ts"),
				old_string: "a",
				new_string: "b",
			},
		},
		fixture(),
	);
	assert.equal(built.applicable, false);
	assert.match(built.reason, /could not be read/u);
});

test("skips a candidate above the byte limit", async () => {
	const built = await buildCandidate(
		{ tool_input: { file_path: "src/big.ts", content: "x".repeat(40) } },
		fixture({ maxValidatedBytes: 16 }),
	);
	assert.equal(built.applicable, false);
	assert.match(built.reason, /40 bytes, above the 16-byte validation limit/u);
});

test("reads parameter names from every documented tag form", () => {
	const block = [
		"/**",
		" * Adds two numbers.",
		" * @param plain - A plain name.",
		" * @param {string} typed - Typed JSDoc.",
		" * @param {number} [count=3] - Optional with a default.",
		" * @param [optionalPlain] - Optional without a type.",
		" * @param {{ a: string }} record - A brace-bearing type.",
		" * @argument aliased - The argument alias.",
		" * @returns {number} The sum.",
		" */",
	].join("\n");
	const names = [...documentedParameterNames(block)].sort();
	assert.deepEqual(names, [
		"aliased",
		"count",
		"optionalPlain",
		"plain",
		"record",
		"typed",
	]);
	assert.equal(documentedParameterNames("").size, 0);
	assert.deepEqual(
		[...documentedParameterNames(" * @param {a{b}c} outer - Nested braces.")],
		["outer"],
	);
});

test("passes a candidate that no configured checker covers", async () => {
	const result = await validateCandidate(
		{ path: "notes/todo.txt", content: "hello\n" },
		fixture(),
		{ cwd: workspace },
	);
	assert.equal(result.status, "pass", JSON.stringify(result));
	assert.deepEqual(result.findings, []);
	assert.equal(result.incomplete, false);
	assert.equal(typeof result.elapsedMs, "number");
	assert.equal(result.candidate.bytes, 6);
});

test("collects every applicable pass into one result", async () => {
	const result = await validateCandidate(
		{ path: "src/loose.ts", content: "export function loose() {}\n" },
		fixture({ publicUnitDocs: { typescriptJavascript: true } }),
		{ cwd: workspace },
	);
	assert.equal(result.status, "violations", JSON.stringify(result));
	const passes = new Set(result.findings.map((finding) => finding.pass));
	assert.ok(passes.has("public units"), JSON.stringify(result.findings));
});

test("marks the result incomplete when the budget runs out", async () => {
	const documented = `"""Author: Perijn Huijser
Summary: Documented module used only to exhaust the budget.

Usage:
    Core principle: Keep behavior explicit.
    Setup: Import the module.
    Workflow: Call value.
    API guide: value returns a stable integer.
    Worked example: value()
"""


def value():
    """Return a stable integer."""
    return 1
`;
	const result = await validateCandidate(
		{ path: "src/slow.py", content: documented },
		fixture({ languages: { python: true } }),
		{ timeoutMs: 1, cwd: workspace },
	);
	assert.equal(result.incomplete, true, JSON.stringify(result));
	assert.equal(result.status, "error", JSON.stringify(result));
	assert.match(result.failures.join(";"), /validation budget/u);
});

test("renders every finding with a repair pointer", () => {
	const text = renderFindings({
		status: "violations",
		findings: [
			{ pass: "formatting", text: "Needs formatting by biome." },
			{
				pass: "public units",
				text: "src/a.ts:1 [doc-standard] Missing JSDoc for exported function 'a'.",
			},
			{
				pass: "documentation",
				text: "src/a.ts [doc-standard] Missing '@author' in file header.",
			},
		],
		candidate: { path: "src/a.ts", bytes: 40 },
	});
	assert.match(
		text,
		/^\[doc-standard\] 3 issue\(s\) block writing src\/a\.ts\./u,
	);
	assert.match(text, /^1\. \[formatting\] Needs formatting by biome\./mu);
	assert.match(text, /^3\. \[documentation\] /mu);
	assert.match(text, /Formatting: call write_formatted/u);
	assert.match(
		text,
		/Rules: skill coding-doc-standard .* references\/typescript-javascript\.md\./u,
	);
	assert.match(text, /\/coding-doc-verify/u);
});

test("caps the listed findings but reports the total", () => {
	const findings = Array.from({ length: 7 }, (_unused, index) => ({
		pass: "documentation",
		text: `finding ${index + 1}`,
	}));
	const text = renderFindings(
		{ status: "violations", findings, candidate: { path: "a.ts" } },
		{ max: 3 },
	);
	assert.match(text, /\[doc-standard\] 7 issue\(s\)/u);
	assert.match(text, /plus 4 more issue\(s\)/u);
	assert.doesNotMatch(text, /finding 5/u);
});

test("omits formatting guidance when no formatting finding is shown", () => {
	const text = renderFindings({
		status: "violations",
		findings: [{ pass: "documentation", text: "Missing header." }],
		candidate: { path: "src/a.py" },
	});
	assert.doesNotMatch(text, /format_code/u);
	assert.match(
		text,
		/Rules: skill coding-doc-standard .* references\/python\.md\./u,
	);
});

test("reports unfinished checks separately from findings", () => {
	const text = renderFindings({
		status: "error",
		findings: [],
		failures: ["documentation checker exited 1"],
		candidate: { path: "src/a.py" },
	});
	assert.match(
		text,
		/^\[doc-standard\] Validation could not complete for src\/a\.py\./u,
	);
	assert.match(text, /Not fully checked: documentation checker exited 1/u);
});

test("truncates an oversized report", () => {
	const findings = Array.from({ length: 20 }, (_unused, index) => ({
		pass: "documentation",
		text: `x${"y".repeat(200)}${index}`,
	}));
	const text = renderFindings(
		{ status: "violations", findings, candidate: { path: "a.ts" } },
		{ maxChars: 300 },
	);
	assert.ok(text.length <= 300, `length ${text.length}`);
	assert.ok(text.endsWith("…"));
});
