/**
 * @module toolchain-tests
 * @author Perijn Huijser
 * Verifies the formatter pin inventory and settings-card controls.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep declared package versions, policy metadata, and visible
 *   controls synchronized so pre-write enforcement remains reproducible.
 *   Setup: Run with Node's built-in test runner after npm install.
 *   Workflow: Load package and policy JSON, then inspect the browser module text
 *   for the controls that map to persisted policy keys.
 *   API guide: Each assertion captures an externally visible toolchain contract.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	resolveDoxygenAsset,
	resolveDoxygenBinary,
	supportedDoxygenPlatforms,
} from "../src/policy/platform.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
	readFileSync(join(root, "package.json"), "utf8"),
);
const policy = JSON.parse(
	readFileSync(join(root, "src", "policy", "defaults.json"), "utf8"),
);
const tools = JSON.parse(
	readFileSync(join(root, "src", "policy", "tools.json"), "utf8"),
);
const client = readFileSync(join(root, "src", "client", "index.js"), "utf8");

test("pins pre-write formatter versions in package and policy metadata", () => {
	assert.equal(packageJson.dependencies["@biomejs/biome"], "2.5.12");
	assert.equal(packageJson.dependencies.prettier, "3.9.6");
	assert.equal(tools.ruff.version, "0.16.6");
	assert.equal(tools.doxygen.version, "1.18.0");
	assert.equal(policy.formatters.python, "ruff@0.16.6");
	assert.equal(policy.formatters.typescriptJavascript, "@biomejs/biome@2.5.12");
	assert.equal(policy.formatters.dockerCompose, "prettier@3.9.6");
});

test("pins a checksum-verified Doxygen asset for every supported platform", () => {
	assert.deepEqual(supportedDoxygenPlatforms(tools.doxygen), [
		"darwin-arm64",
		"darwin-x64",
		"linux-x64",
		"win32-x64",
	]);
	for (const [key, asset] of Object.entries(tools.doxygen.assets)) {
		assert.match(asset.sha256, /^[a-f0-9]{64}$/, `${key}: sha256`);
		assert.match(
			asset.url,
			/^https:\/\/github\.com\/doxygen\/doxygen\/releases\/download\/Release_1_18_0\/[\w.+~-]+$/,
			`${key}: url`,
		);
		assert.ok(asset.archivePath?.length > 0, `${key}: archivePath`);
		assert.equal(
			asset.executable,
			key.startsWith("win32") ? "doxygen.exe" : "doxygen",
			`${key}: executable`,
		);
	}
});

test("resolves the managed Doxygen binary per host and fails closed otherwise", () => {
	const dataRoot = join("/", "dsh", "tools");
	assert.equal(
		resolveDoxygenBinary(dataRoot, tools.doxygen, "linux", "x64"),
		join(dataRoot, "doxygen-1.18.0", "doxygen"),
	);
	assert.equal(
		resolveDoxygenBinary(dataRoot, tools.doxygen, "darwin", "arm64"),
		join(dataRoot, "doxygen-1.18.0", "doxygen"),
	);
	assert.equal(
		resolveDoxygenBinary(dataRoot, tools.doxygen, "win32", "x64"),
		join(dataRoot, "doxygen-1.18.0", "doxygen.exe"),
	);
	assert.equal(
		resolveDoxygenAsset(tools.doxygen, "freebsd", "x64"),
		null,
		"unsupported hosts must resolve to no asset",
	);
	assert.equal(
		resolveDoxygenBinary(dataRoot, tools.doxygen, "linux", "arm64"),
		null,
		"no official linux arm64 binary is published",
	);
});

test("enables only provisionable fast formatters on write by default", () => {
	assert.equal(policy.formatOnWrite, true);
	assert.equal(policy.formatPython, true);
	assert.equal(policy.formatTypescriptJavascript, true);
	assert.equal(policy.formatRust, false);
	assert.equal(policy.formatDockerCompose, true);
	assert.equal(policy.blockOnMissingFormatter, true);
	assert.equal(policy.formatters.rust, undefined);
	assert.equal(policy.formatters.cCpp, undefined);
	for (const language of [
		"go",
		"csharp",
		"java",
		"kotlin",
		"shell",
		"php",
		"ruby",
		"swift",
		"dart",
		"haskell",
		"lua",
		"scala",
	]) {
		assert.equal(policy.languages[language], false, `${language}: disabled`);
		assert.equal(
			policy[`format${language[0].toUpperCase()}${language.slice(1)}`],
			undefined,
			`${language}: no formatter toggle`,
		);
		assert.equal(
			policy.formatters[language],
			undefined,
			`${language}: no formatter metadata`,
		);
	}
});

test("registers formatter controls in the dedicated settings navigation item", () => {
	for (const field of [
		"formatOnWrite",
		"formatPython",
		"formatTypescriptJavascript",
		"formatRust",
		"formatDockerCompose",
		"blockOnMissingFormatter",
	]) {
		assert.ok(client.includes(field), `missing settings control: ${field}`);
	}
	assert.ok(client.includes("Pre-write formatter enforcement"));
	assert.ok(client.includes("Documentation policy"));
	assert.ok(client.includes("Fast formatters"));
	assert.ok(client.includes("cds-settings-overview"));
	assert.ok(client.includes("cds-settings-group"));
	assert.ok(client.includes('ctx.slots.inject("settings.section"'));
	assert.ok(client.includes('name: "settings.section"'));
	assert.ok(client.includes("id: NS"));
	assert.ok(client.includes("(listener) => scope.subscribe(listener)"));
	assert.ok(client.includes("() => scope.getSnapshot()"));
});
