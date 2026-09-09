/**
 * @module dsh-integration-tests
 * @author Perijn Huijser
 * Verifies the bundle's live wiring against the real DSH runtime packages.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise the real Cordis context, settings installer, and
 *   Claude Code hooks bridge instead of hand-wired stand-ins.
 *   Setup: Run with Node's built-in test runner from the package root.
 *   Workflow: Mount the host plugin, assert settings registration and durable
 *   persistence, then drive tool interception through the real bridge.
 *   API guide: Tests cover settings change propagation and PreToolUse blocking.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Isolate durable plugin state before the host module resolves homedir().
const home = await mkdtemp(join(tmpdir(), "coding-doc-standard-home-"));
process.env.USERPROFILE = home;
process.env.HOME = home;

const POLICY_KEYS = [
	"enabled",
	"python",
	"typescriptJavascript",
	"rust",
	"cCpp",
	"dockerCompose",
	"formatOnWrite",
	"formatPython",
	"formatTypescriptJavascript",
	"formatDockerCompose",
	"blockOnMissingFormatter",
];

const COMPLIANT_TS = [
	"/**",
	" * @module integration-example",
	" * @author Perijn Huijser",
	" * Provides a documented example for the integration test.",
	" *",
	" * @remarks",
	" * Usage:",
	" *   Core principle: Keep the candidate documented and formatted.",
	" *   Setup: Run npm test from the package root.",
	" *   Workflow: The PreToolUse hook checks this candidate before the write.",
	" *   API guide: Exports one documented constant.",
	' *   Worked example: import { ANSWER } from "./integration-example";',
	" */",
	"",
	"export const ANSWER = 42;",
	"",
].join("\n");

const UNDOCUMENTED_TS = "export const undocumented = compute();\n";

/**
 * Builds a settings service stub matching the dsh-settings consumer contract.
 *
 * @returns {object} Stub with registrations, register, and change helpers.
 */
function createSettingsStub() {
	const registrations = [];
	let doc = {};
	const watchers = new Set();
	return {
		registrations,
		register(namespace, schema, options) {
			doc = { ...options.base };
			registrations.push({ namespace, schema, base: options.base });
			return {
				get: () => doc,
				watch: (callback) => {
					watchers.add(callback);
					return () => watchers.delete(callback);
				},
			};
		},
		change(patch) {
			const previous = doc;
			doc = { ...doc, ...patch };
			for (const callback of [...watchers]) callback(doc, previous);
		},
	};
}

/**
 * Builds a shell service stub that runs hook commands through child processes.
 *
 * @returns {object} Stub exposing resolve and run for the hook protocol runner.
 */
function createShellStub() {
	return {
		resolve: (request) => request,
		run: async (request) => {
			const [program, ...args] = request.command.split(" ");
			const result = spawnSync(program, args, {
				input: request.stdin,
				encoding: "utf8",
				...(request.workdir ? { cwd: request.workdir } : {}),
			});
			return {
				exitCode: result.status ?? 1,
				stdout: { text: result.stdout ?? "" },
				stderr: { text: result.stderr ?? "" },
			};
		},
	};
}

/**
 * Polls an asynchronous condition until it is truthy or the deadline passes.
 *
 * @param {() => Promise<any>} condition - Condition producing a truthy value.
 * @param {string} description - What the wait is for, used in the timeout error.
 * @param {number} [timeoutMs] - Maximum wait in milliseconds.
 * @returns {Promise<any>} The first truthy condition value.
 */
async function waitFor(condition, description, timeoutMs = 8000) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const value = await condition();
		if (value) return value;
		if (Date.now() > deadline) {
			throw new Error(`timed out waiting for ${description}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
}

/**
 * Reads the durable policy persisted under the isolated home directory.
 *
 * @returns {Promise<Record<string, any> | null>} Parsed policy or null.
 */
async function readDurablePolicy() {
	try {
		return JSON.parse(
			await readFile(
				join(home, ".dsh", "plugins", "coding-doc-standard", "policy.json"),
				"utf8",
			),
		);
	} catch {
		return null;
	}
}

const { Context } = await import("@deepseek-ai/cordis");
const cordis = new Context();
const settings = createSettingsStub();
cordis.provide("settings", settings);
cordis.provide("shell", createShellStub());

const hostModule = await import(
	pathToFileURL(join(root, "src", "host", "index.mjs")).href
);
await cordis.plugin(hostModule);

test.after(async () => {
	await cordis.stop?.();
	await rm(home, { recursive: true, force: true });
});

test("registers the coding-doc-standard settings namespace with the full schema", async () => {
	const registration = await waitFor(
		async () => settings.registrations[0] ?? null,
		"settings registration",
	);
	assert.equal(registration.namespace, "coding-doc-standard");
	const schemaKeys = Object.keys(registration.schema.dict ?? {});
	assert.deepEqual(schemaKeys.sort(), [...POLICY_KEYS].sort());
});

test("persists the effective policy and follows settings changes", async () => {
	const initial = await waitFor(readDurablePolicy, "durable policy file");
	assert.equal(initial.formatOnWrite, true);
	settings.change({ formatOnWrite: false, formatPython: false });
	const updated = await waitFor(async () => {
		const policy = await readDurablePolicy();
		return policy?.formatOnWrite === false ? policy : null;
	}, "durable policy update");
	assert.equal(updated.formatPython, false);
	assert.equal(updated.enabled, true);
});

/**
 * Drives one PreToolUse interception through the real hooks bridge.
 *
 * @param {string} toolName - Tool name to dispatch on the extension point.
 * @param {Record<string, unknown>} toolInput - Tool input for the hook payload.
 * @returns {Promise<any>} The extension point result.
 */
async function preExecute(toolName, toolInput) {
	return cordis.events.waterfall(
		cordis,
		"tools/pre-execute",
		{
			name: toolName,
			arguments: toolInput,
			callId: "call-integration",
			signal: undefined,
		},
		async () => ({ kind: "allow" }),
	);
}

test("blocks an undocumented TypeScript write through the real bridge", async () => {
	const result = await preExecute("write", {
		file_path: "src/undocumented.ts",
		content: UNDOCUMENTED_TS,
	});
	assert.equal(result.kind, "deny");
	assert.match(String(result.reason), /doc-standard/);
});

test("allows a documented and formatted TypeScript write", async () => {
	const result = await preExecute("write", {
		file_path: "src/integration-example.ts",
		content: COMPLIANT_TS,
	});
	assert.equal(result.kind, "allow");
});

test("does not intercept tools outside the write and edit matcher", async () => {
	const result = await preExecute("read", {
		file_path: "src/undocumented.ts",
	});
	assert.equal(result.kind, "allow");
});
