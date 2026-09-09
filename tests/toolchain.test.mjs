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
	assert.match(tools.doxygen.asset.sha256, /^[a-f0-9]{64}$/);
	assert.equal(policy.formatters.python, "ruff@0.16.6");
	assert.equal(policy.formatters.typescriptJavascript, "@biomejs/biome@2.5.12");
	assert.equal(policy.formatters.dockerCompose, "prettier@3.9.6");
});

test("enables only provisionable fast formatters on write by default", () => {
	assert.equal(policy.formatOnWrite, true);
	assert.equal(policy.formatPython, true);
	assert.equal(policy.formatTypescriptJavascript, true);
	assert.equal(policy.formatDockerCompose, true);
	assert.equal(policy.blockOnMissingFormatter, true);
	assert.equal(policy.formatters.rust, undefined);
	assert.equal(policy.formatters.cCpp, undefined);
});

test("renders formatter controls in the settings card", () => {
	for (const field of [
		"formatOnWrite",
		"formatPython",
		"formatTypescriptJavascript",
		"formatDockerCompose",
		"blockOnMissingFormatter",
	]) {
		assert.ok(client.includes(field), `missing settings control: ${field}`);
	}
	assert.ok(client.includes("Pre-write formatter enforcement"));
});
