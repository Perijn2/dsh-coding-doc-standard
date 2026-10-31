/**
 * @module settings-master-switch-tests
 * @author Perijn Huijser
 * Verifies that the master switch retracts every surface the plugin adds.
 *
 * @remarks
 * Usage:
 *   Core principle: The real settings provider is the only honest witness; a
 *     stub that never merges a user section cannot see a switch change arrive.
 *   Setup: Run with Node's built-in test runner from the package root.
 *   Workflow: Mount the host plugin over a real provider, flip the master
 *     switch through the provider, and assert what is registered on each side.
 *   API guide: Tests cover the advisory, both commands, both tools, and the gate.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import { SettingsProvider } from "@deepseek-ai/dsh-settings";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Isolate durable plugin state before the host module resolves homedir().
const home = await mkdtemp(join(tmpdir(), "coding-doc-standard-switch-"));
process.env.USERPROFILE = home;
process.env.HOME = home;

/**
 * Real provider seam backed by one in-memory document.
 *
 * The base class owns namespace registration, the schema/base/user resolution
 * order, validation, revision bumps, and the commit that fires watchers. Only
 * raw storage is swapped, so a test here exercises the same code path a real
 * `settings.mutate` from the browser takes.
 */
class MemorySettings extends SettingsProvider {
	document_ = {};

	/**
	 * Reports whether this provider accepts in-process writes.
	 *
	 * @returns {boolean} Always true; a local document is writable.
	 */
	get writable() {
		return true;
	}

	/**
	 * Returns the stored raw document at service start.
	 *
	 * @returns {Promise<Record<string, unknown>>} Raw namespace sections.
	 */
	async load() {
		return this.document_;
	}

	/**
	 * Stores one namespace's raw user section.
	 *
	 * @param {string} ns - Namespace being written.
	 * @param {Record<string, unknown>} section - Complete next user section.
	 * @returns {Promise<void>} Completion once the section is stored.
	 */
	async persist(ns, section) {
		this.document_ = { ...this.document_, [ns]: section };
	}
}

/**
 * Records command registrations and honours their disposers.
 *
 * @returns {{names: () => string[], register: (definition: object) => () => void}} Command stub.
 */
function createCommandsStub() {
	const live = new Set();
	return {
		names: () => [...live].map((entry) => entry.name),
		register(definition) {
			live.add(definition);
			return () => live.delete(definition);
		},
	};
}

/**
 * Records tool registrations and honours their disposers.
 *
 * @returns {{names: () => string[], register: (definition: object) => () => void}} Tool stub.
 */
function createToolsStub() {
	const live = new Set();
	return {
		names: () => [...live].map((entry) => entry.name),
		register(definition) {
			live.add(definition);
			return () => live.delete(definition);
		},
	};
}

/**
 * Records system-prompt sections and honours their disposers.
 *
 * @returns {{sections: object[], section: (section: object) => () => void}} Prompt registry stub.
 */
function createSystemPromptStub() {
	const sections = [];
	return {
		sections,
		section(section) {
			sections.push(section);
			return () => {
				const index = sections.indexOf(section);
				if (index !== -1) sections.splice(index, 1);
			};
		},
	};
}

/**
 * Polls an asynchronous condition until it holds or the deadline passes.
 *
 * @param {() => boolean | Promise<boolean>} condition - Condition producing truthy on success.
 * @param {string} description - What is awaited, used in the timeout error.
 * @returns {Promise<void>} Completion once the condition holds.
 */
async function waitFor(condition, description, timeoutMs = 8000) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (await condition()) return;
		if (Date.now() > deadline)
			throw new Error(`timed out waiting for ${description}`);
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

const cordis = new Context();
const settings = new MemorySettings(cordis);
const commands = createCommandsStub();
const tools = createToolsStub();
const systemPrompt = createSystemPromptStub();
cordis.provide("commands", commands);
cordis.provide("tools", tools);
cordis.provide("systemPrompt", systemPrompt);
settings.publish(await settings.load());

const preExecutors = [];
cordis.on("internal/listener", (eventName, listener) => {
	if (eventName === "tools/pre-execute") preExecutors.push(listener);
});

const hostModule = await import(
	pathToFileURL(join(root, "src", "host", "index.mjs")).href
);
await cordis.plugin(hostModule);

test.after(async () => {
	await cordis.stop?.();
	await rm(home, { recursive: true, force: true });
});

/**
 * Drives one pending tool call through the registered pre-execute policy.
 *
 * @param {string} name - Tool name under test.
 * @param {Record<string, unknown>} args - Tool input for the candidate builder.
 * @returns {Promise<{kind: string, reason?: string}>} The aggregated decision.
 */
