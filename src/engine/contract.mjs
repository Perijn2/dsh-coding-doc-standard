/**
 * @module contract-engine
 * @author Perijin Huijser
 * Validates decoded documentation against the universal contract and assembles findings.
 *
 * @remarks
 * Usage:
 *   Core principle: One language-independent contract; the engine sees decoded fields, never native syntax.
 *   Setup: Feed a decoded document, its discovered units, and the profile.
 *   Workflow: Check required header fields, the optional Usage ground rule, and per-unit documentation.
 *   API guide: checkDocumentation returns findings shaped {line, message} for the gate to aggregate.
 *   Worked example: checkDocumentation(decoded, units).length === 0
 */

const REQUIRED_FIELDS = ["author", "summary", "description"];

/**
 * Checks one decoded document against the universal contract.
 *
 * @param {object} decoded - Decoded documentation from the codec.
 * @param {Array<{name: string, line: number}>} units - Discovered units.
 * @returns {Array<{line: number, message: string}>} Findings with 1-based lines.
 */
export function checkDocumentation(decoded, units) {
	const findings = [];
	const headerLine = decoded.header_line || 1;
	for (const field of REQUIRED_FIELDS) {
		const value = decoded.header[field];
		if (typeof value !== "string" || value.trim() === "") {
			findings.push({
				line: headerLine,
				message: `Missing '${field}' in file header`,
			});
		}
	}
	const usage = decoded.header.usage;
	if (typeof usage === "string" && usage.trim() !== "") {
		const lowered = usage.toLowerCase();
		const references = units.some((unit) => {
			if (lowered.includes(unit.name.toLowerCase())) return true;
			// Qualified names like "M.add" may be referenced by any name segment.
			return unit.name
				.split(/[^A-Za-z0-9_]+/u)
				.filter((segment) => segment.length >= 2)
				.some((segment) => lowered.includes(segment.toLowerCase()));
		});
		if (units.length > 0 && !references) {
			findings.push({
				line: headerLine,
				message: "Usage must reference at least one unit exposed by this file",
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
	}
	return findings;
}
