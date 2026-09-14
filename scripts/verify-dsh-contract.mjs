#!/usr/bin/env node

/**
 * @module dsh-contract-verifier
 * @author Perijn Huijser
 * Verifies package-facing DSH host and browser integration contracts.
 *
 * @remarks
 * Usage:
 *   Core principle: Detect incompatible peer APIs and malformed client bundles
 *   before installation mutates a DSH profile.
 *   Setup: Run npm install so declared DSH peer dependencies resolve locally.
 *   Workflow: Import host peers, assert their required exports, load the client
 *   bundle through a minimal ModuleLoader, and validate its Cordis exports.
 *   API guide: Run this script directly or through npm run verify:dsh.
 *   Worked example: npm run verify:dsh
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = require(join(root, "package.json"));
const requiredPeers = [
	"@deepseek-ai/cordis",
	"@deepseek-ai/dsh-client-runtime",
	"@deepseek-ai/dsh-client-ui-settings",
	"@deepseek-ai/dsh-client-ui-settings-plugins",
	"@deepseek-ai/dsh-commands",
	"@deepseek-ai/dsh-settings",
	"@deepseek-ai/dsh-tools",
	"@deepseek-ai/schemastery",
];

for (const peer of requiredPeers) {
	if (typeof manifest.peerDependencies?.[peer] !== "string") {
		throw new Error(`missing required peer dependency: ${peer}`);
	}
	const installed = require(`${peer}/package.json`).version;
	console.log(
		`coding-doc-standard: ${peer}@${installed} satisfies declared peer contract`,
	);
}

const settings = await import("@deepseek-ai/dsh-settings");
const tools = await import("@deepseek-ai/dsh-tools");
if (
	typeof settings.installSettingsSection !== "function" ||
	typeof settings.settingsNamespace !== "function"
) {
	throw new Error(
		"installed dsh-settings lacks the required section-registration API",
	);
}
if (typeof tools.ToolRuntime !== "function") {
	throw new Error("installed dsh-tools lacks ToolRuntime");
}
await import(pathToFileURL(join(root, "src", "host", "index.mjs")).href);

let clientDefinition;
const originalWindow = globalThis.window;
globalThis.window = {
	__ModuleLoader__: {
		load(definition) {
			clientDefinition = definition;
		},
	},
};
try {
	await import(
		`${pathToFileURL(join(root, "src", "client", "index.js")).href}?contract=${Date.now()}`
	);
	if (clientDefinition?.id !== "coding-doc-standard") {
		throw new Error(
			"client bundle did not register its expected ModuleLoader definition",
		);
	}
	const plugin = clientDefinition.factory((name) => {
		if (name === "react")
			return { createElement() {}, useSyncExternalStore() {} };
		throw new Error(`unexpected client dependency: ${name}`);
	});
	if (
		plugin.name !== "coding-doc-standard" ||
		typeof plugin.apply !== "function"
	) {
		throw new Error("client bundle did not expose a Cordis plugin module");
	}
	console.log(
		"coding-doc-standard: browser client bundle exports a Cordis plugin",
	);
} finally {
	if (originalWindow === undefined) delete globalThis.window;
	else globalThis.window = originalWindow;
}
