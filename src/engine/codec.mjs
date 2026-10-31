/**
 * @module codec
 * @author Perijin Huijser
 * Decodes language-native documentation syntax into the universal contract representation.
 *
 * @remarks
 * Usage:
 *   Core principle: The engine never learns a language's syntax; it interprets the profile's codec declaration.
 *   Setup: A profile declares its preamble, header syntax and token, and field spellings.
 *   Workflow: Skip the preamble, decode the header fields, and decode unit documentation preceding each discovered unit.
 *   API guide: decodeDocument returns the decoded-documentation shape; decodeUnitDoc decodes one unit's attached docs.
 *   Worked example: decodeDocument(content, profile).header.author === "Perijn Huijser"
 */

const UNIVERSAL_FIELDS = [
	"author",
	"summary",
	"description",
	"usage",
	"changelog",
	"notes",
];

/**
 * Locates the end of the declared preamble.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile declaring the preamble.
 * @returns {{offset: number, line: number}} Offset and 1-based line where real content starts.
 */
export function skipPreamble(content, profile) {
	let offset = 0;
	if (content.startsWith("﻿")) offset += 1;
	if (profile.preamble?.shebang && content.startsWith("#!", offset)) {
		const newline = content.indexOf("\n", offset);
		offset = newline === -1 ? content.length : newline + 1;
	}
	return { offset, line: content.slice(0, offset).split("\n").length };
}

/**
 * Collects the contiguous header token lines after the preamble.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile declaring the header token.
 * @param {number} [fromOffset] - Offset to start scanning from.
 * @returns {{present: boolean, text: string[], endOffset: number, startLine: number}} Raw header lines.
 */
export function collectHeaderLines(content, profile, fromOffset = 0) {
	const token = profile.codec.headerToken;
	const lines = [];
	let offset = fromOffset;
	let line = content.slice(0, fromOffset).split("\n").length;
	let sawBlank = false;
	const remaining = content.slice(fromOffset);
	const rawLines = remaining.split("\n");
	for (let index = 0; index < rawLines.length; index += 1) {
		const raw = rawLines[index].replace(/\r$/, "");
		if (raw.trim() === "") {
			if (lines.length > 0) {
				// A blank line ends the header block.
				break;
			}
			sawBlank = true;
			line += 1;
			offset += raw.length + 1;
			continue;
		}
		if (raw.startsWith(token)) {
			if (sawBlank) {
				// Blank lines before the header are tolerated; header found after them.
				sawBlank = false;
			}
			lines.push(raw.slice(token.length));
			line += 1;
			offset += raw.length + 1;
			continue;
		}
		break;
	}
	return {
		present: lines.length > 0,
		text: lines,
		endOffset: offset,
		startLine: line - lines.length,
	};
}

/**
 * Decodes raw header lines into universal fields using the declared spellings.
 *
 * @param {string[]} lines - Raw header text lines without their token.
 * @param {object} profile - Loaded profile declaring field spellings.
 * @returns {Record<string, string>} Decoded fields keyed by universal name; only present fields appear.
 */
export function decodeFields(lines, profile) {
	const spellings = profile.codec.fields ?? {};
	const decoded = {};
	let current = null;
	for (const rawLine of lines) {
		const raw = rawLine.trim();
		if (raw === "") continue;
		let matched = false;
		for (const field of UNIVERSAL_FIELDS) {
			const spelling = spellings[field];
			if (!spelling) continue;
			if (raw.toLowerCase().startsWith(spelling.toLowerCase())) {
				decoded[field] = raw.slice(spelling.length).trim();
				current = field;
				matched = true;
				break;
			}
		}
		if (!matched && current) {
			decoded[current] = `${decoded[current]} ${raw}`.trim();
		}
	}
	for (const field of UNIVERSAL_FIELDS)
		if (decoded[field] === "") delete decoded[field];
	return decoded;
}

/**
 * Decodes one unit's attached documentation block preceding its declaration.
 *
 * @param {string} content - Complete candidate content.
 * @param {number} unitOffset - Character offset of the unit declaration.
 * @param {object} profile - Loaded profile declaring the unit doc binding and section spellings.
 * @returns {{summary: string, sections: Record<string, string[]>} | null} Decoded unit doc, or null when absent.
 */
export function decodeUnitDoc(content, unitOffset, profile) {
	const binding = profile.units?.docBinding;
	const token = binding?.token ?? profile.codec.headerToken;
	const before = content.slice(0, unitOffset).split("\n");
	while (before.length > 0 && before[before.length - 1].trim() === "")
		before.pop();
	const docLines = [];
	while (before.length > 0) {
		const raw = before[before.length - 1].replace(/\r$/, "");
		if (!raw.trimStart().startsWith(token)) break;
		docLines.unshift(raw.trimStart().slice(token.length));
		before.pop();
	}
	if (docLines.length === 0) return null;
	const sectionSpellings = profile.units?.sections ?? {};
	const result = { summary: "", sections: {} };
	let current = "summary";
	for (const raw of docLines) {
		let matched = false;
		for (const [section, spelling] of Object.entries(sectionSpellings)) {
			if (raw.trim().toLowerCase().startsWith(String(spelling).toLowerCase())) {
				current = section;
				result.sections[current] ??= [];
				result.sections[current].push(
					raw.trim().slice(String(spelling).length).trim(),
				);
				matched = true;
				break;
			}
		}
		if (matched) continue;
		if (current === "summary") {
			result.summary = `${result.summary} ${raw.trim()}`.trim();
		} else {
			result.sections[current] ??= [];
			const items = result.sections[current];
			items[items.length - 1] =
				`${items[items.length - 1]} ${raw.trim()}`.trim();
		}
	}
	return result;
}

/**
 * Decodes a complete candidate into the universal documentation representation.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile.
 * @param {Array<{name: string, line: number, offset: number}>} [units] - Discovered units for unit-doc decoding.
 * @returns {{header: Record<string, string>, unit_docs: Record<string, object>, header_present: boolean, header_line: number}} Decoded documentation.
 */
export function decodeDocument(content, profile, units = []) {
	const preamble = skipPreamble(content, profile);
	const header = collectHeaderLines(content, profile, preamble.offset);
	const fields = header.present ? decodeFields(header.text, profile) : {};
	const unitDocs = {};
	for (const unit of units) {
		const doc = decodeUnitDoc(content, unit.offset, profile);
		if (doc) unitDocs[unit.name] = doc;
	}
	return {
		header: fields,
		unit_docs: unitDocs,
		header_present: header.present,
		header_line: header.startLine,
	};
}
