/**
 * @module codec
 * @author Perijin Huijser
 * Decodes language-native documentation syntax into the universal contract representation.
 *
 * @remarks
 * Usage:
 *   Core principle: The engine never learns a language's syntax; it interprets the profile's codec declaration.
 *   Setup: A profile declares its preamble, header syntax and token, and field spellings.
 *   Workflow: Skip the preamble, collect the header in the declared line, block, or docstring syntax, and decode fields.
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
	for (const pattern of profile.preamble?.patterns ?? []) {
		const match = new RegExp(pattern, "u").exec(content.slice(offset));
		if (match) offset += match[0].length;
	}
	return { offset, line: content.slice(0, offset).split("\n").length };
}

/**
 * Collects the contiguous header token lines after the preamble.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile declaring the header token.
 * @param {number} fromOffset - Offset to start scanning from.
 * @returns {{present: boolean, text: string[], endOffset: number, startLine: number}} Raw header lines.
 */
function collectLineHeader(content, profile, fromOffset) {
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
 * Collects the header block delimited by the declared open and close tokens.
 *
 * The declared continuation token is stripped per line, one preserved space
 * beyond it keeps wrapped prose distinguishable from a new field, docstring
 * syntax tolerates string prefixes and either triple-quote form, and an
 * unterminated block is no header at all.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile declaring the open, close, and optional continuation tokens.
 * @param {number} fromOffset - Offset to start scanning from.
 * @returns {{present: boolean, text: string[], endOffset: number, startLine: number}} Raw header lines.
 */
function collectDelimitedHeader(content, profile, fromOffset) {
	const open = profile.codec.headerOpen;
	const close = profile.codec.headerClose;
	const continuation = profile.codec.continuation;
	const startLine = content.slice(0, fromOffset).split("\n").length;
	const absent = {
		present: false,
		text: [],
		endOffset: fromOffset,
		startLine,
	};
	if (
		typeof open !== "string" ||
		open === "" ||
		typeof close !== "string" ||
		close === ""
	)
		return absent;
	let cursor = fromOffset;
	while (cursor < content.length && /\s/u.test(content[cursor])) cursor += 1;
	let openToken = open;
	let closeToken = close;
	if (profile.codec.headerSyntax === "docstring") {
		cursor += /^[rbufRBUF]{0,2}/u.exec(content.slice(cursor))[0].length;
		// Docstrings open with either triple-quote form; the same form closes.
		const triple = open === '"""' ? "'''" : '"""';
		if (content.startsWith(triple, cursor)) {
			openToken = triple;
			closeToken = triple;
		}
	}
	if (!content.startsWith(openToken, cursor)) return absent;
	const bodyStart = cursor + openToken.length;
	const closeIndex = content.indexOf(closeToken, bodyStart);
	if (closeIndex === -1) return absent;
	const text = [];
	for (const raw of content.slice(bodyStart, closeIndex).split("\n")) {
		let body = raw.replace(/^\s+/, "").replace(/\r$/, "");
		if (
			typeof continuation === "string" &&
			continuation !== "" &&
			body.startsWith(continuation)
		) {
			body = body.slice(continuation.length);
			if (body.startsWith(" ")) body = body.slice(1);
		}
		if (body.trim() !== "") text.push(body.replace(/\s+$/, ""));
	}
	return {
		present: text.length > 0,
		text,
		endOffset: closeIndex + closeToken.length,
		startLine: content.slice(0, cursor).split("\n").length,
	};
}

/**
 * Collects the raw documentation header in the syntax the profile declares.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile declaring the header syntax.
 * @param {number} [fromOffset] - Offset to start scanning from.
 * @returns {{present: boolean, text: string[], endOffset: number, startLine: number}} Raw header lines.
 */
export function collectHeaderLines(content, profile, fromOffset = 0) {
	if (
		profile.codec.headerSyntax === "block" ||
		profile.codec.headerSyntax === "docstring"
	)
		return collectDelimitedHeader(content, profile, fromOffset);
	return collectLineHeader(content, profile, fromOffset);
}

/**
 * Decodes raw header lines into universal fields using the declared spellings.
 *
 * A spelling is one string or an ordered list of accepted forms. A profile
 * may declare a tag sigil, whose unmatched lines decode as no content and
 * close the current field, and an unlabeled field that receives plain prose.
 * Without those two declarations plain prose continues the current field.
 *
 * @param {string[]} lines - Raw header text lines without their token.
 * @param {object} profile - Loaded profile declaring field spellings and routing.
 * @returns {Record<string, string>} Decoded fields keyed by universal name; only present fields appear.
 */
export function decodeFields(lines, profile) {
	const declared = profile.codec.fields ?? {};
	const tagSigil =
		typeof profile.codec.tagSigil === "string" ? profile.codec.tagSigil : null;
	const unlabeled =
		typeof profile.codec.unlabeled === "string"
			? profile.codec.unlabeled
			: null;
	const decoded = {};
	let current = null;
	for (const rawLine of lines) {
		const flush = !/^\s/u.test(rawLine);
		const raw = rawLine.trim();
		if (raw === "") continue;
		let matched = false;
		for (const field of UNIVERSAL_FIELDS) {
			const forms = Array.isArray(declared[field])
				? declared[field]
				: typeof declared[field] === "string"
					? [declared[field]]
					: [];
			for (const form of forms) {
				if (
					typeof form === "string" &&
					form !== "" &&
					raw.toLowerCase().startsWith(form.toLowerCase())
				) {
					decoded[field] = raw.slice(form.length).trim();
					current = field;
					matched = true;
					break;
				}
			}
			if (matched) break;
		}
		if (matched) continue;
		if (tagSigil !== null && raw.startsWith(tagSigil)) {
			current = null;
			continue;
		}
		if (unlabeled !== null && flush) {
			decoded[unlabeled] = `${decoded[unlabeled] ?? ""} ${raw}`.trim();
			current = unlabeled;
		} else if (current !== null) {
			decoded[current] = `${decoded[current]} ${raw}`.trim();
		}
	}
	for (const field of UNIVERSAL_FIELDS)
		if (decoded[field] === "") delete decoded[field];
	return decoded;
}

/**
 * Lists the accepted spelling forms of a declared field.
 *
 * @param {string | string[] | undefined} declared - A spelling string or array.
 * @returns {string[]} Non-empty string forms, in declaration order.
 */
function spellingsOf(declared) {
	if (Array.isArray(declared))
		return declared.filter(
			(value) => typeof value === "string" && value !== "",
		);
	return typeof declared === "string" && declared !== "" ? [declared] : [];
}

/**
 * Collects the line-token documentation block directly above a unit offset.
 *
 * @param {string} content - Complete candidate content.
 * @param {number} unitOffset - Character offset of the unit declaration.
 * @param {string} token - Line token introducing each documentation line.
 * @returns {string[] | null} Documentation lines without their token, or null when absent.
 */
function collectPrecedingLines(content, unitOffset, token) {
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
	return docLines.length > 0 ? docLines : null;
}

/**
 * Collects the delimited documentation block directly above a unit offset.
 *
 * @param {string} content - Complete candidate content.
 * @param {number} unitOffset - Character offset of the unit declaration.
 * @param {object} binding - Block binding declaring open, close, and continuation tokens.
 * @returns {string[] | null} Documentation lines without delimiters, or null when absent.
 */
function collectPrecedingBlock(content, unitOffset, binding) {
	const open = binding.open ?? "/**";
	const close = binding.close ?? "*/";
	const continuation = binding.continuation ?? "*";
	const lines = content.slice(0, unitOffset).split("\n");
	while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
	if (lines.length === 0 || !lines[lines.length - 1].trim().endsWith(close))
		return null;
	const last = lines.pop().trim();
	if (last.startsWith(open)) {
		const only = last.slice(open.length, last.length - close.length).trim();
		return only === "" ? null : [only];
	}
	const docLines = [];
	let found = false;
	while (lines.length > 0) {
		const trimmed = lines.pop().trim();
		if (trimmed === open) {
			found = true;
			break;
		}
		let body = trimmed;
		if (body.startsWith(continuation)) {
			body = body.slice(continuation.length);
			if (body.startsWith(" ")) body = body.slice(1);
		}
		docLines.unshift(body);
	}
	return found && docLines.length > 0 ? docLines : null;
}

/**
 * Collects a docstring literal opened as the first statement below a unit offset.
 *
 * @param {string} content - Complete candidate content.
 * @param {number} unitOffset - Character offset of the unit declaration.
 * @returns {string[] | null} Dedented docstring lines, or null when the body opens with no docstring.
 */
function collectChildDocstring(content, unitOffset) {
	const rest = content.slice(unitOffset);
	const lineEnd = rest.indexOf("\n");
	if (lineEnd === -1) return null;
	const lines = rest.slice(lineEnd + 1).split("\n");
	let index = 0;
	while (index < lines.length && lines[index].trim() === "") index += 1;
	if (index >= lines.length) return null;
	const opener = /^([rbufRBUF]{0,2})("""|''')(.*)$/u.exec(lines[index].trim());
	if (!opener) return null;
	const quote = opener[2];
	const inline = opener[3];
	const closeIndex = inline.indexOf(quote);
	if (closeIndex !== -1) {
		const only = inline.slice(0, closeIndex).trim();
		return only === "" ? null : [only];
	}
	const docLines = inline.trim() === "" ? [] : [inline];
	for (index += 1; index < lines.length; index += 1) {
		const raw = lines[index].replace(/\r$/, "");
		const end = raw.indexOf(quote);
		if (end === -1) docLines.push(raw);
		else {
			if (raw.slice(0, end).trim() !== "") docLines.push(raw.slice(0, end));
			break;
		}
	}
	const indents = docLines
		.filter((value) => value.trim() !== "")
		.map((value) => /^\s*/u.exec(value)[0].length);
	const strip = indents.length > 0 ? Math.min(...indents) : 0;
	return docLines.map((value) => value.slice(strip));
}

/**
 * Decodes one unit's attached documentation in the syntax the binding declares.
 *
 * The binding names a preceding line token, a preceding delimited block, or a
 * child docstring; a first line starting with the header's Summary spelling
 * seeds the summary with the remainder of that line.
 *
 * @param {string} content - Complete candidate content.
 * @param {number} unitOffset - Character offset of the unit declaration.
 * @param {object} profile - Loaded profile declaring the unit doc binding and section spellings.
 * @returns {{summary: string, sections: Record<string, string[]>} | null} Decoded unit doc, or null when absent.
 */
export function decodeUnitDoc(content, unitOffset, profile) {
	const binding = profile.units?.docBinding;
	const syntax = binding?.syntax ?? "line";
	let lines;
	if (syntax === "docstring")
		lines = collectChildDocstring(content, unitOffset);
	else if (syntax === "block")
		lines = collectPrecedingBlock(content, unitOffset, binding);
	else
		lines = collectPrecedingLines(
			content,
			unitOffset,
			binding?.token ?? profile.codec.headerToken,
		);
	if (!lines) return null;
	const sectionSpellings = profile.units?.sections ?? {};
	const summaryForms = spellingsOf(profile.codec?.fields?.summary);
	const result = { summary: "", sections: {} };
	let current = "summary";
	let firstLine = true;
	for (const rawLine of lines) {
		let raw = rawLine.trim();
		if (raw === "") continue;
		if (firstLine) {
			firstLine = false;
			for (const form of summaryForms) {
				if (raw.toLowerCase().startsWith(form.toLowerCase())) {
					raw = raw.slice(form.length).trim();
					break;
				}
			}
		}
		let matched = false;
		for (const [section, spelling] of Object.entries(sectionSpellings)) {
			if (raw.toLowerCase().startsWith(String(spelling).toLowerCase())) {
				current = section;
				result.sections[current] ??= [];
				result.sections[current].push(
					raw.slice(String(spelling).length).trim(),
				);
				matched = true;
				break;
			}
		}
		if (matched) continue;
		if (current === "summary") {
			result.summary = `${result.summary} ${raw}`.trim();
		} else {
			result.sections[current] ??= [];
			const items = result.sections[current];
			items[items.length - 1] = `${items[items.length - 1]} ${raw}`.trim();
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
