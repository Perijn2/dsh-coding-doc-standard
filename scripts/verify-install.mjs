#!/usr/bin/env node
/**
 * @module installation-verifier
 * @author Perijn Huijser
 * Verifies package assets required for bundle-based installation.
 *
 * @remarks
 * Usage:
 *   Core principle: Fail early when an install cannot load its bundle, hook, or
 *   skill assets.
 *   Setup: Run after packaging or before linking into a DSH package root.
 *   Workflow: Load package metadata and assert that each declared runtime asset exists.
 *   API guide: The script exits nonzero with a concise missing-asset error.
 *   Worked example: node scripts/verify-install.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const required = [
	manifest.dsh?.bundle?.patch,
	"src/host/index.mjs",
	"client.js",
	"src/hook/hooks.json",
	"src/hook/run.mjs",
	"src/hook/checker.py",
	"src/policy/defaults.json",
	"src/policy/tools.json",
	"src/policy/platform.mjs",
	"scripts/provision-tools.mjs",
	"scripts/verify-dsh-contract.mjs",
	"skill/SKILL.md",
	"skill/references/docker-compose.md",
];
for (const relative of required) {
	if (typeof relative !== "string" || !existsSync(join(root, relative)))
		throw new Error(`missing package asset: ${relative}`);
}
console.log("coding-doc-standard: bundle assets are complete");
