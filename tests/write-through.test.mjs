/**
 * @module write-through-tests
 * @author Perijn Huijser
 * Verifies the single-call format, check, and write path behind write_formatted.
 *
 * @remarks
 * Usage:
 *   Core principle: Assert the bytes handed to the tool dispatcher rather than
 *   a mock, so a receipt that lies about what was written fails here.
 *   Setup: Run npm test from the package root with the pinned formatters
 *   provisioned, exactly as a live write needs them.
 *   Workflow: Call formatAndWrite or previewFormat with a recording tool
 *   runtime and the real validator namespace, then inspect the receipt or the
 *   thrown report.
 *   API guide: Covers the required language and every refusal it can raise,
 *   the preview that never writes, documentation blocks, formatter failures,
 *   and the release of the self-dispatch token.
 *   Worked example: node --test tests/write-through.test.mjs
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as run from "../src/hook/run.mjs";
import {
	formatAndWrite,
	isSelfDispatch,
	languageForPath,
	languageOfExtension,
	previewFormat,
	renderReceipt,
	selfDispatchDepth,
} from "../src/host/write-through.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = await mkdtemp(join(tmpdir(), "doc-standard-write-"));

test.after(async () => {
	await rm(workspace, { recursive: true, force: true });
});

const DOCUMENTED_TS = [
	"/**",
	" * @module write-through-example",
	" * @author Perijn Huijser",
	" * Provides one documented constant for the write-through tests.",
	" *",
	" * @remarks",
	" * Usage:",
	" *   Core principle: Keep the candidate documented and re-formattable.",
	" *   Setup: Run npm test from the package root.",
	" *   Workflow: The formatter tightens the spacing before the write.",
	" *   API guide: Exports one documented constant.",
	' *   Worked example: import { ANSWER } from "./write-through-example";',
	" */",
	"",
	"/**",
	" * Exposes the documented answer.",
	" */",
	"export const ANSWER=42;",
	"",
].join("\n");

const UNDOCUMENTED_TS = "export const undocumented = compute( 1,2 );\n";

/**
 * Builds a policy fixture that switches on every formatter this path can use.
 *
 * @param {Record<string, unknown>} [overrides] - Fields that override the baseline.
 * @returns {Record<string, unknown>} Policy with formatters and doc passes on.
 */
function fixture(overrides = {}) {
	return {
		enabled: true,
		languages: { typescriptJavascript: true },
		publicUnitDocs: { typescriptJavascript: true },
		publicUnitAdapters: {},
		formatOnWrite: true,
		formatPython: true,
		formatTypescriptJavascript: true,
		formatRust: true,
		formatDockerCompose: true,
		composePatterns: ["compose.yaml", "docker-compose.yml"],
		validatorTimeoutMs: 20_000,
		aggregateMaxFindings: 15,
		ignoredPaths: [],
		...overrides,
	};
}

/**
 * Builds a recording tool runtime that stands in for the real dispatcher.
 *
 * @param {any} [result] - Result the inner write resolves with.
 * @param {((input: object) => Promise<void>) | null} [onExecute] - Observer called while the dispatch is live.
 * @returns {{calls: object[], get: (name: string) => any, execute: (input: object) => Promise<any>}} Recording tool runtime.
 */
function makeTools(
	result = { isError: false, value: { ok: true }, content: [] },
	onExecute = null,
) {
	const calls = [];
	return {
		calls,
		get(name) {
			return name === "write" ? { name } : null;
		},
		async execute(input) {
			calls.push(input);
			if (onExecute) await onExecute(input);
			return result;
		},
	};
}

/**
 * Builds the enclosing tool execution one write-through call is given.
 *
 * @param {string} token - Self-dispatch token for this call.
 * @returns {object} Tool execution shaped like the host hands one to a tool.
 */
function execution(token) {
	return {
		token,
		callId: `call-${token}`,
		rootCallId: `root-${token}`,
		signal: new AbortController().signal,
		agent: { session: { header: { cwd: root } } },
	};
}

