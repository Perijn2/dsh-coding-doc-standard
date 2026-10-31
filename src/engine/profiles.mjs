/**
 * @module profile-selector
 * @author Perijn Huijser
 * Resolves the matching version profile for a language from pins, detection, and defaults.
 *
 * @remarks
 * Usage:
 *   Core principle: Selection order is user pin, then detection match, then pack default; the resolution is always explainable.
 *   Setup: Packs declare version ranges and optional detection hints; policy carries pins.
 *   Workflow: Read the pin, match detected version against ranges, fall back to the pack default.
 *   API guide: resolveProfile returns the profile plus a resolution record per the profile-resolution contract.
 *   Worked example: resolveProfile(pack, policy, { detectedVersion: "5.4" }).resolution.source === "detect"
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Compares a dotted version against a simple comparator range such as ">=5.1".
 *
 * Supports `>=`, `<=`, `>`, `<`, `=`, and `*` (any). Only the first comparator of a
 * range is interpreted; packs needing richer ranges ship a provider later.
 *
 * @param {string} version - Detected language version, for example "5.4".
 * @param {string} range - Declared range, for example ">=5.1" or "*".
 * @returns {boolean} True when the version satisfies the range.
 */
export function versionSatisfies(version, range) {
	const cleaned = String(range ?? "").trim();
	if (cleaned === "" || cleaned === "*") return true;
	const match = cleaned.match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})$/);
	if (!match) return false;
	const comparator = match[1] ?? "=";
	const parse = (value) =>
		String(value)
			.split(".")
			.map((part) => Number.parseInt(part, 10) || 0);
	const actual = parse(version);
	const declared = parse(match[2]);
	const length = Math.max(actual.length, declared.length);
	for (let index = 0; index < length; index += 1) {
		const a = actual[index] ?? 0;
		const b = declared[index] ?? 0;
		if (a !== b) {
			switch (comparator) {
				case ">=":
					return a > b;
				case ">":
					return a > b;
				case "<=":
					return a < b;
				case "<":
					return a < b;
				default:
					return false;
			}
		}
	}
	switch (comparator) {
		case ">":
		case "<":
			return false;
		default:
			return true;
	}
}

/**
 * Reads the detected language version from a workspace using pack hints.
 *
 * Phase 1 keeps detection best-effort: the pack may declare `detect.versionFiles`
 * whose content holds a bare version (for example `.python-version`). Absent hints
 * or unreadable files yield null and the caller falls back.
 *
 * @param {object} pack - Loaded pack record.
 * @param {{cwd?: string}} [options] - Workspace root.
 * @returns {{version: string | null, hint: string | null}} Detected version and the hint that matched.
 */
export function detectLanguageVersion(pack, options = {}) {
	const files = pack.manifest?.detect?.versionFiles ?? [];
	const root = options.cwd ?? process.cwd();
	for (const name of files) {
		try {
			const text = readFileSync(join(root, name), "utf8").trim();
			const match = text.match(/(\d+(?:\.\d+){0,2})/);
			if (match) return { version: match[1], hint: name };
		} catch {
			// Best-effort detection: an unreadable hint never blocks selection.
		}
	}
	return { version: null, hint: null };
}

/**
 * Resolves the profile for one pack per pin, detection, default order.
 *
 * @param {object} pack - Loaded pack record.
 * @param {Record<string, unknown>} [policy] - Effective policy carrying profilePins.
 * @param {{cwd?: string, detectedVersion?: string | null}} [options] - Detection override.
 * @returns {{profile: object, resolution: object}} The selected profile and its resolution record.
 */
export function resolveProfile(pack, policy = {}, options = {}) {
	const packId = pack.manifest.id;
	const pin = policy?.profilePins?.[packId];
	if (typeof pin === "string" && pack.profiles.has(pin)) {
		return {
			profile: pack.profiles.get(pin),
			resolution: {
				language: pack.manifest.language.name,
				detected_version: options.detectedVersion ?? null,
				pinned_profile: pin,
				resolved_profile: pin,
				source: "pin",
				hint: null,
			},
		};
	}
	const hintResult =
		options.detectedVersion == null
			? detectLanguageVersion(pack, options)
			: null;
	const detected =
		options.detectedVersion != null
			? options.detectedVersion
			: (hintResult?.version ?? null);
	if (detected) {
		for (const profile of pack.profiles.values()) {
			if (versionSatisfies(detected, profile.languageVersions)) {
				return {
					profile,
					resolution: {
						language: pack.manifest.language.name,
						detected_version: detected,
						pinned_profile: pin ?? null,
						resolved_profile: profile.id,
						source: "detect",
						hint: hintResult?.hint ?? null,
					},
				};
			}
		}
	}
	const profile =
		pack.profiles.get(pack.defaultProfile) ?? [...pack.profiles.values()][0];
	return {
		profile,
		resolution: {
			language: pack.manifest.language.name,
			detected_version: detected ?? null,
			pinned_profile: pin ?? null,
			resolved_profile: profile.id,
			source: "default",
			hint: null,
		},
	};
}
