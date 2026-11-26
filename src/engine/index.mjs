/**
 * @module engine
 * @author Perijin Huijser
 * Orchestrates pack coverage, profile resolution, decoding, discovery, and contract checking.
 *
 * @remarks
 * Usage:
 *   Core principle: One pack covers a path end to end; its failures are contained and surfaced as notices.
 *   Setup: Install packs under languages/ and let the gate call packCoverageFor and validateWithPacks.
 *   Workflow: Resolve coverage, select the profile, decode, discover units, check the contract, and render lines.
 *   API guide: packCoverageFor answers "does a pack govern this path"; validateWithPacks returns gate-ready finding lines.
 *   Worked example: const coverage = packCoverageFor("src/a.lua"); await validateWithPacks(candidate, coverage)
 */

import { decodeDocument } from "./codec.mjs";
import { checkDocumentation } from "./contract.mjs";
import { checkNaming } from "./naming.mjs";
import { resolveProfile } from "./profiles.mjs";
import { discoverUnits, ProviderUnavailableError } from "./providers.mjs";
import { getRegistry, packForPath } from "./registry.mjs";

/**
 * Answers whether a pack governs this path, resolving its profile.
 *
 * @param {string} path - Candidate file path.
 * @param {Record<string, unknown>} [policy] - Effective policy carrying profilePins.
 * @returns {{pack: object, profile: object, resolution: object} | null} Coverage, or null when no pack matches.
 */
export function packCoverageFor(path, policy = {}) {
	const coverage = packForPath(path);
	if (!coverage) return null;
	const { profile, resolution } = resolveProfile(coverage.pack, policy);
	// A profile the user disabled in settings does not enforce, so the pack
	// does not cover the path and legacy passes keep their previous behavior.
	if (policy?.packProfiles?.[coverage.pack.manifest.id]?.[profile.id] === false)
		return null;
	// The per-language master switch gates pack coverage exactly as it gates the
	// legacy checker, so one toggle behaves alike on every covered path.
	if (
		typeof profile.policyLanguage === "string" &&
		policy?.languages?.[profile.policyLanguage] === false
	)
		return null;
	return { pack: coverage.pack, profile, resolution };
}

/**
 * Validates one candidate through its covering pack, rendering gate-ready lines.
 *
 * Every failure is contained: a pack that cannot run yields one explanatory
 * finding instead of an exception, so other passes keep reporting (REQ-027).
 *
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {{pack: object, profile: object, resolution: object}} coverage - Resolved coverage.
 * @returns {Promise<string[]>} Finding lines in gate format.
 */
export async function validateWithPacks(candidate, coverage) {
	const { profile } = coverage;
	const path = candidate.path;
	try {
		// A pack declares unit discovery when its family has enforceable units;
		// a header-only pack (TypeScript today) simply declares none.
		const units = profile.units
			? await discoverUnits(candidate.content, profile)
			: [];
		const decoded = decodeDocument(candidate.content, profile, units);
		const findings = [
			...checkDocumentation(decoded, units, profile),
			...(await checkNaming(candidate.content, profile)),
		];
		return findings.map(
			(finding) => `${path}:${finding.line} [doc-standard] ${finding.message}`,
		);
	} catch (error) {
		if (error instanceof ProviderUnavailableError) {
			return [
				`${path}:1 [doc-standard] Language pack '${coverage.pack.manifest.id}' could not check this file: ${error.message}`,
			];
		}
		throw error;
	}
}

export { getRegistry, packForPath };
