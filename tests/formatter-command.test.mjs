/**
 * @module formatter-command-tests
 * @author Perijn Huijser
 * Verifies parsing and execution of the managed formatter slash command.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise package-resolved formatter binaries without PATH.
 *   Setup: Run with Node's built-in test runner from the package root.
 *   Workflow: Parse command input, format a temporary file, and inspect errors.
 *   API guide: The tests call the exported formatter command functions.
 *   Worked example: node --test tests/formatter-command.test.mjs
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	parseFormatterArguments,
	runFormatterCommand,
} from "../src/formatter/command.mjs";

test("parses language, quoted file, and formatter-specific flags", () => {
	assert.deepEqual(
		parseFormatterArguments(
			'--typescript --file "src/example file.ts" -- --indent-style space',
		),
		{
			profile: "biome",
			file: "src/example file.ts",
			formatterArgs: ["--indent-style", "space"],
			content: null,
		},
	);
});

test("returns actionable usage errors", async () => {
	const result = await runFormatterCommand(
		"--python",
		process.cwd(),
		new AbortController().signal,
	);
	assert.equal(result.kind, "error");
	assert.match(result.text, /--file <path>/);
});

test("maps check-only mode to Biome without forwarding an invalid flag", async () => {
	const directory = await mkdtemp(join(tmpdir(), "code-formatter-check-"));
	try {
		const file = join(directory, "example.ts");
		await writeFile(file, "export const value = 1;\n", "utf8");
		const result = await runFormatterCommand(
			"--typescript --file example.ts -- --check",
			directory,
			new AbortController().signal,
		);
		assert.equal(result.kind, "success", result.text);
		assert.doesNotMatch(result.text, /format --check/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("formats TypeScript with package-managed Biome and reports invocation", async () => {
	const directory = await mkdtemp(join(tmpdir(), "code-formatter-"));
	try {
		const file = join(directory, "example.ts");
		await writeFile(file, "export const value=1\n", "utf8");
		const result = await runFormatterCommand(
			"--typescript --file example.ts",
			directory,
			new AbortController().signal,
		);
		assert.equal(result.kind, "success", result.text);
		assert.match(result.text, /@biomejs\/biome 2\.5\.12/);
		assert.match(result.text, /Command:/);
		assert.match(result.text, /Exit: 0/);
		assert.equal(await readFile(file, "utf8"), "export const value = 1;\n");
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
test("formats pending TypeScript content without an existing file", async () => {
	const source = "export const value=1\n";
	const encoded = Buffer.from(source).toString("base64");
	const result = await runFormatterCommand(
		`--typescript --file pending.ts --content-base64 ${encoded}`,
		process.cwd(),
		new AbortController().signal,
	);
	assert.equal(result.kind, "success", result.text);
	assert.match(result.text, /--stdin-file-path pending\.ts/u);
	assert.match(result.text, /export const value = 1;/u);
});
test("formats direct UTF-8 pending content", async () => {
	const result = await runFormatterCommand(
		'--typescript --file pending.ts --content-utf8 "export const café=1"',
		process.cwd(),
		new AbortController().signal,
	);
	assert.equal(result.kind, "success", result.text);
	assert.match(result.text, /export const café = 1;/u);
});

test("returns the complete formatted text for files above 200 KB", async () => {
	const lines = [];
	for (let index = 0; index < 8000; index += 1)
		lines.push(`export const value${index} = ${index};`);
	const source = `${lines.join("\n")}\n`;
	assert.ok(source.length > 200_000, "fixture must exceed the old output cap");
	const encoded = Buffer.from(source).toString("base64");
	const result = await runFormatterCommand(
		`--typescript --file big.ts --content-base64 ${encoded}`,
		process.cwd(),
		new AbortController().signal,
	);
	assert.equal(result.kind, "success", result.text);
	assert.ok(
		result.formattedContent?.startsWith("export const value0 = 0;"),
		"the head of the formatted file must survive",
	);
	assert.ok(
		result.formattedContent?.endsWith("export const value7999 = 7999;\n"),
		"the tail of the formatted file must survive",
	);
});

test("rejects conflicting candidate encodings", () => {
	assert.throws(
		() =>
			parseFormatterArguments(
				'--typescript --file pending.ts --content-utf8 "const x=1" --content-base64 YQ==',
			),
		/only one candidate content encoding/u,
	);
});
