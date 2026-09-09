#!/usr/bin/env node

/**
 * @module detailed-verifier
 * @author Perijn Huijser
 * Runs project-aware formatter, analysis, and Doxygen documentation checks.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep expensive or project-contextual analysis out of the
 *   write hook while exposing one explicit verification command.
 *   Setup: Provision package tools, configure a project Doxyfile, then pass
 *   source paths or --doxygen <Doxyfile>.
 *   Workflow: Classify paths, invoke check-only language tools, validate required
 *   Doxygen warning policy, then run the pinned Doxygen binary.
 *   API guide: Run without paths for package verification; use --optional only
 *   for non-pinned project tools that are intentionally unavailable.
 *   Worked example: node scripts/verify.mjs --doxygen Doxyfile src/api.cpp
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	platformKey,
	resolveDoxygenBinary,
	supportedDoxygenPlatforms,
} from "../src/policy/platform.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tools = JSON.parse(
	readFileSync(join(root, "src", "policy", "tools.json"), "utf8"),
);
const optional = process.argv.includes("--optional");
const doxygenIndex = process.argv.indexOf("--doxygen");
const doxygenFile = doxygenIndex === -1 ? null : process.argv[doxygenIndex + 1];
const paths = process.argv.slice(2).filter((item, index) => {
	if (item.startsWith("-")) return false;
	return !(doxygenIndex !== -1 && index + 2 === doxygenIndex + 1);
});
const composeNames = new Set([
	"compose.yaml",
	"compose.yml",
	"docker-compose.yaml",
	"docker-compose.yml",
]);
const toolsRoot = join(
	homedir(),
	".dsh",
	"plugins",
	"coding-doc-standard",
	"tools",
);
const doxygenBinary = resolveDoxygenBinary(toolsRoot, tools.doxygen);

/**
 * Runs one external verifier and handles missing tools consistently.
 *
 * @param {string} command - Executable path or command name.
 * @param {string[]} args - Check-only arguments.
 * @param {string} [cwd] - Process working directory.
 * @returns {void} Completion when the command succeeds or is optional and absent.
 * @throws {Error} When a required tool is unavailable or returns nonzero.
 */
function execute(command, args, cwd = root) {
	const result = spawnSync(command, args, {
		cwd,
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (result.error?.code === "ENOENT") {
		if (optional)
			return console.warn(
				`coding-doc-standard: optional tool unavailable: ${command}`,
			);
		throw new Error(
			`required verification tool unavailable: ${command}; rerun with --optional to skip it`,
		);
	}
	if (result.status !== 0)
		throw new Error(`${command} failed with exit ${result.status ?? 1}`);
}

/**
 * Identifies configured Docker Compose filenames.
 *
 * @param {string} path - Candidate filesystem path.
 * @returns {boolean} Whether the path is recognized as Docker Compose.
 */
function isCompose(path) {
	const file = basename(path).toLowerCase();
	return composeNames.has(file) || /^compose\..+\.ya?ml$/.test(file);
}

function verifyDoxygenConfiguration(path) {
	const content = readFileSync(path, "utf8");
	for (const setting of [
		"WARN_IF_UNDOCUMENTED",
		"WARN_IF_DOC_ERROR",
		"WARN_AS_ERROR",
		"EXTRACT_ALL",
	]) {
		if (
			!new RegExp(`^\\s*${setting}\\s*=\\s*YES\\s*(?:#.*)?$`, "mi").test(
				content,
			)
		) {
			throw new Error(
				`Doxyfile must set ${setting} = YES for documentation enforcement`,
			);
		}
	}
}

function verifyDoxygen(path) {
	if (!path) throw new Error("--doxygen requires a Doxyfile path");
	if (!existsSync(path)) throw new Error(`Doxyfile does not exist: ${path}`);
	verifyDoxygenConfiguration(path);
	if (!doxygenBinary) {
		throw new Error(
			`no pinned Doxygen ${tools.doxygen.version} asset for ${platformKey()}; supported: ${supportedDoxygenPlatforms(tools.doxygen).join(", ")}`,
		);
	}
	if (!existsSync(doxygenBinary)) {
		throw new Error(
			`pinned Doxygen ${tools.doxygen.version} is unavailable on ${platformKey()}; run npm run provision-tools`,
		);
	}
	const config = resolve(path);
	execute(doxygenBinary, [config], dirname(config));
}

if (doxygenIndex !== -1) verifyDoxygen(doxygenFile);
if (!paths.length && doxygenIndex === -1) {
	await import("./verify-install.mjs");
} else {
	for (const path of paths) {
		if (!existsSync(path))
			throw new Error(`verification path does not exist: ${path}`);
		if (isCompose(path)) {
			execute("prettier", ["--check", path]);
			execute("yamllint", [path]);
			execute("docker", ["compose", "-f", path, "config", "-q"]);
			continue;
		}
		switch (extname(path).toLowerCase()) {
			case ".py":
				execute("ruff", ["format", "--check", path]);
				execute("ruff", ["check", path]);
				break;
			case ".ts":
			case ".js":
			case ".mjs":
			case ".cjs":
				execute("biome", ["check", path]);
				break;
			case ".rs":
				execute("cargo", ["fmt", "--check"]);
				execute("cargo", ["clippy", "--", "-D", "warnings"]);
				break;
			case ".c":
			case ".h":
			case ".cc":
			case ".cpp":
			case ".hpp":
				execute("clang-format", ["--dry-run", "--Werror", path]);
				execute("clang-tidy", [path]);
				break;
			default:
				console.warn(`coding-doc-standard: no detailed profile for ${path}`);
		}
	}
}
