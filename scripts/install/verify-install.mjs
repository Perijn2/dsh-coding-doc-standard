#!/usr/bin/env node
/**
 * @module installation-verifier
 * @author Perijn Huijser
 * Verifies package assets required for bundle-based installation.
 *
 * @remarks
 * Usage:
 *   Core principle: Fail early when an install cannot load its bundle, validator,
 *   or skill assets.
 *   Setup: Run after packaging or before linking into a DSH package root.
 *   Workflow: Load package metadata and assert that each declared runtime asset exists.
 *   API guide: The script exits nonzero with a concise missing-asset error.
 *   Worked example: node scripts/install/verify-install.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const required = [
	manifest.dsh?.bundle?.patch,
	"src/host/index.mjs",
	"client.js",
	"src/hook/run.mjs",
	"scripts/adapters/rust-public-unit-adapter.mjs",
	"scripts/adapters/cpp-public-unit-adapter.mjs",
	"src/policy/defaults.json",
	"src/policy/tools.json",
	"src/policy/platform.mjs",
	"scripts/install/provision-tools.mjs",
	"scripts/verify/verify-dsh-contract.mjs",
	"skill/SKILL.md",
	"languages/python/skill/SKILL.md",
	"languages/python/skill/example.py",
	"languages/typescript-javascript/skill/SKILL.md",
	"languages/typescript-javascript/skill/example.ts",
	"languages/lua/skill/SKILL.md",
	"languages/lua/skill/example.lua",
	"languages/docker-compose/skill/SKILL.md",
	"languages/docker-compose/skill/example.yaml",
];
for (const relative of required) {
	if (typeof relative !== "string" || !existsSync(join(root, relative)))
		throw new Error(`missing package asset: ${relative}`);
}
console.log("coding-doc-standard: bundle assets are complete");
