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

const POLICY_KEYS = ["general", "languages", "formatting", "adapters"];

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
	"/**",
	" * Exposes the documented integration answer.",
	" */",
	"export const ANSWER = 42;",
	"",
].join("\n");

const UNDOCUMENTED_TS = "export const undocumented = compute();\n";

const COMPLIANT_PY = `"""Author: Perijn Huijser
Summary: Demonstrates a documented Python module.

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
			// The real provider deep-merges the patch into the user section and
			// resolves every unlisted field from the base layer, so emulate that
			// instead of letting a nested patch drop its sibling fields.
			doc = structuredClone(doc);
			for (const [key, value] of Object.entries(patch)) {
				doc[key] =
					value && typeof value === "object" && !Array.isArray(value)
						? { ...doc[key], ...value }
						: value;
			}
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
 * Captures agent-tool registrations.
 *
 * Deliberately has no `guard` method, so a regression back to the synchronous
 * global tool guard fails loudly instead of being silently accepted.
 *
 * @returns {{registrations: object[], calls: object[], onExecute: ((input: object) => void | Promise<void>) | null, register: (definition: object) => () => void, get: (name: string) => object, execute: (input: object) => Promise<{isError: boolean, content: object[]}>}} Tool registry stub that also records the inner dispatches the plugin makes.
 */
function createToolsStub() {
	const registrations = [];
	const calls = [];
	const stub = {
		registrations,
		calls,
		onExecute: null,
		register(definition) {
			registrations.push(definition);
			return () => registrations.splice(registrations.indexOf(definition), 1);
		},
		get(name) {
			return registrations.find((entry) => entry.name === name) ?? { name };
		},
		async execute(input) {
			calls.push(input);
			await stub.onExecute?.(input);
			return { isError: false, content: [{ type: "text", text: "written" }] };
		},
	};
	return stub;
}

/**
 * Records the system-prompt sections registered by the host plugin.
 *
 * @returns {{sections: object[], section: (section: object) => () => void}} Prompt registry stub.
 */
function createSystemPromptStub() {
	const sections = [];
	return {
		sections,
		section(section) {
			if (sections.some((entry) => entry.name === section.name))
				throw new Error(`duplicate prompt section: ${section.name}`);
			sections.push(section);
			return () => {
				const index = sections.indexOf(section);
				if (index !== -1) sections.splice(index, 1);
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
const systemPrompt = createSystemPromptStub();
const hookAgent = {
	id: "agent-integration",
	session: { header: { id: "session-integration", cwd: root } },
};
cordis.provide("settings", settings);
cordis.provide("commands", commands);
cordis.provide("tools", tools);
cordis.provide("systemPrompt", systemPrompt);

// Captured before the plugin loads so the asynchronous policy listener is
// driven exactly the way the tool pipeline drives it.
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
		"[paths\u2026] [--optional] [--doxygen Doxyfile]",
	);
	assert.equal(typeof command.handler, "function");
});

test("registers the managed formatter command", async () => {
	const command = await waitFor(
		async () =>
			commands.registrations.find(({ name }) => name === "code-formatter") ??
			null,
		"formatter command registration",
	);
	assert.match(command.description, /managed formatter/i);
	assert.match(command.input.hint, /--python/);
	assert.equal(typeof command.handler, "function");
});
test("registers and executes the format_code agent tool", async () => {
	const definition = await waitFor(
		async () =>
			tools.registrations.find((entry) => entry.name === "format_code"),
		"format_code registration",
	);
	const dispatchedBefore = tools.calls.length;
	const result = await definition.execute(
		{
			language: "typescript",
			file_path: "pending.ts",
			content: "export const value=1\n",
		},
		{ agent: hookAgent, signal: new AbortController().signal },
	);
	assert.equal(result.changed, true);
	assert.equal(result.formatter, "biome");
	// Biome writes the platform end of line, so pin the content, not the EOL.
	assert.match(result.formatted_content, /^export const value = 1;\r?\n$/u);
	const rendered = definition.output.render({}, result);
	assert.equal(rendered.length, 1);
	assert.equal(rendered[0].type, "text");
	assert.match(rendered[0].text, /^Formatted pending\.ts via biome/u);
	assert.match(rendered[0].text, /Not written: this was a preview\./u);
	assert.match(rendered[0].text, /Documentation check: [a-z]+\./u);
	assert.match(
		rendered[0].text,
		/call write_formatted to write it once the checks pass/u,
	);
	assert.equal(
		tools.calls.length,
		dispatchedBefore,
		"format_code must never write",
	);
	assert.deepEqual(Array.from(definition.parameters.required).sort(), [
		"content",
		"file_path",
		"language",
	]);
	assert.equal(definition.parameters.properties.apply, undefined);
	assert.deepEqual(definition.parameters.properties.language.enum, [
		"python",
		"typescript",
		"javascript",
		"docker-compose",
	]);
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
		formatting: { formatOnWrite: false, formatPython: false },
		languages: {
			go: true,
			shell: true,
			php: true,
			ruby: true,
			swift: true,
			dart: true,
			haskell: true,
			lua: true,
			scala: true,
		},
		adapters: {
			scala: {
				command: "scala-doc-adapter",
				args: '["--project","."]',
				cwd: "project",
				timeoutMs: 12_000,
			},
		},
	});
	const updated = await waitFor(async () => {
		const policy = await readDurablePolicy();
		if (policy?.formatOnWrite !== false) return null;
		if (!policy?.publicUnitDocs?.scala) return null;
		if (policy?.publicUnitAdapters?.scala?.command !== "scala-doc-adapter")
			return null;
		if (
			!policy.languages?.go ||
			!policy.languages?.shell ||
			!policy.languages?.php ||
			!policy.languages?.ruby ||
			!policy.languages?.swift ||
			!policy.languages?.dart ||
			!policy.languages?.haskell ||
			!policy.languages?.lua ||
			!policy.languages?.scala
		)
			return null;
		return policy;
	}, "durable policy update");
	assert.equal(updated.formatPython, false);
	assert.equal(updated.languages.go, true);
	assert.equal(updated.languages.shell, true);
	assert.equal(updated.languages.php, true);
	assert.equal(updated.languages.ruby, true);
	assert.equal(updated.languages.swift, true);
	assert.equal(updated.languages.dart, true);
	assert.equal(updated.languages.haskell, true);
	assert.equal(updated.languages.lua, true);
	assert.equal(updated.languages.scala, true);
	assert.equal(updated.publicUnitDocs.typescriptJavascript, true);
	assert.equal(updated.enabled, true);
});

/**
 * Applies a settings patch and waits until the durable policy reflects it.
 *
 * @param {Record<string, unknown>} patch - Settings fields to change.
 * @param {(policy: Record<string, any>) => boolean} settled - Predicate over the persisted policy.
 * @returns {Promise<Record<string, any>>} The settled policy.
 */
async function applySettings(patch, settled) {
	settings.change(patch);
	return waitFor(
		async () => {
			const policy = await readDurablePolicy();
			return policy && settled(policy) ? policy : null;
		},
		`policy after ${Object.keys(patch).join(", ")}`,
	);
}

/**
 * Drives one pending tool call through the registered pre-execute policy.
 *
 * @param {object} agent - Agent associated with the execution.
 * @param {string} toolName - Tool name to evaluate.
 * @param {Record<string, unknown>} toolInput - Tool input for the candidate validator.
 * @param {Record<string, unknown>} [extra] - Extra execution fields, such as a deferContext spy.
 * @returns {Promise<{kind: string, reason?: string}>} The pre-execute decision.
 */
async function preExecute(agent, toolName, toolInput, extra = {}) {
	const execution = {
		callId: `call-${toolName}`,
		name: toolName,
		arguments: toolInput,
		agent,
		signal: new AbortController().signal,
		...extra,
	};
	let decision = { kind: "allow" };
	for (const listener of preExecutors) {
		decision = (await listener(execution, async () => ({ kind: "allow" }))) ?? {
			kind: "allow",
		};
		if (decision.kind !== "allow") return decision;
	}
	return decision;
}

test("registers one asynchronous pre-execute policy and no sync guard", () => {
	assert.equal(preExecutors.length, 1);
});

test("skips the gate for the write that write_formatted dispatches itself", async () => {
	const messy = {
		file_path: "src/messy.ts",
		content: "export    const undocumented  =  compute( 1 ,2 )\n",
	};
	try {
		await applySettings(
			{ formatting: { formatOnWrite: true, formatTypescriptJavascript: true } },
			(policy) =>
				policy.formatOnWrite === true &&
				policy.formatTypescriptJavascript === true &&
				policy.publicUnitDocs?.typescriptJavascript === true,
		);
		const definition = await waitFor(
			async () =>
				tools.registrations.find((entry) => entry.name === "write_formatted") ??
				null,
			"write_formatted registration",
		);
		let stampedParent = null;
		let nested = null;
		let loose = null;
		tools.onExecute = async (input) => {
			stampedParent = input.parent;
			nested = await preExecute(hookAgent, "write", messy, {
				parent: input.parent,
			});
			loose = await preExecute(hookAgent, "write", messy);
		};
		const receipt = await definition.execute(
			{
				file_path: "src/self-dispatch.ts",
				content: COMPLIANT_TS,
				language: "typescript",
			},
			{
				callId: "call-write-formatted",
				token: "tok-self-dispatch",
				agent: hookAgent,
				signal: new AbortController().signal,
			},
		);
		assert.equal(receipt.applied, true, JSON.stringify(receipt));
		assert.equal(tools.calls.length, 1);
		assert.equal(stampedParent, "tok-self-dispatch");
		assert.equal(nested.kind, "allow", JSON.stringify(nested));
		assert.equal(loose.kind, "deny", JSON.stringify(loose));
		assert.equal(tools.calls.length, 1, "a skipped check must not dispatch");
	} finally {
		tools.onExecute = null;
		await applySettings(
			{ formatting: { formatOnWrite: false } },
			(policy) => policy.formatOnWrite === false,
		);
	}
});

test("advises the model through the system prompt by default", async () => {
	const section = await waitFor(
		async () =>
			systemPrompt.sections.find(({ name }) =>
				name.endsWith("coding-doc-standard"),
			) ?? null,
		"system-prompt advisory",
	);
	assert.match(section.text, /skill coding-doc-standard/u);
	assert.match(section.text, /format_code/u);
	assert.ok(section.order > 0);
});

test("toggles the system-prompt advisory with its setting", async () => {
	await applySettings(
		{ general: { systemPromptAdvisory: false } },
		(policy) => policy.systemPromptAdvisory === false,
	);
	await waitFor(
		async () => (systemPrompt.sections.length === 0 ? true : null),
		"advisory removal",
	);
	await applySettings(
		{ general: { systemPromptAdvisory: true } },
		(policy) => policy.systemPromptAdvisory === true,
	);
	await waitFor(
		async () => (systemPrompt.sections.length === 1 ? true : null),
		"advisory restore",
	);
});

test("aggregates every pass into one denial", async () => {
	try {
		await applySettings(
			{ formatting: { formatOnWrite: true, formatTypescriptJavascript: true } },
			(policy) =>
				policy.formatOnWrite === true &&
				policy.formatTypescriptJavascript === true &&
				policy.publicUnitDocs?.typescriptJavascript === true,
		);
		const result = await preExecute(hookAgent, "write", {
			file_path: "src/messy.ts",
			content: "export    const undocumented  =  compute( 1 ,2 )\n",
		});
		assert.equal(result.kind, "deny");
		const reason = String(result.reason);
		assert.match(reason, /\[doc-standard\]/u);
		assert.match(reason, /issue\(s\) block writing src\/messy\.ts/u);
		assert.match(reason, /\[public units\]/u);
		assert.match(reason, /\[documentation\]/u);
		assert.match(reason, /\[formatting\]/u);
		assert.match(reason, /Formatting: call write_formatted/u);
		assert.match(reason, /references\/typescript-javascript\.md/u);
		assert.match(reason, /\/coding-doc-verify/u);
	} finally {
		await applySettings(
			{ formatting: { formatOnWrite: false } },
			(policy) => policy.formatOnWrite === false,
		);
	}
});

test("blocks an undocumented namespaced TypeScript write", async () => {
	const result = await preExecute(hookAgent, "functions.write", {
		file_path: "src/undocumented.ts",
		content: UNDOCUMENTED_TS,
	});
	assert.equal(result.kind, "deny");
	assert.match(String(result.reason), /doc-standard/u);
});

test("allows a documented and formatted namespaced TypeScript write", async () => {
	const result = await preExecute(hookAgent, "write", {
		file_path: "src/integration-example.ts",
		content: COMPLIANT_TS,
	});
	assert.equal(result.kind, "allow");
});

test("never blocks vendored, generated, or minified paths", async () => {
	for (const path of [
		"node_modules/pkg/bad.ts",
		"dist/bad.js",
		"coverage/app.ts",
		"src/generated/api.py",
		"assets/app.min.js",
		"src/types/manual.d.ts",
		"package-lock.json",
	]) {
		const result = await preExecute(hookAgent, "write", {
			file_path: path,
			content: UNDOCUMENTED_TS,
		});
		assert.equal(result.kind, "allow", path);
	}
});

test("allows a candidate that cannot be materialized", async () => {
	const result = await preExecute(hookAgent, "edit", {
		file_path: "src/never-created.ts",
		old_string: "e",
		new_string: "x",
	});
	assert.equal(result.kind, "allow");
	assert.doesNotMatch(String(result.reason ?? ""), /doc-standard/u);
});

test("fails open with a visible notice when the budget is exhausted", async () => {
	const notices = [];
	try {
		// The Python checker spawns an interpreter, so a 1 ms budget cannot
		// outlive it. The candidate itself is compliant, which keeps the only
		// signal in the report the unfinished check.
		await applySettings(
			{
				general: { validatorTimeoutMs: 1 },
				languages: { python: true },
			},
			(policy) =>
				policy.validatorTimeoutMs === 1 && policy.languages?.python === true,
		);
		const result = await preExecute(
			hookAgent,
			"write",
			{ file_path: "src/slow_but_compliant.py", content: COMPLIANT_PY },
			{ deferContext: (message) => notices.push(message) },
		);
		assert.equal(result.kind, "allow", JSON.stringify(result));
		assert.equal(notices.length, 1);
		const notice = notices[0];
		assert.equal(notice.role, "user");
		assert.equal(notice.source.kind, "plugin");
		assert.equal(notice.source.plugin, "coding-doc-standard");
		assert.equal(notice.source.form, "notice");
		assert.ok(notice.source.summary.length <= 120);
		assert.match(notice.content[0].text, /doc-standard/u);
	} finally {
		await applySettings(
			{ general: { validatorTimeoutMs: 20_000 } },
			(policy) => policy.validatorTimeoutMs === 20_000,
		);
	}
});

test("fails closed when validatorFailOpen is off", async () => {
	try {
		await applySettings(
			{
				general: { validatorTimeoutMs: 1, validatorFailOpen: false },
				languages: { python: true },
			},
			(policy) =>
				policy.validatorFailOpen === false &&
				policy.validatorTimeoutMs === 1 &&
				policy.languages?.python === true,
		);
		const result = await preExecute(hookAgent, "write", {
			file_path: "src/slow_but_compliant.py",
			content: COMPLIANT_PY,
		});
		assert.equal(result.kind, "deny", JSON.stringify(result));
		assert.match(String(result.reason), /validatorFailOpen/u);
	} finally {
		await applySettings(
			{ general: { validatorTimeoutMs: 20_000, validatorFailOpen: true } },
			(policy) =>
				policy.validatorFailOpen === true &&
				policy.validatorTimeoutMs === 20_000,
		);
	}
});

test("honors a custom matchedTools list", async () => {
	try {
		await applySettings(
			{ general: { matchedTools: "functions.write" } },
			(policy) => policy.matchedTools?.[0] === "functions.write",
		);
		const untouched = await preExecute(hookAgent, "write", {
			file_path: "src/undocumented.ts",
			content: UNDOCUMENTED_TS,
		});
		assert.equal(untouched.kind, "allow");
		const guarded = await preExecute(hookAgent, "functions.write", {
			file_path: "src/undocumented.ts",
			content: UNDOCUMENTED_TS,
		});
		assert.equal(guarded.kind, "deny");
	} finally {
		await applySettings(
			{
				general: {
					matchedTools: "write, edit, functions.write, functions.edit",
				},
			},
			(policy) => (policy.matchedTools?.length ?? 0) === 4,
		);
	}
});

test("adds custom ignored paths on top of the built-in list", async () => {
	try {
		await applySettings(
			{ general: { ignoredPaths: "src/scratch/**" } },
			(policy) => policy.ignoredPaths?.[0] === "src/scratch/**",
		);
		const scratch = await preExecute(hookAgent, "write", {
			file_path: "src/scratch/whatever.ts",
			content: UNDOCUMENTED_TS,
		});
		assert.equal(scratch.kind, "allow");
		const vendored = await preExecute(hookAgent, "write", {
			file_path: "node_modules/pkg/bad.ts",
			content: UNDOCUMENTED_TS,
		});
		assert.equal(vendored.kind, "allow");
		await applySettings(
			{ general: { ignoredPaths: "" } },
			(policy) => (policy.ignoredPaths ?? ["x"]).length === 0,
		);
		const back = await preExecute(hookAgent, "write", {
			file_path: "src/scratch/whatever.ts",
			content: UNDOCUMENTED_TS,
		});
		assert.equal(back.kind, "deny");
	} finally {
		await applySettings(
			{ general: { ignoredPaths: "" } },
			(policy) => (policy.ignoredPaths ?? ["x"]).length === 0,
		);
	}
});

test("enforces the opt-in Go header through the pre-execute policy", async () => {
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

test("enforces the opt-in PHP header through the pre-execute policy", async () => {
	const missing = await preExecute(hookAgent, "functions.write", {
		file_path: "src/Example.php",
		content: "<?php\nfinal class Example {}\n",
	});
	assert.equal(missing.kind, "deny");
	const documented = await preExecute(hookAgent, "functions.write", {
		file_path: "src/Example.php",
		content: `<?php
