/**
 * @module providers
 * @author Perijin Huijser
 * Discovers units through the dependency provider a profile declares.
 *
 * @remarks
 * Usage:
 *   Core principle: Unit discovery is a capability; tree-sitter, regex, npm, and external-command are interchangeable providers.
 *   Setup: A profile declares provider, grammar or pattern, and optional query.
 *   Workflow: Dispatch to the provider, normalize to discovered units, and surface unavailable providers as a typed skip.
 *   API guide: discoverUnits returns units or throws ProviderUnavailableError for a caller-visible skip.
 *   Worked example: const units = await discoverUnits(content, profile);
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getWasmPath } from "tree-sitter-wasm";
import { Language, Parser, Query } from "web-tree-sitter";

/**
 * Raised when a declared provider or its dependency cannot be used.
 */
export class ProviderUnavailableError extends Error {
	/**
	 * @param {string} message - Human-readable reason.
	 */
	constructor(message) {
		super(message);
		this.name = "ProviderUnavailableError";
	}
}

const IDENTIFIER_TYPES = new Set([
	"identifier",
	"name",
	"constant",
	"variable",
	"simple_identifier",
	"type_identifier",
	"property_identifier",
	"scalar",
	"string_scalar",
]);

let parserInit = null;
const languageCache = new Map();

/**
 * Load and cache one Tree-sitter grammar for unit and naming checks.
 *
 * @param {string} grammar (in) - Installed grammar name, for example "lua".
 *
 * @returns {Promise<object>} The shared loaded language; callers must not delete it.
 * @throws {Error} When parser initialization or grammar loading fails. Grammar
 * load failures are not cached; parser initialization is shared across calls.
 *
 * @example
 * ```js
 * await loadGrammar("rust") === await loadGrammar("rust"); // true
 * ```
 */
export async function loadGrammar(grammar) {
	parserInit ??= Parser.init();
	await parserInit;
	if (!languageCache.has(grammar)) {
		languageCache.set(grammar, await Language.load(getWasmPath(grammar)));
	}
	return languageCache.get(grammar);
}

/**
 * Derives a display name from a syntax node.
 *
 * @param {object} node - Tree-sitter node.
 * @returns {string} The node's name field or first identifier text.
 */
function nodeName(node) {
	const name = node.childForFieldName("name");
	if (name) return name.text;
	const stack = [...node.namedChildren];
	while (stack.length > 0) {
		const child = stack.shift();
		if (IDENTIFIER_TYPES.has(child.type)) return child.text;
		stack.unshift(...child.namedChildren);
	}
	return "<anonymous>";
}

/**
 * Discovers units with the tree-sitter provider.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile declaring grammar and query.
 * @returns {Promise<Array<{kind: string, name: string, line: number, endLine: number, offset: number, exported: boolean}>>} Discovered units.
 */
async function discoverWithTreeSitter(content, profile) {
	let querySource;
	try {
		querySource = readFileSync(join(profile.root, profile.units.query), "utf8");
	} catch (error) {
		throw new ProviderUnavailableError(
			`units query ${profile.units.query} is unreadable (${error.code ?? error.message})`,
		);
	}
	let language;
	try {
		language = await loadGrammar(profile.units.grammar);
	} catch (error) {
		throw new ProviderUnavailableError(
			`grammar ${profile.units.grammar} is unavailable: ${error.message}`,
		);
	}
	const parser = new Parser();
	let tree;
	try {
		parser.setLanguage(language);
		tree = parser.parse(content);
		if (!tree)
			throw new ProviderUnavailableError("parser returned no syntax tree");
		const query = new Query(language, querySource);
		const units = [];
		for (const match of query.matches(tree.rootNode)) {
			for (const capture of match.captures) {
				if (capture.name !== "unit") continue;
				const node = capture.node;
				units.push({
					kind: node.type,
					name: nodeName(node),
					line: node.startPosition.row + 1,
					endLine: node.endPosition.row + 1,
					offset: node.startIndex,
					exported: true,
				});
			}
		}
		query.delete?.();
		return units;
	} finally {
		tree?.delete();
		parser.delete();
	}
}

/**
 * Discovers units with the regex provider.
 *
 * The profile declares `pattern` (capture group 1 names the unit) and optional
 * `flags` and `kind`.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile declaring the pattern.
 * @returns {Promise<Array<{kind: string, name: string, line: number, endLine: number, offset: number, exported: boolean}>>} Discovered units.
 */
async function discoverWithRegex(content, profile) {
	const { pattern, flags = "gm", kind = "unit" } = profile.units;
	if (typeof pattern !== "string" || pattern === "")
		throw new ProviderUnavailableError("regex provider declares no pattern");
	const expression = new RegExp(pattern, flags);
	const units = [];
	for (const match of content.matchAll(expression)) {
		const name = match[1];
		if (!name) continue;
		const offset = match.index;
		units.push({
			kind,
			name,
			line: content.slice(0, offset).split("\n").length,
			endLine: content.slice(0, offset + match[0].length).split("\n").length,
			offset,
			exported: true,
		});
	}
	return units;
}

/**
 * Discovers units for one profile through its declared provider.
 *
 * Phase 1 ships tree-sitter and regex; npm and external-command land with their
 * first consuming packs.
 *
 * @param {string} content - Complete candidate content.
 * @param {object} profile - Loaded profile.
 * @returns {Promise<Array<{kind: string, name: string, line: number, endLine: number, offset: number, exported: boolean}>>} Discovered units.
 * @throws {ProviderUnavailableError} When the declared provider cannot run.
 */
export async function discoverUnits(content, profile) {
	let units;
	switch (profile.units.provider) {
		case "tree-sitter":
			units = await discoverWithTreeSitter(content, profile);
			break;
		case "regex":
			units = await discoverWithRegex(content, profile);
			break;
		default:
			throw new ProviderUnavailableError(
				`provider ${profile.units.provider} is not available in this build`,
			);
	}
	// A profile may exclude discovered names, such as Python's underscore
	// convention for private definitions, without the query needing predicates.
	const exclude = profile.units.excludeNamePattern;
	if (typeof exclude === "string" && exclude !== "") {
		const expression = new RegExp(exclude, "u");
		units = units.filter((unit) => !expression.test(unit.name));
	}
	return units;
}