async function preExecute(name, args) {
	const execution = {
		callId: "switch-probe",
		name,
		arguments: args,
		agent: {
			id: "switch-probe",
			session: { header: { id: "switch-probe", cwd: root } },
		},
		signal: new AbortController().signal,
	};
	for (const listener of preExecutors) {
		const decision = (await listener(execution, async () => ({
			kind: "allow",
		}))) ?? {
			kind: "allow",
		};
		if (decision.kind !== "allow") return decision;
	}
	return { kind: "allow" };
}

/**
 * Reads the durable policy the plugin persists after every settings change.
 *
 * @returns {Promise<Record<string, any> | null>} Parsed policy, or null before the first write.
 */
async function durablePolicy() {
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

const undocumented = {
	file_path: "src/undocumented-switch.ts",
	content: "export const undocumented = compute();\n",
};

test("registers every surface while the master switch is on", async () => {
	await waitFor(
		() => systemPrompt.sections.length === 1,
		"advisory registration",
	);
	assert.deepEqual(commands.names().sort(), [
		"code-formatter",
		"coding-doc-verify",
	]);
	assert.deepEqual(tools.names().sort(), ["format_code", "write_formatted"]);
	assert.equal(
		(await preExecute("write", undocumented)).kind,
		"deny",
		"the gate must still block while enabled",
	);
});

test("retracts the advisory when only the advisory is switched off", async () => {
	await settings.mutate("coding-doc-standard", [
		{ op: "set", path: ["general", "systemPromptAdvisory"], value: false },
	]);
	await waitFor(
		() => systemPrompt.sections.length === 0,
		"advisory retraction",
	);
	assert.deepEqual(tools.names().sort(), ["format_code", "write_formatted"]);
	await settings.mutate("coding-doc-standard", [
		{ op: "set", path: ["general", "systemPromptAdvisory"], value: true },
	]);
	await waitFor(
		() => systemPrompt.sections.length === 1,
		"advisory restoration",
	);
});

test("retracts every surface when the master switch is switched off", async () => {
	await settings.mutate("coding-doc-standard", [
		{ op: "set", path: ["general", "enabled"], value: false },
	]);
	await waitFor(
		() => systemPrompt.sections.length === 0,
		"advisory retraction",
	);
	assert.deepEqual(commands.names(), []);
	assert.deepEqual(tools.names(), []);
	assert.equal(
		(await preExecute("write", undocumented)).kind,
		"allow",
		"a disabled plugin must never deny a write",
	);
});

test("restores every surface when the master switch comes back on", async () => {
	await settings.mutate("coding-doc-standard", [
		{ op: "set", path: ["general", "enabled"], value: true },
	]);
	await waitFor(
		() => systemPrompt.sections.length === 1,
		"advisory restoration",
	);
	assert.deepEqual(commands.names().sort(), [
		"code-formatter",
		"coding-doc-verify",
	]);
	assert.deepEqual(tools.names().sort(), ["format_code", "write_formatted"]);
	assert.equal((await preExecute("write", undocumented)).kind, "deny");
});

test("a language switch still reaches the live policy through the provider", async () => {
	await settings.mutate("coding-doc-standard", [
		{ op: "set", path: ["languages", "typescriptJavascript"], value: false },
	]);
	await waitFor(
		async () =>
			(await durablePolicy())?.languages?.typescriptJavascript === false,
		"language reaching durable policy",
	);
	assert.equal((await preExecute("write", undocumented)).kind, "allow");
	await settings.mutate("coding-doc-standard", [
		{ op: "set", path: ["languages", "typescriptJavascript"], value: true },
	]);
	await waitFor(
		async () =>
			(await durablePolicy())?.languages?.typescriptJavascript === true,
		"language restoration",
	);
	assert.equal((await preExecute("write", undocumented)).kind, "deny");
});

test("the documentation checker reads the policy the host is enforcing", async () => {
	const run = await import(
		pathToFileURL(join(root, "src", "hook", "run.mjs")).href
	);
	const policy = {
		...(await run.loadPolicy()),
		languages: { ...(await run.loadPolicy()).languages, python: false },
	};
	// A Python candidate with no header must pass only because the policy handed
	// to the checker says the Python profile is off, not because the durable file
	// on disk happens to say so.
	const output = await run.runCheckerOutput(
		{ path: "src/headerless.py", content: "def value():\n    return 1\n" },
		policy,
	);
	assert.equal(output.code, 0, output.lines.join("\n"));
	const durable = await durablePolicy();
	assert.equal(
		durable.languages.python,
		true,
		"the checker must not have rewritten durable policy",
	);
});
