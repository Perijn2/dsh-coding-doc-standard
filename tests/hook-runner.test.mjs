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
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	formatterDeclarationFor,
	formatWithDeclaredFormatter,
	runFormatterAdapter,
} from "../src/engine/formatters.mjs";
import { loadPacks } from "../src/engine/registry.mjs";
import { checkProjectPublicUnits } from "../src/hook/public-unit-adapter.mjs";
import {
	buildCandidate,
	candidateFromPayload,
	checkFormatting,
	checkSourcePublicUnits,
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

const formatterPolicy = {
	...loadPolicy(),
	formatOnWrite: true,
	formatPython: true,
	formatTypescriptJavascript: true,
	formatDockerCompose: true,
};

test("resolves formatter declarations from packs, never from engine knowledge", () => {
	assert.equal(
		formatterDeclarationFor("example.py").formatter.settingsKey,
		"formatPython",
	);
	assert.equal(
		formatterDeclarationFor("example.tsx").formatter.label,
		"@biomejs/biome 2.5.12",
	);
	assert.equal(
		formatterDeclarationFor("compose.yaml").formatter.label,
		"prettier 3.9.6",
	);
	// The Rust pack declares the project-toolchain rustfmt through the
	// external-command adapter, gated by the opt-in formatRust setting.
	const rustFormatter = formatterDeclarationFor("example.rs");
	assert.equal(rustFormatter.formatter.adapter, "external-command");
	assert.equal(rustFormatter.formatter.settingsKey, "formatRust");
	assert.equal(rustFormatter.formatter.dependency.bin, "rustfmt");
	assert.equal(formatterDeclarationFor("example.cpp"), null);
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
		"Example.scala",
	]) {
		assert.equal(formatterDeclarationFor(path), null, path);
	}
	// The Lua pack owns documentation, not formatting.
	assert.equal(formatterDeclarationFor("example.lua"), null);
});