test("maps a candidate path onto its tool language", () => {
	const policy = fixture();
	assert.equal(languageForPath("a/b/c.py", run, policy), "python");
	assert.equal(languageForPath("a/b/c.tsx", run, policy), "typescript");
	assert.equal(languageForPath("a/b/c.mts", run, policy), "typescript");
	assert.equal(languageForPath("a/b/c.mjs", run, policy), "javascript");
	assert.equal(
		languageForPath("a/compose.yaml", run, policy),
		"docker-compose",
	);
	assert.equal(languageForPath("a/b/c.rs", run, policy), null);
	assert.equal(languageForPath("notes/plan.txt", run, policy), null);
});

test("reads what a path is even where the policy formats nothing", () => {
	const off = fixture({
		formatPython: false,
		formatTypescriptJavascript: false,
	});
	assert.equal(languageOfExtension("a/b/c.py", run, off), "python");
	assert.equal(languageOfExtension("a/b/c.mjs", run, off), "javascript");
	assert.equal(languageOfExtension("a/b/c.rs", run, off), "rust");
	assert.equal(languageOfExtension("notes/plan.txt", run, off), null);
	assert.equal(languageForPath("a/b/c.py", run, off), null);
});

test("refuses a request that declares no language", async () => {
	const tools = makeTools();
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "src/a.ts",
				content: DOCUMENTED_TS,
				exec: execution("tok-nolang"),
				tools,
				run,
				policy: fixture(),
				cwd: root,
			}),
		(error) => {
			assert.match(error.message, /language is required/u);
			assert.match(
				error.message,
				/python, typescript, javascript, docker-compose/u,
			);
			assert.match(error.message, /coding-doc-standard skill/u);
			return true;
		},
	);
	assert.equal(tools.calls.length, 0);
});

test("rejects a language key this plugin does not know", async () => {
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "src/a.ts",
				content: DOCUMENTED_TS,
				language: "cobol",
				tools: makeTools(),
				run,
				policy: fixture(),
				cwd: root,
			}),
		/Unsupported language "cobol"/u,
	);
});

test("refuses a language that contradicts the file extension", async () => {
	const tools = makeTools();
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "src/app.ts",
				content: DOCUMENTED_TS,
				language: "python",
				exec: execution("tok-mismatch"),
				tools,
				run,
				policy: fixture(),
				cwd: root,
			}),
		(error) => {
			assert.match(error.message, /contradicts src\/app\.ts/u);
			assert.match(
				error.message,
				/That path is typescript and formats with biome/u,
			);
			assert.match(error.message, /python formats with ruff/u);
			assert.match(error.message, /Nothing was written/u);
			assert.match(
				error.message,
				/skill\/references\/typescript-javascript\.md/u,
			);
			return true;
		},
	);
	assert.equal(tools.calls.length, 0);
	assert.equal(selfDispatchDepth(), 0);
	await assert.rejects(
		() =>
			previewFormat({
				filePath: "src/util.mjs",
				content: DOCUMENTED_TS,
				language: "typescript",
				tools: makeTools(),
				run,
				policy: fixture(),
				cwd: root,
			}),
		/That path is javascript and formats with biome/u,
	);
});

test("refuses a Rust path because rustfmt is the project toolchain", async () => {
	const tools = makeTools();
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "src/lib.rs",
				content: "fn main() {}\n",
				language: "typescript",
				tools,
				run,
				policy: fixture(),
				cwd: root,
			}),
		(error) => {
			assert.match(
				error.message,
				/is Rust, which this plugin does not format/u,
			);
			assert.match(error.message, /cargo fmt/u);
			return true;
		},
	);
	assert.equal(tools.calls.length, 0);
});

test("refuses a path with no formatter-backed extension", async () => {
	const tools = makeTools();
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "notes/plan.txt",
				content: "hello\n",
				language: "python",
				tools,
				run,
				policy: fixture(),
				cwd: root,
			}),
		(error) => {
			assert.match(
				error.message,
				/No managed formatter is wired up for notes\/plan\.txt/u,
			);
			assert.match(error.message, /plain write tool/u);
			return true;
		},
	);
	assert.equal(tools.calls.length, 0);
});

