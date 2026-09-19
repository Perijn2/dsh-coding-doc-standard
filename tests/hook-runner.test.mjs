/**
 * @module hook-runner-tests
 * @author Perijn Huijser
 * Verifies pending write and edit candidate construction for hook execution.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise the hook adapter independently of the DSH bridge.
 *   Setup: Run with Node's built-in test runner.
 *   Workflow: Build hook payloads, materialize temporary edit targets, and assert
 *   the exact candidate text returned by the adapter.
 *   API guide: Tests cover accepted write payloads and edit-match failures.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkProjectPublicUnits } from "../src/hook/public-unit-adapter.mjs";
import {
	candidateFromPayload,
	checkFormatting,
	checkSourcePublicUnits,
	formatterProfile,
	loadPolicy,
} from "../src/hook/run.mjs";

/**
 * Creates and removes a temporary directory around an asynchronous test action.
 *
 * @param {(directory: string) => Promise<void>} action - Test action using the temporary directory.
 * @returns {Promise<void>} Completion after cleanup.
 */
async function withTemporaryDirectory(action) {
	const directory = await mkdtemp(join(tmpdir(), "coding-doc-standard-"));
	try {
		await action(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("builds a candidate from a write payload", async () => {
	const candidate = await candidateFromPayload({
		tool_input: { file_path: "compose.yaml", content: "# Summary: example\n" },
	});
	assert.deepEqual(candidate, {
		path: "compose.yaml",
		content: "# Summary: example\n",
	});
});

test("builds a candidate from an exact edit payload", async () => {
	await withTemporaryDirectory(async (directory) => {
		const path = join(directory, "example.py");
		await writeFile(path, "before\n", "utf8");
		const candidate = await candidateFromPayload({
			tool_input: {
				file_path: path,
				old_string: "before",
				new_string: "after",
			},
		});
		assert.equal(candidate.content, "after\n");
	});
});

test("rejects edits whose old text is not unique", async () => {
	await withTemporaryDirectory(async (directory) => {
		const path = join(directory, "example.py");
		await writeFile(path, "same\nsame\n", "utf8");
		await assert.rejects(
			candidateFromPayload({
				tool_input: { file_path: path, old_string: "same", new_string: "next" },
			}),
			/match exactly once/,
		);
	});
});

test("selects only pinned fast formatter profiles", () => {
	const policy = loadPolicy();
	assert.equal(formatterProfile("example.py", policy), "python");
	assert.equal(formatterProfile("example.ts", policy), "typescriptJavascript");
	assert.equal(formatterProfile("compose.yaml", policy), "dockerCompose");
	assert.equal(
		formatterProfile("example.rs", { ...policy, formatRust: false }),
		null,
	);
	assert.equal(
		formatterProfile("example.rs", { ...policy, formatRust: true }),
		"rust",
	);
	assert.equal(formatterProfile("example.cpp", policy), null);
	for (const path of [
		"example.go",
		"example.cs",
		"Example.java",
		"Example.kt",
		"script.sh",
		"script.bash",
		"Example.php",
		"example.rb",
		"Example.swift",
		"example.dart",
		"Example.hs",
		"example.lua",
		"Example.scala",
	]) {
		assert.equal(formatterProfile(path, policy), null, path);
	}
});

test("checks direct exported TypeScript and JavaScript units only when enabled", () => {
	const policy = {
		...loadPolicy(),
		publicUnitDocs: { typescriptJavascript: true },
	};
	const missing = checkSourcePublicUnits(
		{
			path: "example.ts",
			content: `export function missing() {}
export const value = 1;
function privateHelper() {}
export { privateHelper };
`,
		},
		policy,
	);
	assert.equal(missing.length, 2);
	assert.match(missing[0], /exported function 'missing'/);
	assert.match(missing[1], /exported variable 'value'/);
	const documented = checkSourcePublicUnits(
		{
			path: "example.js",
			content: `/**
 * Documents the exported function.
 */
export function documented() {}
/**
 * Documents the default class.
 */
export default class Example {}
`,
		},
		policy,
	);
	assert.deepEqual(documented, []);
	assert.deepEqual(
		checkSourcePublicUnits(
			{ path: "example.ts", content: "export function missing() {}\n" },
			{ ...loadPolicy(), publicUnitDocs: { typescriptJavascript: false } },
		),
		[],
	);
});

test("fails closed only for enabled project public-unit adapters", async () => {
	const candidate = { path: "example.go", content: "package example\n" };
	assert.deepEqual(await checkProjectPublicUnits(candidate, loadPolicy()), []);
	const enabled = {
		...loadPolicy(),
		publicUnitDocs: { go: true },
		publicUnitAdapters: {},
	};
	const failures = await checkProjectPublicUnits(candidate, enabled);
	assert.equal(failures.length, 1);
	assert.match(failures[0], /go is enabled but not configured/);
});

test("normalizes project adapter violations from pending candidate JSON", async () => {
	const adapterProgram = `let input = "";
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  const candidate = JSON.parse(input);
  console.log(JSON.stringify({ violations: [{
    line: 3,
    kind: "function",
    name: candidate.content === "pending" ? "run" : "wrong",
    message: "Missing native documentation."
  }] }));
});`;
	const policy = {
		...loadPolicy(),
		publicUnitDocs: { go: true },
		publicUnitAdapters: {
			go: { command: process.execPath, args: ["-e", adapterProgram] },
		},
	};
	assert.deepEqual(
		await checkProjectPublicUnits(
			{ path: "example.go", content: "pending" },
			policy,
		),
		[
			"example.go:3 [doc-standard] Missing native documentation. (function run)",
		],
	);
});

test("fails closed for malformed and failing project adapters", async () => {
	const base = { ...loadPolicy(), publicUnitDocs: { go: true } };
	const malformed = await checkProjectPublicUnits(
		{ path: "example.go", content: "pending" },
		{
			...base,
			publicUnitAdapters: {
				go: { command: process.execPath, args: ["-e", "console.log('bad')"] },
			},
		},
	);
	assert.match(malformed[0], /returned invalid output/);
	const failing = await checkProjectPublicUnits(
		{ path: "example.go", content: "pending" },
		{
			...base,
			publicUnitAdapters: {
				go: { command: process.execPath, args: ["-e", "process.exit(7)"] },
			},
		},
	);
	assert.match(failing[0], /failed: exit 7/);
});

test("accepts a rustfmt-formatted Rust candidate when the opt-in profile is enabled", async () => {
	assert.equal(
		await checkFormatting(
			{ path: "example.rs", content: "fn main() {}\n" },
			{ ...loadPolicy(), formatRust: true, blockOnMissingFormatter: false },
		),
		null,
	);
});

test("blocks a Python candidate that Ruff would reformat", async () => {
	const message = await checkFormatting({
		path: "example.py",
		content: "value=1\n",
	});
	assert.match(message, /Ruff 0\.16\.6/);
});

test("accepts a Ruff-formatted Python candidate", async () => {
	assert.equal(
		await checkFormatting({ path: "example.py", content: "value = 1\n" }),
		null,
	);
});

test("blocks TypeScript and Compose candidates that pinned formatters would change", async () => {
	const typescript = await checkFormatting({
		path: "example.ts",
		content: "export const value=1\n",
	});
	const compose = await checkFormatting({
		path: "compose.yaml",
		content: "services:\n  app:\n   image: example/app\n",
	});
	assert.match(typescript, /@biomejs\/biome 2\.5\.12/);
	assert.match(compose, /prettier 3\.9\.6/);
});