/**
 * @author Perijn Huijser
 * Usage: Demonstrates an opt-in PHP source header.
 */

/** Documents the Example class. */
final class Example {}
`,
	});
	assert.equal(documented.kind, "allow");
});

test("enforces the opt-in Haskell header through the pre-execute policy", async () => {
	const missing = await preExecute(hookAgent, "functions.write", {
		file_path: "src/Example.hs",
		content: "module Example where\n",
	});
	assert.equal(missing.kind, "deny");
	const documented = await preExecute(hookAgent, "functions.write", {
		file_path: "src/Example.hs",
		content: `{-# LANGUAGE OverloadedStrings #-}

-- | Author: Perijn Huijser
-- Summary: Demonstrates an opt-in Haskell module header.
-- Usage: Import the module from a supported caller.
module Example where
`,
	});
	assert.equal(documented.kind, "allow");
});

test("applies the policy to every agent identity", async () => {
	const secondAgent = {
		id: "agent-integration-second",
		session: { header: { id: "session-integration-second", cwd: root } },
	};
	const result = await preExecute(secondAgent, "write", {
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

test("keeps the host free of synchronous child processes", async () => {
	const source = await readFile(join(root, "src", "host", "index.mjs"), "utf8");
	assert.doesNotMatch(source, /spawnSync/u);
	assert.doesNotMatch(source, /tools\.guard\(/u);
});