test("previews the formatted text without dispatching a write", async () => {
	const tools = makeTools();
	const receipt = await previewFormat({
		filePath: "src/preview.ts",
		content: DOCUMENTED_TS,
		language: "typescript",
		exec: execution("tok-preview"),
		tools,
		run,
		policy: fixture(),
		cwd: root,
	});
	assert.equal(receipt.applied, false);
	assert.equal(receipt.language, "typescript");
	assert.equal(receipt.formatter, "biome");
	assert.equal(receipt.changed, true);
	assert.match(receipt.formatted_content, /export const ANSWER = 42;/u);
	assert.equal(tools.calls.length, 0);
	assert.equal(selfDispatchDepth(), 0);
});

test("refuses a preview where the policy switched that formatter off", async () => {
	const tools = makeTools();
	await assert.rejects(
		() =>
			previewFormat({
				filePath: "src/quiet.ts",
				content: DOCUMENTED_TS,
				language: "typescript",
				exec: execution("tok-quiet"),
				tools,
				run,
				policy: fixture({ formatTypescriptJavascript: false }),
				cwd: root,
			}),
		(error) => {
			assert.match(
				error.message,
				/does not format typescript, so a format preview/u,
			);
			assert.match(error.message, /write_formatted instead/u);
			return true;
		},
	);
	assert.equal(tools.calls.length, 0);
});

test("writes the formatted bytes through one inner write", async () => {
	const tools = makeTools();
	const receipt = await formatAndWrite({
		filePath: "src/example.ts",
		content: DOCUMENTED_TS,
		language: "typescript",
		exec: execution("tok-write"),
		tools,
		run,
		policy: fixture(),
		cwd: root,
	});
	assert.equal(receipt.applied, true, JSON.stringify(receipt));
	assert.equal(receipt.validation, "pass", receipt.note);
	assert.equal("formatted_content" in receipt, false);
	assert.equal(tools.calls.length, 1);
	const inner = tools.calls[0];
	assert.equal(inner.name, "write");
	assert.equal(inner.arguments.file_path, "src/example.ts");
	assert.match(inner.arguments.content, /export const ANSWER = 42;/u);
	assert.doesNotMatch(inner.arguments.content, /ANSWER=42/u);
	assert.equal(inner.parent, "tok-write");
	assert.match(inner.callId, /^call-tok-write:write:[0-9a-f-]{36}$/u);
	assert.equal(selfDispatchDepth(), 0);
});

test("writes a file whose formatter the policy switched off", async () => {
	const tools = makeTools();
	const receipt = await formatAndWrite({
		filePath: "src/unformatted.ts",
		content: DOCUMENTED_TS,
		language: "typescript",
		exec: execution("tok-nofmt"),
		tools,
		run,
		policy: fixture({ formatTypescriptJavascript: false }),
		cwd: root,
	});
	assert.equal(receipt.applied, true, JSON.stringify(receipt));
	assert.equal(receipt.formatter, "none");
	assert.equal(receipt.language, "typescript");
	assert.equal(receipt.changed, false);
	assert.equal(tools.calls.length, 1);
	assert.equal(tools.calls[0].arguments.content, DOCUMENTED_TS);
});

test("holds the self-dispatch token only while its write is live", async () => {
	let inside = null;
	const tools = makeTools(undefined, async (input) => {
		inside = isSelfDispatch(input.parent);
	});
	await formatAndWrite({
		filePath: "src/live.ts",
		content: DOCUMENTED_TS,
		language: "typescript",
		exec: execution("tok-live"),
		tools,
		run,
		policy: fixture(),
		cwd: root,
	});
	assert.equal(inside, true);
	assert.equal(isSelfDispatch("tok-live"), false);
	assert.equal(isSelfDispatch(undefined), false);
	assert.equal(selfDispatchDepth(), 0);
});