test("checks direct exported TypeScript and JavaScript units only when enabled", () => {
	const policy = {
		...loadPolicy(),
		enabled: true,
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
	assert.deepEqual(
		checkSourcePublicUnits(
			{ path: "example.ts", content: "export function missing() {}\n" },
			{
				...loadPolicy(),
				enabled: false,
				publicUnitDocs: { typescriptJavascript: true },
			},
		),
		[],
		"a disabled policy must never report findings",
	);
});

test("skips unconfigured optional project public-unit adapters", async () => {
	const candidate = { path: "example.go", content: "package example\n" };
	const policy = {
		...loadPolicy(),
		publicUnitDocs: { go: true },
		publicUnitAdapters: {},
	};
	assert.deepEqual(await checkProjectPublicUnits(candidate, policy), []);
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

test("uses rustdoc as a native Rust public-unit adapter", async () => {
	const policy = {
		...loadPolicy(),
		publicUnitDocs: { rust: true },
		publicUnitAdapters: {
			rust: {
				command: process.execPath,
				args: ["scripts/adapters/rust-public-unit-adapter.mjs"],
				cwd: process.cwd(),
			},
		},
	};
	const failures = await checkProjectPublicUnits(
		{ path: "example.rs", content: "pub fn run() {}\n" },
		policy,
	);
	assert.ok(failures.length >= 1);
	assert.match(failures[0], /Missing native rustdoc documentation/);
});

test("uses Doxygen as a native C/C++ public-unit adapter", async () => {
	const policy = {
		...loadPolicy(),
		publicUnitDocs: { cCpp: true },
		publicUnitAdapters: {
			cCpp: {
				command: process.execPath,
				args: ["scripts/adapters/cpp-public-unit-adapter.mjs"],
				cwd: process.cwd(),
			},
		},
	};
	const failures = await checkProjectPublicUnits(
		{ path: "example.h", content: "int add(int left, int right);\n" },
		policy,
	);
	assert.ok(failures.length >= 1);
	assert.match(failures[0], /Missing native Doxygen documentation/);
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

test("cancels a running project adapter before its own timeout", async () => {
	const failures = await checkProjectPublicUnits(
		{ path: "example.go", content: "pending" },
		{
			publicUnitDocs: { go: true },
			publicUnitAdapters: {
				go: {
					command: process.execPath,
					args: ["-e", "setInterval(() => {}, 1000)"],
					timeoutMs: 2000,
				},
			},
		},
		{ signal: AbortSignal.timeout(100) },
	);
	assert.match(failures[0], /aborted/iu);
});

test("survives a large pending payload when the adapter exits unread", async () => {
	const failures = await checkProjectPublicUnits(
		{ path: "example.go", content: "x".repeat(4_000_000) },
		{
			...loadPolicy(),
			publicUnitDocs: { go: true },
			publicUnitAdapters: {
				go: {
					command: process.execPath,
					args: ["-e", "setTimeout(() => process.exit(3), 0)"],
				},
			},
		},
	);
	assert.match(failures[0], /failed: exit 3/u);
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

/**
 * Writes one fixture pack carrying a project-sourced formatter into a packs root.
 *
 * @param {string} packsRoot - Temporary languages root passed to loadPacks.
 * @param {object} formatter - Formatter declaration to embed in the profile.
 * @returns {Promise<void>} Completion once the pack files exist.
 */
async function writeFakePack(packsRoot, formatter) {
	const packDir = join(packsRoot, "fake");
	await mkdir(join(packDir, "profiles", "modern"), { recursive: true });
	await writeFile(
		join(packDir, "pack.json"),
		JSON.stringify({
			id: "fake",
			label: "Fake",
			packVersion: "1.0.0",
			language: { name: "Fake", defaultProfile: "modern" },
			profiles: ["modern"],
		}),
	);
	await writeFile(
		join(packDir, "profiles", "modern", "profile.json"),
		JSON.stringify({
			id: "modern",
			languageVersions: "*",
			extensions: [".fake"],
			codec: {
				headerSyntax: "line",
				headerToken: "#",
				fields: { author: "Author:", summary: "Summary:" },
			},
			units: {
				provider: "regex",
				pattern: "^([a-z]+)\\s*\\(",
				kind: "function",
			},
			formatter,
		}),
	);
}

test("degrades a missing project formatter per blockOnMissingFormatter", async () => {
	await withTemporaryDirectory(async (directory) => {
		const packsRoot = join(directory, "packs");
		await writeFakePack(packsRoot, {
			adapter: "external-command",
			checkMode: "stdout-diff",
			label: "fakefmt (project toolchain)",
			settingsKey: "formatFake",
			dependency: {
				source: "project",
				bin: "definitely-missing-fakefmt-12345",
			},
			args: [],
			cleanExit: [0],
			unavailableHint: "Install fakefmt in the project.",
		});
		const registry = loadPacks(packsRoot);
		assert.equal(registry.excluded.length, 0);
		const candidate = { path: "example.fake", content: "alpha()\n" };
		const allowed = await runFormatterAdapter(
			candidate,
			{ formatOnWrite: true, formatFake: true, blockOnMissingFormatter: false },
			directory,
			{ registry },
		);
		assert.equal(allowed, null);
		const blocked = await runFormatterAdapter(
			candidate,
			{ formatOnWrite: true, formatFake: true, blockOnMissingFormatter: true },
			directory,
			{ registry },
		);
		assert.match(blocked, /fakefmt \(project toolchain\)/);
		assert.match(blocked, /Install fakefmt in the project\./);
		const gated = await runFormatterAdapter(
			candidate,
			{ formatOnWrite: true, formatFake: false, blockOnMissingFormatter: true },
			directory,
			{ registry },
		);
		assert.equal(
			gated,
			null,
			"the settings key gates the check before any spawn",
		);
	});
});

test("runs a pack-declared external-command formatter when the binary exists", async () => {
	await withTemporaryDirectory(async (directory) => {
		await writeFile(
			join(directory, "echo.mjs"),
			'let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => process.stdout.write(s));',
		);
		await writeFile(
			join(directory, "upper.mjs"),
			'let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => process.stdout.write(s.toUpperCase()));',
		);
		const formatterFor = (script) => ({
			adapter: "external-command",
			checkMode: "stdout-diff",
			label: "fakefmt",
			settingsKey: "formatFake",
			dependency: { source: "project", bin: process.execPath },
			args: [script],
			cleanExit: [0],
		});
		const packsRoot = join(directory, "packs");
		const candidate = { path: "example.fake", content: "alpha()\n" };
		await writeFakePack(packsRoot, formatterFor(join(directory, "echo.mjs")));
		const clean = await runFormatterAdapter(
			candidate,
			{ formatOnWrite: true, formatFake: true },
			directory,
			{ registry: loadPacks(packsRoot) },
		);
		assert.equal(clean, null, "identical stdout means already formatted");
		await writeFakePack(packsRoot, formatterFor(join(directory, "upper.mjs")));
		const changed = await runFormatterAdapter(
			candidate,
			{ formatOnWrite: true, formatFake: true },
			directory,
			{ registry: loadPacks(packsRoot) },
		);
		assert.match(changed, /must match fakefmt formatting/);
	});
});

test("excludes a full profile whose declared formatter is invalid", async () => {
	await withTemporaryDirectory(async (directory) => {
		const packsRoot = join(directory, "packs");
		await writeFakePack(packsRoot, {
			adapter: "bogus-adapter",
			dependency: { source: "project", bin: "x" },
		});
		const registry = loadPacks(packsRoot);
		assert.equal(registry.packs.size, 0);
		assert.equal(registry.excluded.length, 1);
		assert.match(registry.excluded[0].reason, /unsupported formatter adapter/);
	});
});

test("formatWithDeclaredFormatter returns the pack formatter's stdout", async () => {
	await withTemporaryDirectory(async (directory) => {
		await writeFile(
			join(directory, "upper.mjs"),
			'let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => process.stdout.write(s.toUpperCase()));',
		);
		const packsRoot = join(directory, "packs");
		await writeFakePack(packsRoot, {
			adapter: "external-command",
			checkMode: "stdout-diff",
			label: "fakefmt",
			settingsKey: "formatFake",
			dependency: { source: "project", bin: process.execPath },
			args: [join(directory, "upper.mjs")],
			cleanExit: [0],
		});
		const registry = loadPacks(packsRoot);
		const candidate = { path: "example.fake", content: "alpha()\n" };
		const result = await formatWithDeclaredFormatter(
			candidate,
			{ formatFake: true },
			directory,
			{ registry },
		);
		assert.equal(result.status, "formatted");
		assert.equal(result.text, "ALPHA()\n");
		assert.equal(result.changed, true);
		const disabled = await formatWithDeclaredFormatter(
			candidate,
			{ formatFake: false },
			directory,
			{ registry },
		);
		assert.equal(disabled.status, "disabled");
	});
});

test("captures complete large formatter stdout", async () => {
	await withTemporaryDirectory(async (directory) => {
		const expected = "formatted\n".repeat(100_000);
		await writeFile(
			join(directory, "delayed.mjs"),
			`process.stdout.end(${JSON.stringify(expected)});`,
		);
		const packsRoot = join(directory, "packs");
		await writeFakePack(packsRoot, {
			adapter: "external-command",
			checkMode: "stdout-diff",
			dependency: { source: "project", bin: process.execPath },
			args: [join(directory, "delayed.mjs")],
			cleanExit: [0],
		});
		const result = await formatWithDeclaredFormatter(
			{ path: "example.fake", content: "before\n" },
			{},
			directory,
			{ registry: loadPacks(packsRoot) },
		);
		assert.equal(result.status, "formatted");
		assert.equal(result.text.length, expected.length);
		assert.equal(result.text, expected);
	});
});

test("formatWithDeclaredFormatter reports a missing project binary per policy", async () => {
	await withTemporaryDirectory(async (directory) => {
		const packsRoot = join(directory, "packs");
		await writeFakePack(packsRoot, {
			adapter: "external-command",
			checkMode: "stdout-diff",
			label: "fakefmt",
			settingsKey: "formatFake",
			dependency: {
				source: "project",
				bin: "definitely-missing-fakefmt-12345",
			},
			args: [],
			cleanExit: [0],
			unavailableHint: "Install fakefmt in the project.",
		});
		const registry = loadPacks(packsRoot);
		const candidate = { path: "example.fake", content: "alpha()\n" };
		const blocked = await formatWithDeclaredFormatter(
			candidate,
			{ formatFake: true, blockOnMissingFormatter: true },
			directory,
			{ registry },
		);
		assert.equal(blocked.status, "unavailable");
		assert.equal(blocked.blocked, true);
		assert.match(blocked.message, /Install fakefmt in the project\./);
		const allowed = await formatWithDeclaredFormatter(
			candidate,
			{ formatFake: true, blockOnMissingFormatter: false },
			directory,
			{ registry },
		);
		assert.equal(allowed.status, "unavailable");
		assert.equal(allowed.blocked, false);
	});
});

test("blocks a Python candidate that Ruff would reformat", async () => {
	const message = await checkFormatting(
		{
			path: "example.py",
			content: "value=1\n",
		},
		formatterPolicy,
	);
	assert.match(message, /Ruff 0\.16\.6/);
});

test("accepts a Ruff-formatted Python candidate", async () => {
	assert.equal(
		await checkFormatting(
			{ path: "example.py", content: "value = 1\n" },
			formatterPolicy,
		),
		null,
	);
});

test("reports formatter invocation details when Biome fails", async () => {
	const message = await checkFormatting(
		{ path: "broken.ts", content: "export const =\n" },
		formatterPolicy,
	);
	assert.match(message, /Executable:/);
	assert.match(message, /Arguments:/);
	assert.match(message, /Exit:/);
	assert.match(message, /Formatter output:/);
});

test("blocks TypeScript and Compose candidates that pinned formatters would change", async () => {
	const typescript = await checkFormatting(
		{
			path: "example.ts",
			content: "export const value=1\n",
		},
		formatterPolicy,
	);
	const compose = await checkFormatting(
		{
			path: "compose.yaml",
			content: "services:\n  app:\n   image: example/app\n",
		},
		formatterPolicy,
	);
	assert.match(typescript, /@biomejs\/biome 2\.5\.12/);
	assert.match(compose, /prettier 3\.9\.6/);
});

test("builds a candidate from an edit whose line endings drift", async () => {
	await withTemporaryDirectory(async (directory) => {
		const path = join(directory, "crlf.py");
		await writeFile(path, "before\r\nsame\r\nafter\r\n", "utf8");
		const built = await buildCandidate({
			tool_input: {
				file_path: path,
				old_string: "before\nsame",
				new_string: "first\nsecond",
			},
		});
		assert.equal(built.applicable, true);
		assert.equal(built.candidate.content, "first\r\nsecond\r\nafter\r\n");
	});
});

test("builds a candidate from a replace_all edit", async () => {
	await withTemporaryDirectory(async (directory) => {
		const path = join(directory, "multi.py");
		await writeFile(path, "same\nsame\n", "utf8");
		const built = await buildCandidate({
			tool_input: {
				file_path: path,
				old_string: "same",
				new_string: "next",
				replace_all: true,
			},
		});
		assert.equal(built.applicable, true);
		assert.equal(built.candidate.content, "next\nnext\n");
	});
});

test("still skips a multi-match edit without replace_all", async () => {
	await withTemporaryDirectory(async (directory) => {
		const path = join(directory, "multi.py");
		await writeFile(path, "same\nsame\n", "utf8");
		const built = await buildCandidate({
			tool_input: { file_path: path, old_string: "same", new_string: "next" },
		});
		assert.equal(built.applicable, false);
		assert.match(built.reason, /matched 2 copies/);
	});
});

test("skips a replace_all edit whose old text matches nothing", async () => {
	await withTemporaryDirectory(async (directory) => {
		const path = join(directory, "multi.py");
		await writeFile(path, "same\n", "utf8");
		const built = await buildCandidate({
			tool_input: {
				file_path: path,
				old_string: "absent",
				new_string: "next",
				replace_all: true,
			},
		});
		assert.equal(built.applicable, false);
		assert.match(built.reason, /nothing to change/);
	});
});
