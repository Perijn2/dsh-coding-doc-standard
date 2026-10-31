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
 *   Setup: Run npm install, then execute node scripts/install/provision-tools.mjs; the
 *   host platform selects the pinned Doxygen asset from the manifest.
 *   Workflow: Verify package-pinned JavaScript formatters, install Ruff from its
 *   pinned wheel, download and checksum-verify the host's Doxygen archive, then
 *   verify each version.
 *   API guide: The exported provisionTools function supports installer orchestration.
 *   Worked example: node scripts/install/provision-tools.mjs --dry-run
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
} from "node:fs";
import { chmod, copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	doxygenInstallRoot,
	platformKey,
	resolveDoxygenAsset,
	resolveDoxygenBinary,
	supportedDoxygenPlatforms,
} from "../../src/policy/platform.mjs";

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
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
const doxygenRoot = doxygenInstallRoot(dataRoot, doxygenVersion);
const doxygenAsset = resolveDoxygenAsset(toolManifest.doxygen);
const doxygenBinary = resolveDoxygenBinary(dataRoot, toolManifest.doxygen);

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

/**
 * Downloads one archive while verifying its SHA-256 digest.
 *
 * @param {string} url - Remote archive location.
 * @param {string} expectedSha256 - Pinned lowercase hex digest.
 * @param {string} destination - Local staging file to write.
 * @returns {Promise<void>} Completion once the digest matches.
 * @throws {Error} When the download fails or the digest mismatches.
 */
async function downloadVerifiedArchive(url, expectedSha256, destination) {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`could not download ${url}: HTTP ${response.status}`);
	const hash = createHash("sha256");
	const stream = createWriteStream(destination);
	const settled = once(stream, "error");
	try {
		for await (const chunk of response.body) {
			hash.update(chunk);
			if (!stream.write(chunk)) await once(stream, "drain");
		}
	} finally {
		stream.end();
		await Promise.race([settled, once(stream, "close")]);
	}
	const actual = hash.digest("hex");
	if (actual !== expectedSha256) {
		throw new Error(
			`archive checksum mismatch for ${basename(url)}: expected ${expectedSha256}, received ${actual}`,
		);
	}
}

/**
 * Extracts one archive with the platform-native archiver.
 *
 * @param {string} archivePath - Local archive file.
 * @param {string} destination - Existing extraction directory.
 * @returns {void} Completion after extraction.
 * @throws {Error} When the archive format is unsupported on this host.
 */
function extractArchive(archivePath, destination) {
	if (archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
		execFileSync("tar", ["-xzf", archivePath, "-C", destination], {
			stdio: "inherit",
		});
		return;
	}
	if (process.platform === "win32") {
		execFileSync(
			"powershell",
			[
				"-NoProfile",
				"-Command",
				`Expand-Archive -Path '${archivePath}' -DestinationPath '${destination}' -Force`,
			],
			{ stdio: "inherit" },
		);
		return;
	}
	execFileSync("tar", ["-xf", archivePath, "-C", destination], {
		stdio: "inherit",
	});
}

async function provisionDoxygen() {
	if (!doxygenAsset || !doxygenBinary) {
		console.warn(
			`coding-doc-standard: no pinned Doxygen ${doxygenVersion} asset for ${platformKey()}; supported: ${supportedDoxygenPlatforms(toolManifest.doxygen).join(", ")}`,
		);
		return;
	}
	if (!existsSync(doxygenBinary)) {
		const staging = await mkdtemp(
			join(tmpdir(), "coding-doc-standard-doxygen-"),
		);
		try {
			const archivePath = join(staging, basename(doxygenAsset.url));
			await downloadVerifiedArchive(
				doxygenAsset.url,
				doxygenAsset.sha256,
				archivePath,
			);
			const extracted = join(staging, "extracted");
			await mkdir(extracted, { recursive: true });
			extractArchive(archivePath, extracted);
			const source = join(extracted, ...doxygenAsset.archivePath.split("/"));
			if (!existsSync(source)) {
				throw new Error(
					`expected ${doxygenAsset.archivePath} inside ${basename(doxygenAsset.url)}`,
				);
			}
			await mkdir(doxygenRoot, { recursive: true });
			await copyFile(source, doxygenBinary);
			if (process.platform !== "win32") await chmod(doxygenBinary, 0o755);
		} finally {
			await rm(staging, { recursive: true, force: true });
		}
	}
	const version = execFileSync(doxygenBinary, ["--version"], {
		encoding: "utf8",
	}).trim();
	if (!version.startsWith(`${doxygenVersion} `))
		throw new Error(`expected Doxygen ${doxygenVersion}; received ${version}`);
	console.log(
		`coding-doc-standard: Doxygen ${doxygenVersion} is ready for ${platformKey()}`,
	);
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
