/**
 * @module dsh-integration-tests
 * @author Perijn Huijser
 * Verifies the bundle's live wiring against the real DSH runtime packages.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise the real Cordis context, settings installer, and
 *   native global guard instead of hand-wired stand-ins.
 *   Setup: Run with Node's built-in test runner from the package root.
 *   Workflow: Mount the host plugin, assert settings registration and durable
 *   persistence, then drive tool interception through the real bridge.
 *   API guide: Tests cover settings change propagation and PreToolUse blocking.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
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
	"go",
	"csharp",
	"java",
	"kotlin",
	"shell",
	"formatOnWrite",
	"formatPython",
	"formatTypescriptJavascript",
	"formatRust",
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
 * Builds a command registry stub that retains plugin command definitions.
 *
 * @returns {{registrations: object[], register: (definition: object) => () => void}} Command registry stub.
 */
function createCommandsStub() {
	const registrations = [];
	return {
		registrations,
		register: (definition) => {
			registrations.push(definition);
			return () => {
				const index = registrations.indexOf(definition);
				if (index !== -1) registrations.splice(index, 1);
			};
		},
	};
}

/**
 * Captures native global tool guards registered by the host plugin.
 *
 * @returns {{guards: Function[], guard: (guard: Function) => () => void}} Guard registry stub.
 */
function createToolsStub() {
	const guards = [];
	return {
		guards,
		guard(guard) {
			guards.push(guard);
			return () => {
				const index = guards.indexOf(guard);
				if (index !== -1) guards.splice(index, 1);
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
const commands = createCommandsStub();
const tools = createToolsStub();
const hookAgent = {
	id: "agent-integration",
	session: { header: { id: "session-integration", cwd: root } },
};
cordis.provide("settings", settings);
cordis.provide("commands", commands);
cordis.provide("tools", tools);

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

test("registers the workspace verifier as a DSH command", async () => {
	const command = await waitFor(
		async () => commands.registrations[0] ?? null,
		"command registration",
	);
	assert.equal(command.name, "coding-doc-verify");
	assert.match(command.description, /verification/i);
	assert.equal(
		command.input.hint,
		"[paths…] [--optional] [--doxygen Doxyfile]",
	);
	assert.equal(typeof command.handler, "function");
});

test("runs the workspace verifier through the DSH command handler", async () => {
	const command = await waitFor(
		async () => commands.registrations[0] ?? null,
		"command registration",
	);
	const result = await command.handler({
		rawInput: "",
		agent: { session: { header: { cwd: root } } },
		signal: new AbortController().signal,
	});
	assert.equal(result.kind, "success", result.text);
});

test("persists the effective policy and follows settings changes", async () => {
	const initial = await waitFor(readDurablePolicy, "durable policy file");
	assert.equal(initial.formatOnWrite, true);
	settings.change({
		formatOnWrite: false,
		formatPython: false,
		go: true,
		shell: true,
	});
	const updated = await waitFor(async () => {
		const policy = await readDurablePolicy();
		if (policy?.formatOnWrite !== false) return null;
		if (!policy.languages?.go || !policy.languages?.shell) return null;
		return policy;
	}, "durable policy update");
	assert.equal(updated.formatPython, false);
	assert.equal(updated.languages.go, true);
	assert.equal(updated.languages.shell, true);
	assert.equal(updated.enabled, true);
});

/**
 * Evaluates the registered global native guards for one pending tool execution.
 *
 * @param {object} agent - Agent associated with the execution.
 * @param {string} toolName - Tool name to evaluate.
 * @param {Record<string, unknown>} toolInput - Tool input for the candidate validator.
 * @returns {{kind: 'allow'} | {kind: 'deny', reason: string}} Native guard outcome.
 */
function preExecute(agent, toolName, toolInput) {
	const execution = { agent, arguments: toolInput, name: toolName };
	const reason = tools.guards.map((guard) => guard(execution)).find(Boolean);
	return reason ? { kind: "deny", reason } : { kind: "allow" };
}

test("blocks an undocumented namespaced TypeScript write through the native guard", async () => {
	const result = await preExecute(hookAgent, "functions.write", {
		file_path: "src/undocumented.ts",
		content: UNDOCUMENTED_TS,
	});
	assert.equal(result.kind, "deny");
	assert.match(String(result.reason), /doc-standard/);
});

test("allows a documented and formatted namespaced TypeScript write", async () => {
	const result = await preExecute(hookAgent, "functions.write", {
		file_path: "src/integration-example.ts",
		content: COMPLIANT_TS,
	});
	assert.equal(result.kind, "allow");
});

test("enforces the opt-in Go header through the native guard", async () => {
	const missing = await preExecute(hookAgent, "functions.write", {
		file_path: "src/example.go",
		content: "package example\n",
	});
	assert.equal(missing.kind, "deny");
	const documented = await preExecute(hookAgent, "functions.write", {
		file_path: "src/example.go",
		content: `// Author: Perijn Huijser
// Summary: Demonstrates an opt-in Go package header.
// Usage: Import the package from a supported caller.
package example
`,
	});
	assert.equal(documented.kind, "allow");
});

test("applies the global guard to every agent identity", () => {
	const secondAgent = {
		id: "agent-integration-second",
		session: { header: { id: "session-integration-second", cwd: root } },
	};
	const result = preExecute(secondAgent, "functions.write", {
		file_path: "src/second-undocumented.ts",
		content: UNDOCUMENTED_TS,
	});
	assert.equal(result.kind, "deny");
});

test("does not intercept tools outside the write and edit matcher", async () => {
	const result = await preExecute(hookAgent, "read", {
		file_path: "src/undocumented.ts",
	});
	assert.equal(result.kind, "allow");
});
