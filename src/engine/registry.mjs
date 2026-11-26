/**
 * @module pack-registry
 * @author Perijn Huijser
 * Discovers language packs, validates their manifests, and exposes the installed registry.
 *
 * @remarks
 * Usage:
 *   Core principle: Packs are data; a broken pack is excluded with a warning and never affects other packs.
 *   Setup: Place pack directories with pack.json under languages/.
 *   Workflow: Load the registry once per process, resolve a candidate path to a pack profile, and let callers consume declarations.
 *   API guide: getRegistry returns the cached registry; packForPath resolves coverage; loadPacks forces a reload.
 *   Worked example: const registry = await getRegistry(); const coverage = registry.coverageFor("a.lua");
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filenameMatches } from "./formatters.mjs";

/**
 * Absolute path of the installed language packs root.
 *
 * @type {string}
 */
export const packsRoot = join(
	dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
	"languages",
);

const PACK_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const PROFILE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const UNIT_PROVIDERS = new Set([
	"tree-sitter",
	"regex",
	"npm",
	"external-command",
]);
const FORMATTER_ADAPTERS = new Set([
	"stdin-binary",
	"npm-function",
	"external-command",
]);
const DEPENDENCY_SOURCES = new Set([
	"pack-store",
	"plugin-node-modules",
	"legacy-engine-tools",
	"project",
]);
const HEADER_SYNTAXES = new Set(["line", "block", "docstring", "haddock"]);

/**
 * A pack excluded from the registry with its reason.
 *
 * @typedef {{directory: string, id: string | null, reason: string}} ExcludedPack
 */

/**
 * The validated registry of installed language packs.
 *
 * @typedef {{packs: Map<string, object>, excluded: ExcludedPack[]}} Registry
 */

/**
 * Reads and parses a JSON file, returning null instead of throwing.
 *
 * @param {string} path - File to read.
 * @returns {object | null} Parsed JSON, or null when absent or malformed.
 */
