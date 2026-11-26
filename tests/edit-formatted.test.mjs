/**
 * @module edit-formatted-tests
 * Verify literal edits, formatting, validation, and conflict-safe dispatch.
 *
 * @remarks
 * Run `node --test tests/edit-formatted.test.mjs` from the package root.
 * Temporary files supply real snapshots; a recording dispatcher checks the
 * final native edit without changing the files.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as run from "../src/hook/run.mjs";
import { formatAndEdit } from "../src/host/write-through.mjs";

const workspace = await mkdtemp(join(tmpdir(), "doc-standard-edit-"));
const before =
	"/**\n * @module example\n * Store a documented answer.\n */\n\n/** The answer for callers. */\nexport const ANSWER = 42;\n";
const policy = {
	enabled: true,
	languages: { typescriptJavascript: true },
	publicUnitDocs: { typescriptJavascript: false },
	formatOnWrite: true,
	formatTypescriptJavascript: true,
	validatorFailOpen: false,
	validatorTimeoutMs: 20000,
	ignoredPaths: [],
};

test.after(async () => {
	await rm(workspace, { recursive: true, force: true });
});

test("formats a relative edit and dispatches a snapshot-checked native edit", async () => {
	const filePath = "answer.ts";
	await writeFile(join(workspace, filePath), before);
	const calls = [];
	const tools = {
		get: (name) => (name === "edit" ? { name } : undefined),
		async execute(batch) {
			calls.push(batch);
			return { results: [{ result: { isError: false, content: [] } }] };
		},
	};
	const receipt = await formatAndEdit({
		filePath,
		oldString: "42",
		newString: "[ 1,2 ]",
		language: "typescript",
		tools,
		run,
		policy,
		cwd: workspace,
	});
	assert.equal(receipt.applied, true);
	assert.equal(receipt.validation, "pass");
	assert.equal(calls.length, 1);
	const call = calls[0].calls[0];
	assert.equal(call.name, "edit");
	assert.equal(call.arguments.file_path, filePath);
	assert.equal(call.arguments.old_string, before);
	assert.match(call.arguments.new_string, /ANSWER = \[1, 2\];/u);
	assert.equal(await readFile(join(workspace, filePath), "utf8"), before);
});

test("refuses bad matches, missing files, wrong languages, and invalid documentation before dispatch", async () => {
	await writeFile(join(workspace, "refusals.ts"), before);
	let dispatched = false;
	const base = {
		filePath: "refusals.ts",
		oldString: "42",
		newString: "43",
		language: "typescript",
		tools: {
			async execute() {
				dispatched = true;
				throw new Error("unexpected dispatch");
			},
		},
		run,
		policy,
		cwd: workspace,
	};
	for (const override of [
		{ oldString: "absent" },
		{ oldString: "" },
		{ oldString: " " },
		{ filePath: "missing.ts" },
		{ language: "python" },
		{ oldString: before, newString: "export const ANSWER = 43;\n" },
	]) {
		await assert.rejects(() => formatAndEdit({ ...base, ...override }));
	}
	assert.equal(dispatched, false);
	assert.equal(await readFile(join(workspace, base.filePath), "utf8"), before);
});

test("preserves literal replacement tokens and handles CRLF, deletion, and replace_all", () => {
	assert.equal(run.applyEditPair("a a", "a", "$&", true), "$& $&");
	assert.equal(run.applyEditPair("a", "a", "$&$`$'$$", false), "$&$`$'$$");
	assert.equal(
		run.applyEditPair("a\r\nb\r\n", "a\nb", "c\nd", false),
		"c\r\nd\r\n",
	);
	assert.equal(run.applyEditPair("a a", "a", "", true), " ");
	assert.equal(run.applyEditPair("a a", "a", "b", false), null);
	assert.equal(run.applyEditPair("a", "", "b", true), null);
});

test("reports a conflicting native edit instead of a successful receipt", async () => {
	const filePath = "conflict.ts";
	await writeFile(join(workspace, filePath), before);
	const concurrent = before.replace("42", "99");
	await assert.rejects(
		() =>
			formatAndEdit({
				filePath,
				oldString: "42",
				newString: "43",
				language: "typescript",
				run,
				policy,
				cwd: workspace,
				tools: {
					get: (name) => (name === "edit" ? { name } : undefined),
					async execute(batch) {
						await writeFile(join(workspace, filePath), concurrent);
						assert.notEqual(batch.calls[0].arguments.old_string, concurrent);
						return {
							results: [
								{
									result: {
										isError: true,
										error: { message: "old_string no longer matches" },
									},
								},
							],
						};
					},
				},
			}),
		/old_string no longer matches/u,
	);
	assert.equal(await readFile(join(workspace, filePath), "utf8"), concurrent);
});
