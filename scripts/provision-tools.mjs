#!/usr/bin/env node

/**
 * @module tool-provisioner
 * @author Perijn Huijser
 * Provisions pinned formatter and Doxygen executables in DSH-owned data.
 *
 * @remarks
 * Usage:
 *   Core principle: Verify exact third-party versions and archive checksums before
 *   a hook or detailed verifier uses them.
 *   Setup: Run npm install, then execute node scripts/provision-tools.mjs on a
 *   supported platform.
 *   Workflow: Verify package-pinned JavaScript formatters, install Ruff from its
 *   pinned wheel, download and checksum-verify Doxygen, then verify each version.
 *   API guide: The exported provisionTools function supports installer orchestration.
 *   Worked example: node scripts/provision-tools.mjs --dry-run
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = join(
	homedir(),
	".dsh",
	"plugins",
	"coding-doc-standard",
	"tools",
);
const toolManifest = JSON.parse(
	readFileSync(join(packageRoot, "src", "policy", "tools.json"), "utf8"),
);
const ruffVersion = toolManifest.ruff.version;
const ruffRoot = join(dataRoot, `ruff-${ruffVersion}`);
const ruffBinary = join(
	ruffRoot,
	"bin",
	process.platform === "win32" ? "ruff.exe" : "ruff",
);
const doxygenVersion = toolManifest.doxygen.version;
const doxygenRoot = join(dataRoot, `doxygen-${doxygenVersion}`);
const doxygenBinary = join(doxygenRoot, toolManifest.doxygen.asset.executable);

function packageVersion(name) {
	const path = join(
		packageRoot,
		"node_modules",
		...name.split("/"),
		"package.json",
	);
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, "utf8")).version;
}

function verifyPackageTools() {
	for (const [name, version] of [
		[toolManifest.biome.package, toolManifest.biome.version],
		[toolManifest.prettier.package, toolManifest.prettier.version],
	]) {
		const actual = packageVersion(name);
		if (actual !== version)
			throw new Error(`${name}@${version} is required; run npm install`);
		console.log(`coding-doc-standard: ${name}@${actual} is ready`);
	}
}

function provisionRuff() {
	if (!existsSync(ruffBinary)) {
		mkdirSync(ruffRoot, { recursive: true });
		const python = process.platform === "win32" ? "py" : "python3";
		const args =
			process.platform === "win32"
				? [
						"-3",
						"-m",
						"pip",
						"install",
						"--upgrade",
						"--target",
						ruffRoot,
						`ruff==${ruffVersion}`,
					]
				: [
						"-m",
						"pip",
						"install",
						"--upgrade",
						"--target",
						ruffRoot,
						`ruff==${ruffVersion}`,
					];
		execFileSync(python, args, { stdio: "inherit" });
	}
	const version = execFileSync(ruffBinary, ["--version"], { encoding: "utf8" });
	if (!version.includes(ruffVersion))
		throw new Error(`expected Ruff ${ruffVersion}; received ${version.trim()}`);
	console.log(`coding-doc-standard: Ruff ${ruffVersion} is ready`);
}

async function provisionDoxygen() {
	if (process.platform !== "win32" || process.arch !== "x64") {
		throw new Error(
			`native Doxygen ${doxygenVersion} provisioning currently supports Windows x64 only`,
		);
	}
	if (!existsSync(doxygenBinary)) {
		const response = await fetch(toolManifest.doxygen.asset.url);
		if (!response.ok)
			throw new Error(`could not download Doxygen: HTTP ${response.status}`);
		const archive = Buffer.from(await response.arrayBuffer());
		const actual = createHash("sha256").update(archive).digest("hex");
		if (actual !== toolManifest.doxygen.asset.sha256) {
			throw new Error(
				`Doxygen archive checksum mismatch: expected ${toolManifest.doxygen.asset.sha256}, received ${actual}`,
			);
		}
		await mkdir(doxygenRoot, { recursive: true });
		const archivePath = join(doxygenRoot, "doxygen.zip");
		try {
			await writeFile(archivePath, archive);
			execFileSync(
				"powershell",
				[
					"-NoProfile",
					"-Command",
					`Expand-Archive -Path '${archivePath}' -DestinationPath '${doxygenRoot}' -Force`,
				],
				{ stdio: "inherit" },
			);
		} finally {
			await rm(archivePath, { force: true });
		}
	}
	const version = execFileSync(doxygenBinary, ["--version"], {
		encoding: "utf8",
	}).trim();
	if (!version.startsWith(`${doxygenVersion} `))
		throw new Error(`expected Doxygen ${doxygenVersion}; received ${version}`);
	console.log(`coding-doc-standard: Doxygen ${doxygenVersion} is ready`);
}

/**
 * Provisions all package-supported formatter and documentation tools.
 *
 * @param {{dryRun?: boolean}} [options] - Provisioning options.
 * @returns {Promise<void>} Completion when all pinned tools are ready.
 * @throws {Error} When a required version, checksum, or supported platform check fails.
 */
export async function provisionTools({ dryRun = false } = {}) {
	verifyPackageTools();
	if (dryRun) {
		console.log(
			`coding-doc-standard: would provision Ruff ${ruffVersion} at ${ruffRoot}`,
		);
		console.log(
			`coding-doc-standard: would provision Doxygen ${doxygenVersion} at ${doxygenRoot}`,
		);
		return;
	}
	provisionRuff();
	await provisionDoxygen();
}

if (
	process.argv[1] &&
	resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
	await provisionTools({ dryRun: process.argv.includes("--dry-run") });
}
