/**
 * @module doxygen-platform
 * @author Perijn Huijser
 * Resolves the pinned Doxygen asset for the host platform.
 *
 * @remarks
 * Usage:
 *   Core principle: One manifest lookup maps a host platform to its pinned archive,
 *   so provisioning and verification can never disagree about the installed binary.
 *   Setup: Import from the provisioner, the verifier, and the tests; the manifest
 *   lives in src/policy/tools.json.
 *   Workflow: Compose the platform key, look up the pinned asset, and derive the
 *   managed executable path from its declared name.
 *   API guide: resolveDoxygenAsset returns null for an unsupported host, so callers
 *   warn or fail closed instead of guessing a binary that does not exist.
 *   Worked example: resolveDoxygenAsset(tools.doxygen, "linux", "x64")
 */

import { join } from "node:path";

/**
 * Builds the manifest key for one host platform and CPU architecture.
 *
 * @param {string} [platform] - Node process platform identifier.
 * @param {string} [arch] - Node process architecture identifier.
 * @returns {string} Key of the form "<platform>-<arch>".
 */
export function platformKey(platform = process.platform, arch = process.arch) {
	return `${platform}-${arch}`;
}

/**
 * Resolves the pinned Doxygen asset for one host.
 *
 * @param {{version: string, assets?: Record<string, {url: string, sha256: string, archivePath: string, executable: string}>}} manifest -
 *   The `doxygen` entry of the tool manifest.
 * @param {string} [platform] - Node process platform identifier.
 * @param {string} [arch] - Node process architecture identifier.
 * @returns {{url: string, sha256: string, archivePath: string, executable: string} | null}
 *   The pinned asset, or null when the host has no official binary.
 */
export function resolveDoxygenAsset(
	manifest,
	platform = process.platform,
	arch = process.arch,
) {
	return manifest?.assets?.[platformKey(platform, arch)] ?? null;
}

/**
 * Builds the DSH-managed installation root for one pinned Doxygen version.
 *
 * @param {string} dataRoot - Plugin tools directory holding versioned roots.
 * @param {string} version - Pinned Doxygen version.
 * @returns {string} Absolute installation root path.
 */
export function doxygenInstallRoot(dataRoot, version) {
	return join(dataRoot, `doxygen-${version}`);
}

/**
 * Resolves the managed Doxygen executable path for the host.
 *
 * @param {string} dataRoot - Plugin tools directory holding versioned roots.
 * @param {{version: string, assets?: Record<string, {executable: string}>}} manifest -
 *   The `doxygen` entry of the tool manifest.
 * @param {string} [platform] - Node process platform identifier.
 * @param {string} [arch] - Node process architecture identifier.
 * @returns {string | null} Absolute executable path, or null when unsupported.
 */
export function resolveDoxygenBinary(
	dataRoot,
	manifest,
	platform = process.platform,
	arch = process.arch,
) {
	const asset = resolveDoxygenAsset(manifest, platform, arch);
	if (!asset) return null;
	return join(doxygenInstallRoot(dataRoot, manifest.version), asset.executable);
}

/**
 * Lists the platform keys the manifest pins.
 *
 * @param {{assets?: Record<string, unknown>}} manifest - The `doxygen` manifest entry.
 * @returns {string[]} Sorted supported platform keys.
 */
export function supportedDoxygenPlatforms(manifest) {
	return Object.keys(manifest?.assets ?? {}).sort();
}
