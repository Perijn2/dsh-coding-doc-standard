/**
 * @module pack-settings
 * @author Perijn Huijser
 * Renders the settings surface from the installed pack registry and applies changes to policy.
 *
 * @remarks
 * Usage:
 *   Core principle: The menu is generated from the registry; the panel cannot drift from enforcement.
 *   Setup: Install packs under languages/; policy carries profile enable state and pins.
 *   Workflow: Build schema fields and resolved values for the host, then fold user edits back into policy.
 *   API guide: packSettingsFields builds schema, packSettingsSource resolves values, packSettingsApply persists.
 *   Worked example: const fields = packSettingsFields(schemaTools, policy)
 */

import { getRegistry } from "./registry.mjs";

/**
 * Answers whether a pack profile is enabled for enforcement.
 *
 * @param {Record<string, unknown>} [policy] - Effective policy.
 * @param {string} packId - Pack identifier.
 * @param {string} profileId - Profile identifier.
 * @returns {boolean} True unless the policy explicitly disables the profile.
 */
export function packProfileEnabled(policy, packId, profileId) {
	return policy?.packProfiles?.[packId]?.[profileId] !== false;
}

/**
 * Builds the schema fields for one pack's settings group.
 *
 * @param {object} schemaTools - Schemastery module.
 * @param {object} pack - Loaded pack record.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {[string, object]} The pack id and its schema field.
 */
function packField(schemaTools, pack, policy) {
	const fields = {};
	for (const profile of pack.profiles.values()) {
		fields[profile.id] = schemaTools
			.boolean()
			.default(packProfileEnabled(policy, pack.manifest.id, profile.id))
			.description(
				`Language versions: ${profile.languageVersions}. Disable to stop this profile from enforcing.`,
			);
	}
	return [
		pack.manifest.id,
		schemaTools
			.object(fields)
			.description(pack.manifest.label ?? pack.manifest.id),
	];
}

/**
 * Builds the registry-driven settings fields for every installed pack.
 *
 * Policy references to packs that are not installed render as not-installed
 * entries so the user can see and clean up stale policy.
 *
 * @param {object} schemaTools - Schemastery module.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {object} Schemastery object holding one group per pack.
 */
export function packSettingsFields(schemaTools, policy = {}) {
	const registry = getRegistry();
	const fields = {};
	for (const pack of registry.packs.values()) {
		const [id, field] = packField(schemaTools, pack, policy);
		fields[id] = field;
	}
	const stale = Object.keys(policy?.packProfiles ?? {}).filter(
		(packId) => !registry.packs.has(packId),
	);
	for (const packId of stale) {
		fields[packId] = schemaTools
			.object({})
			.description(
				"Not installed: this policy entry references a pack that is absent.",
			);
	}
	return schemaTools.object(fields).description("Installed language packs.");
}

/**
 * Resolves the current pack settings values.
 *
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {Record<string, Record<string, boolean>>} Nested pack profile enable state.
 */
export function packSettingsSource(policy = {}) {
	const registry = getRegistry();
	const source = {};
	for (const pack of registry.packs.values()) {
		source[pack.manifest.id] = {};
		for (const profile of pack.profiles.values()) {
			source[pack.manifest.id][profile.id] = packProfileEnabled(
				policy,
				pack.manifest.id,
				profile.id,
			);
		}
	}
	return source;
}

/**
 * Folds user pack settings edits back into durable policy.
 *
 * @param {Record<string, unknown>} [value] - The packs group from the resolved settings.
 * @param {Record<string, unknown>} [current] - Current policy.
 * @returns {Record<string, Record<string, boolean>>} The next packProfiles policy value.
 */
export function packSettingsApply(value, current = {}) {
	const next = { ...(current.packProfiles ?? {}) };
	const registry = getRegistry();
	for (const [packId, profiles] of Object.entries(value ?? {})) {
		if (!registry.packs.has(packId)) {
			next[packId] = { ...(next[packId] ?? {}) };
			continue;
		}
		next[packId] = { ...(next[packId] ?? {}) };
		const pack = registry.packs.get(packId);
		for (const profileId of pack.profiles.keys()) {
			// A field the patch does not mention keeps its previous state, so a
			// partial write can never silently re-enable a disabled profile.
			next[packId][profileId] =
				profiles && profileId in profiles
					? profiles[profileId] !== false
					: current.packProfiles?.[packId]?.[profileId] !== false;
		}
	}
	return next;
}