test("blocks an undocumented write and echoes the formatted text", async () => {
	const tools = makeTools();
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "src/blocked.ts",
				content: UNDOCUMENTED_TS,
				language: "typescript",
				exec: execution("tok-blocked"),
				tools,
				run,
				policy: fixture(),
				cwd: root,
			}),
		(error) => {
			assert.match(
				error.message,
				/\[doc-standard\] Nothing was written to src\/blocked\.ts\./u,
			);
			assert.match(error.message, /issue\(s\) block writing/u);
			assert.match(error.message, /Fix the findings above/u);
			assert.match(
				error.message,
				/export const undocumented = compute\(1, 2\);/u,
			);
			return true;
		},
	);
	assert.equal(tools.calls.length, 0);
	assert.equal(selfDispatchDepth(), 0);
});

test("reports a formatter failure alongside the raw documentation scan", async () => {
	const tools = makeTools();
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "src/broken.ts",
				content: "export const = = 1;\n",
				language: "typescript",
				exec: execution("tok-broken"),
				tools,
				run,
				policy: fixture(),
				cwd: root,
			}),
		(error) => {
			assert.match(error.message, /could not process src\/broken\.ts/u);
			assert.match(error.message, /Nothing was written/u);
			assert.match(error.message, /documentation (check|scan)/u);
			return true;
		},
	);
	assert.equal(tools.calls.length, 0);
});

test("surfaces a refused inner write and releases the token", async () => {
	const tools = makeTools({
		isError: true,
		error: { message: "refused by policy" },
		content: [],
	});
	await assert.rejects(
		() =>
			formatAndWrite({
				filePath: "src/refused.ts",
				content: DOCUMENTED_TS,
				language: "typescript",
				exec: execution("tok-refused"),
				tools,
				run,
				policy: fixture(),
				cwd: root,
			}),
		/refused the formatted text for src\/refused\.ts/u,
	);
	assert.equal(selfDispatchDepth(), 0);
});

test("renders a receipt the model can read", () => {
	const preview = renderReceipt({
		applied: false,
		file_path: "a.ts",
		language: "typescript",
		formatter: "biome",
		changed: true,
		bytes_before: 10,
		bytes_after: 12,
		lines_before: 1,
		lines_after: 1,
		validation: "pass",
		findings: 0,
		note: "",
		formatted_content: "const a = 1;\n",
	});
	assert.match(preview[0].text, /^Formatted a\.ts via biome/u);
	assert.match(preview[0].text, /Not written: this was a preview\./u);
	assert.match(preview[0].text, /Documentation check: pass\./u);
	const written = renderReceipt({
		applied: true,
		file_path: "a.py",
		language: "python",
		formatter: "none",
		changed: false,
		bytes_before: 6,
		bytes_after: 6,
		lines_before: 1,
		lines_after: 1,
		validation: "skipped",
		findings: 0,
		note: "a.py is an ignored path.",
	});
	assert.match(written[0].text, /^Wrote a\.py with no managed formatter/u);
	assert.match(written[0].text, /already formatted/u);
	assert.match(written[0].text, /Documentation check: skipped\./u);
	assert.doesNotMatch(written[0].text, /Formatted content/u);
});

test("stamps a synthetic parent when the host hands over no token", async () => {
	const exec = execution("tok-notoken");
	delete exec.token;
	let inside = null;
	const tools = makeTools(undefined, async (call) => {
		inside = isSelfDispatch(call.parent);
	});
	await formatAndWrite({
		filePath: "src/notoken.ts",
		content: DOCUMENTED_TS,
		language: "typescript",
		exec,
		tools,
		run,
		policy: fixture(),
		cwd: root,
	});
	assert.equal(tools.calls.length, 1);
	const stamp = tools.calls[0].parent;
	assert.equal(typeof stamp, "string");
	assert.match(stamp, /^coding-doc-standard:[0-9a-f-]{36}$/u);
	assert.equal(inside, true);
	assert.equal(selfDispatchDepth(), 0);
});
