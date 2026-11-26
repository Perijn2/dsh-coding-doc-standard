/**
 * @module contract-engine
 * @author Perijin Huijser
 * Validates decoded documentation against the universal contract and assembles findings.
 *
 * @remarks
 * Usage:
 *   Core principle: One language-independent contract; the engine sees decoded fields, never native syntax.
 *   Setup: Feed a decoded document, its discovered units, and the profile whose spellings label the findings.
 *   Workflow: Check the required header field Summary, then the documentation of each discovered unit.
 *   API guide: checkDocumentation returns findings shaped {line, message} for the gate to aggregate.
 *   Worked example: checkDocumentation(decoded, units).length === 0
 */

// Only the summary is gate-required: authorship is owned by VCS blame, so a
// per-file Author is optional (the skill explains when to include it).
const REQUIRED_FIELDS = ["summary"];

/**
 * Matches the mandatory parameter direction marker: (in), (out), (in-out).
 */
const DIRECTION_MARKER = /\((?:in|out|in-out)\)/u;

/**
 * Renders the label a missing field is reported by: its first declared spelling.
 *
 * @param {object | undefined} profile - Loaded profile declaring field spellings, if any.
 * @param {string} field - Universal field name.
 * @returns {string} The first accepted spelling, or the universal name when no spelling is declared.
 */
function reportLabel(profile, field) {
	const declared = profile?.codec?.fields?.[field];
	const first = Array.isArray(declared) ? declared[0] : declared;
	return typeof first === "string" && first !== "" ? first : field;
}

/**
 * Checks one decoded document against the universal contract.
 *
 * @param {object} decoded - Decoded documentation from the codec.
 * @param {Array<{name: string, line: number}>} units - Discovered units.
 * @param {object} [profile] - Loaded profile whose field spellings label missing-field findings.
 * @returns {Array<{line: number, message: string}>} Findings with 1-based lines.
 */
export function checkDocumentation(decoded, units, profile) {
	const findings = [];
	const headerLine = decoded.header_line || 1;
	for (const field of REQUIRED_FIELDS) {
		const value = decoded.header[field];
		if (typeof value !== "string" || value.trim() === "") {
			findings.push({
				line: headerLine,
				message: `Missing '${reportLabel(profile, field)}' in file header`,
			});
		}
	}
	for (const unit of units) {
		const doc = decoded.unit_docs[unit.name];
		if (!doc) {
			findings.push({
				line: unit.line,
				message: `Missing unit documentation for '${unit.name}'`,
			});
			continue;
		}
		if (!doc.summary || doc.summary.trim() === "") {
			findings.push({
				line: unit.line,
				message: `Unit documentation for '${unit.name}' must start with a summary`,
			});
		}
		// A pack that declares a parameters section (the Lua pack's @param)
		// gets direction markers enforced: every entry must carry (in), (out),
		// or (in-out), because a parameter without a direction is a contract
		// gap, not a style choice.
		if (profile?.units?.sections?.parameters) {
			for (const entry of doc.sections?.parameters ?? []) {
				if (!DIRECTION_MARKER.test(entry)) {
					findings.push({
						line: unit.line,
						message: `Parameter entry in '${unit.name}' is missing a direction marker (in|out|in-out): ${entry}`,
					});
				}
			}
		}
	}
	return findings;
}