function readJsonOrNull(path) {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

/**
 * Validates the header syntax tokens a codec declaration carries.
 *
 * Line syntax names a line token; block and docstring syntax name open and
 * close tokens. Field spellings are validated by the calling branch.
 *
 * @param {object} profile - Parsed profile document.
 * @param {string} path - Profile file path for error messages.
 * @returns {string | null} Validation error, or null when the codec declaration is valid.
 */
function validateCodec(profile, path) {
	const codec = profile.codec;
	if (
		typeof codec.headerSyntax !== "string" ||
		!HEADER_SYNTAXES.has(codec.headerSyntax)
	)
		return `${path} declares an unsupported header syntax`;
	if (codec.headerSyntax === "line") {
		if (typeof codec.headerToken !== "string" || codec.headerToken === "")
			return `${path} declares no header token`;
		return null;
	}
	if (typeof codec.headerOpen !== "string" || codec.headerOpen === "")
		return `${path} declares no header open token`;
	if (typeof codec.headerClose !== "string" || codec.headerClose === "")
		return `${path} declares no header close token`;
	return null;
}

/**
 * Validates the formatter declaration any profile may carry, returning an
 * error string or null. A formatter-only profile requires one; a full
 * profile's formatter is optional but validated when present.
 *
 * @param {object} formatter - Parsed formatter declaration.
 * @param {string} path - Profile file path for error messages.
 * @returns {string | null} Validation error, or null when valid.
 */
function validateFormatter(formatter, path) {
	if (!formatter || typeof formatter !== "object")
		return `${path} declares no valid formatter`;
	if (!FORMATTER_ADAPTERS.has(formatter.adapter))
		return `${path} declares an unsupported formatter adapter`;
	const dependency = formatter.dependency;
	if (
		!dependency ||
		typeof dependency !== "object" ||
		!DEPENDENCY_SOURCES.has(dependency.source)
	)
		return `${path} declares an unsupported formatter dependency source`;
	if (
		formatter.settingsKey !== undefined &&
		typeof formatter.settingsKey !== "string"
	)
		return `${path} declares an invalid formatter settings key`;
	if (
		formatter.unavailableHint !== undefined &&
		typeof formatter.unavailableHint !== "string"
	)
		return `${path} declares an invalid formatter unavailable hint`;
	return null;
}

/**
 * Validates one profile declaration, returning an error string or null.
 *
 * @param {object} profile - Parsed profile document.
 * @param {string} path - Profile file path for error messages.
 * @returns {string | null} Validation error, or null when the profile is valid.
 */
function validateProfile(profile, path) {
	if (!profile || typeof profile !== "object")
		return `${path} is not an object`;
	if (typeof profile.id !== "string" || !PROFILE_ID_PATTERN.test(profile.id))
		return `${path} declares no valid profile id`;
	if (
		typeof profile.languageVersions !== "string" ||
		profile.languageVersions === ""
	)
		return `${path} declares no language version range`;
	if (
		profile.policyLanguage !== undefined &&
		typeof profile.policyLanguage !== "string"
	)
		return `${path} declares an invalid policy language key`;
	if (!Array.isArray(profile.extensions) && !Array.isArray(profile.filenames))
		return `${path} declares no extensions or filenames`;
	if (
		Array.isArray(profile.filenames) &&
		profile.extensions.length === 0 &&
		profile.filenames.length === 0
	)
		return `${path} declares no extensions or filenames`;
	// A formatter-only profile carries no documentation rules yet (migration
	// path for the formatter adapter layer): codec and units are optional.
	if (profile.formatterOnly === true) {
		if (!profile.formatter || typeof profile.formatter !== "object")
			return `${path} is formatter-only but declares no formatter`;
		const formatterError = validateFormatter(profile.formatter, path);
		if (formatterError) return formatterError;
		// A formatter-only profile may still declare the codec that gives it
		// header coverage and the unit discovery that gives it full coverage.
		if (profile.codec !== undefined) {
			const codecError = validateCodec(profile, path);
			if (codecError) return codecError;
			if (!profile.codec.fields || typeof profile.codec.fields !== "object")
				return `${path} declares no field spellings`;
		}
		if (profile.units !== undefined) {
			if (!profile.units || typeof profile.units !== "object")
				return `${path} declares invalid unit discovery`;
			if (!UNIT_PROVIDERS.has(profile.units.provider))
				return `${path} declares an unsupported unit provider`;
		}
		return null;
	}
	if (!profile.codec || typeof profile.codec !== "object")
		return `${path} declares no codec`;
	const fullCodecError = validateCodec(profile, path);
	if (fullCodecError) return fullCodecError;
	if (!profile.codec.fields || typeof profile.codec.fields !== "object")
		return `${path} declares no field spellings`;
	if (!profile.units || typeof profile.units !== "object")
		return `${path} declares no unit discovery`;
	if (!UNIT_PROVIDERS.has(profile.units.provider))
		return `${path} declares an unsupported unit provider`;
	// A full profile may still declare a formatter (the Rust pack's
	// project-toolchain rustfmt is declared next to its codec and units).
	if (profile.formatter !== undefined) {
		const formatterError = validateFormatter(profile.formatter, path);
		if (formatterError) return formatterError;
	}
	return null;
}

/**
 * Loads every installed pack, excluding invalid ones with a reason.
 *
 * @param {string} [root] - Packs root directory.
 * @returns {Registry} Validated registry with exclusions.
 */
export function loadPacks(root = packsRoot) {
	/** @type {Map<string, object>} */
	const packs = new Map();
	/** @type {ExcludedPack[]} */
	const excluded = [];
	if (!existsSync(root)) return { packs, excluded };
	for (const entry of readdirSync(root, { withDirectories: true })) {
		const directory = join(root, entry.name ?? entry);
		const name = entry.name ?? entry;
		const manifest = readJsonOrNull(join(directory, "pack.json"));
		if (!manifest) {
			excluded.push({
				directory: name,
				id: null,
				reason: "missing or malformed pack.json",
			});
			continue;
		}
		const failures = [];
		if (typeof manifest.id !== "string" || !PACK_ID_PATTERN.test(manifest.id))
			failures.push("declares no valid pack id");
		if (typeof manifest.label !== "string" || manifest.label === "")
			failures.push("declares no label");
		if (!manifest.language || typeof manifest.language.name !== "string")
			failures.push("declares no language name");
		if (!Array.isArray(manifest.profiles) || manifest.profiles.length === 0)
			failures.push("declares no profiles");
		if (packs.has(manifest.id))
			failures.push("duplicates an installed pack id");
		if (failures.length === 0) {
			const profiles = new Map();
			for (const profileId of manifest.profiles) {
				const profilePath = join(
					directory,
					"profiles",
					profileId,
					"profile.json",
				);
				const profile = readJsonOrNull(profilePath);
				const error =
					profile === null
						? `${profileId} profile is missing or malformed`
						: validateProfile(profile, profileId);
				if (error) {
					failures.push(error);
					break;
				}
				profile.root = directory;
				profile.manifest = manifest;
				profiles.set(profileId, profile);
			}
			if (failures.length === 0) {
				packs.set(manifest.id, {
					manifest,
					directory,
					profiles,
					defaultProfile:
						manifest.language?.defaultProfile ?? manifest.profiles[0],
				});
				continue;
			}
		}
		excluded.push({
			directory: name,
			id: manifest.id ?? null,
			reason: failures.join("; "),
		});
	}
	return { packs, excluded };
}

let cache = null;

/**
 * Returns the cached registry, loading it on first use.
 *
 * @param {{reload?: boolean}} [options] - Force a reload when true.
 * @returns {Registry} The registry.
 */
export function getRegistry(options = {}) {
	if (!cache || options.reload) {
		cache = loadPacks();
		for (const excluded of cache.excluded)
			console.warn(
				`[doc-standard] Language pack '${excluded.directory}' excluded: ${excluded.reason}`,
			);
	}
	return cache;
}

/**
 * Resolves the pack and profile covering one candidate path, if any.
 *
 * @param {string} path - Candidate file path.
 * @param {Registry} [registry] - Registry to search; defaults to the cached registry.
 * @returns {{pack: object, profile: object} | null} Coverage, or null when no pack matches.
 */
export function packForPath(path, registry = getRegistry()) {
	const extension = extname(path).toLowerCase();
	const base = basename(path).toLowerCase();
	for (const pack of registry.packs.values()) {
		for (const profile of pack.profiles.values()) {
			// A formatter-only profile without a codec owns formatting only; one
			// declaring a codec covers the file header for this path.
			if (profile.formatterOnly === true && !profile.codec) continue;
			const byExtension = profile.extensions?.some(
				(value) => value.toLowerCase() === extension,
			);
			const byFilename = profile.filenames?.some((value) =>
				filenameMatches(base, value),
			);
			if (byExtension || byFilename) return { pack, profile };
		}
	}
	return null;
}
