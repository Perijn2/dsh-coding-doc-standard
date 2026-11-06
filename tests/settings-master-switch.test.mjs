/**
 * @module settings-master-switch-tests
 * @author Perijn Huijser
 * Verifies that the master switch retracts every surface the plugin adds.
 *
 * @remarks
 * Usage:
 *   Core principle: Resolved Config refs are the same objects the Loader
 *     commits into, so committing a new value into a ref and emitting
 *     loader/volatile-update reproduces the exact live path a settings edit
 *     takes; a stub that never merges an edit cannot see a switch change.
 *   Setup: Run with Node's built-in test runner from the package root.
 *   Workflow: Mount the host plugin over resolved config refs, flip switches
 *     the way the Loader does, and assert what is registered on each side.
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
import { createVolatile, updateVolatile } from "@deepseek-ai/cosmokit";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Isolate durable plugin state before the host module resolves homedir().
const home = await mkdtemp(join(tmpdir(), "coding-doc-standard-switch-"));
process.env.USERPROFILE = home;
process.env.HOME = home;

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
 * Records settings presentation policies and answers with disposers.
 *
 * @returns {{presentations: object[], configure: (presentation: object) => () => void}} Settings service stub.
 */
function createSettingsStub() {
	const presentations = [];
	return {
		presentations,
		configure(presentation) {
			presentations.push(presentation);
			return () => {
				const index = presentations.indexOf(presentation);
				if (index !== -1) presentations.splice(index, 1);
			};
		},
	};
}

/**
 * Polls an asynchronous condition until it holds or the deadline passes.
 *
 * @param {() => boolean | Promise<boolean>} condition - Condition producing truthy on success.
 * @param {string} description - What is awaited, used in the timeout error.
 * @param {number} [timeoutMs] - Deadline in milliseconds for the poll.
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
const commands = createCommandsStub();
const tools = createToolsStub();
const systemPrompt = createSystemPromptStub();
const settings = createSettingsStub();
cordis.provide("commands", commands);
cordis.provide("tools", tools);
cordis.provide("systemPrompt", systemPrompt);
cordis.provide("settings", settings);

const preExecutors = [];
cordis.on("internal/listener", (eventName, listener) => {
	if (eventName === "tools/pre-execute") preExecutors.push(listener);
});

const hostModule = await import(
	pathToFileURL(join(root, "src", "host", "index.mjs")).href
);

// Resolve the config the same way the Loader does, then hand the very refs to
// apply, so a flip below commits into the live mount rather than a copy.
const config = hostModule.Config["~standard"].validate({}).value;
await cordis.plugin({
	name: hostModule.name,
	inject: hostModule.inject,
	apply: (ctx) => hostModule.apply(ctx, config),
});

test.after(async () => {
	await cordis.stop?.();
	await rm(home, { recursive: true, force: true });
});

/**
 * Commits one new value into a live Config ref and notifies the mount the way
 * the Loader does after a volatile-only profile change.
 *
 * @param {string} key - Top-level Config field name.
 * @param {unknown} next - The value the settings form would have written.
 * @returns {void} Completion once the mount was notified.
 */
function flip(key, next) {
	updateVolatile(config[key], createVolatile(next));
	cordis.emit("loader/volatile-update", [key]);
}

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

test("suppresses the generated page and registers every surface while the master switch is on", async () => {
	await waitFor(
		() => systemPrompt.sections.length === 1,
		"advisory registration",
	);
	assert.deepEqual(settings.presentations, [{ auto: false }]);
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
	flip("systemPromptAdvisory", false);
	await waitFor(
		() => systemPrompt.sections.length === 0,
		"advisory retraction",
	);
	assert.deepEqual(tools.names().sort(), ["format_code", "write_formatted"]);
	flip("systemPromptAdvisory", true);
	await waitFor(
		() => systemPrompt.sections.length === 1,
		"advisory restoration",
	);
});

test("retracts every surface when the master switch is switched off", async () => {
	flip("enabled", false);
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
	flip("enabled", true);
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

test("a language switch still reaches the live policy through the mount", async () => {
	flip("typescriptJavascript", false);
	await waitFor(
		async () =>
			(await durablePolicy())?.languages?.typescriptJavascript === false,
		"language reaching durable policy",
	);
	assert.equal((await preExecute("write", undocumented)).kind, "allow");
	flip("typescriptJavascript", true);
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
