/**
 * @module typescript-public-docs
 * @author Perijn Huijser
 * Parses direct TypeScript and JavaScript exports for attached native JSDoc.
 *
 * Usage:
 *   Core principle: Inspect only the pending source text and never resolve a
 *   project program, re-export graph, or type-derived API surface.
 *   Setup: Enable publicUnitDocs.typescriptJavascript in policy.
 *   Workflow: Parse a candidate with the pinned TypeScript compiler API, then
 *   return violations for direct exported declarations without attached JSDoc.
 */

import { extname } from "node:path";
import * as ts from "typescript";

const SUPPORTED_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".mts",
	".cts",
	".js",
	".jsx",
	".mjs",
	".cjs",
]);

function scriptKind(path) {
	return (
		{
			".ts": ts.ScriptKind.TS,
			".tsx": ts.ScriptKind.TSX,
			".mts": ts.ScriptKind.TS,
			".cts": ts.ScriptKind.TS,
			".js": ts.ScriptKind.JS,
			".jsx": ts.ScriptKind.JSX,
			".mjs": ts.ScriptKind.JS,
			".cjs": ts.ScriptKind.JS,
		}[extname(path).toLowerCase()] ?? ts.ScriptKind.Unknown
	);
}

function hasModifier(node, modifier) {
	return Boolean(node.modifiers?.some((item) => item.kind === modifier));
}

function exported(node) {
	return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function declarationName(node, fallback = "default") {
	return node.name?.getText() || fallback;
}

function declarationKind(node) {
	if (ts.isClassDeclaration(node)) return "class";
	if (ts.isEnumDeclaration(node)) return "enum";
	if (ts.isFunctionDeclaration(node)) return "function";
	if (ts.isInterfaceDeclaration(node)) return "interface";
	if (ts.isTypeAliasDeclaration(node)) return "type alias";
	return "declaration";
}

function hasAttachedJSDoc(source, node) {
	const start = node.getStart(source);
	const ranges =
		ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
	const last = ranges.at(-1);
	const comment = last ? source.text.slice(last.pos, last.end) : "";
	if (!comment.startsWith("/**") || !comment.includes("\n")) return false;
	const gap = source.text.slice(last.end, start);
	return /^\s*$/.test(gap) && !/\n\s*\n/.test(gap);
}

function documentationText(source, node) {
	const ranges =
		ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
	const last = ranges.at(-1);
	return last ? source.text.slice(last.pos, last.end) : "";
}

/**
 * Finds the end of one balanced brace or bracket group at the start of text.
 *
 * @param {string} text - Tag remainder that begins with a brace or bracket.
 * @returns {number} Index just past the matching closer.
 */
function skipBalanced(text) {
	const opener = text[0];
	const closer = opener === "{" ? "}" : "]";
	let depth = 0;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === opener) depth += 1;
		else if (char === closer) {
			depth -= 1;
			if (depth === 0) return index + 1;
		}
	}
	return text.length;
}

/**
 * Collects parameter names documented by `@param` tags in one documentation block.
 *
 * Accepts the TSDoc `@param name` form, the JSDoc typed `@param {Type} name`
 * form, and optional brackets in either position, including types whose own
 * text contains braces.
 *
 * @param {string} documentation - Raw JSDoc or TSDoc block text.
 * @returns {Set<string>} Documented parameter names found in the block.
 */
export function documentedParameterNames(documentation) {
	const names = new Set();
	if (!documentation) return names;
	const body = documentation.replace(/^\/\*\*?/, "").replace(/\*\/\s*$/, "");
	for (const rawLine of body.split(/\r?\n/)) {
		let line = rawLine.replace(/^\s*\*+/, "").trim();
		const tag = /^@(?:param|argument|arg)\b/.exec(line);
		if (!tag) continue;
		line = line.slice(tag[0].length).trim();
		while (line.startsWith("{")) line = line.slice(skipBalanced(line)).trim();
		const named = /^\[?\s*([A-Za-z_$][\w$]*)/.exec(line);
		if (named) names.add(named[1]);
	}
	return names;
}

function contractViolations(source, node) {
	if (!ts.isFunctionDeclaration(node)) return [];
	const documentation = documentationText(source, node);
	const documented = documentedParameterNames(documentation);
	const line =
		source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
	const failures = [];
	for (const parameter of node.parameters) {
		const name = parameter.name.getText(source).replace(/^\.{3}/, "");
		if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
		if (!documented.has(name))
			failures.push({
				line,
				message: `Missing @param documentation for exported parameter '${name}'.`,
			});
	}
	const tag = node.asteriskToken ? "@yields" : "@returns";
	if (
		node.asteriskToken ||
		(node.type !== undefined && node.type.kind !== ts.SyntaxKind.VoidKeyword)
	) {
		if (!documentation.includes(tag))
			failures.push({
				line,
				message: `Missing ${tag} documentation for exported function '${declarationName(node)}'.`,
			});
	}
	return failures;
}
function violation(source, node, kind, name) {
	const position = source.getLineAndCharacterOfPosition(node.getStart(source));
	return {
		line: position.line + 1,
		message: `Missing JSDoc for exported ${kind} '${name}'.`,
	};
}

/**
 * Checks direct exported TypeScript or JavaScript declarations for JSDoc.
 *
 * @param {{path: string, content: string}} candidate - Pending source candidate.
 * @param {Record<string, unknown>} policy - Effective documentation policy.
 * @returns {{line: number, message: string}[]} Source-only public-unit violations.
 */
export function checkTypescriptPublicUnits(candidate, policy) {
	if (!policy.publicUnitDocs?.typescriptJavascript) return [];
	if (policy.languages?.typescriptJavascript === false) return [];
	if (!SUPPORTED_EXTENSIONS.has(extname(candidate.path).toLowerCase()))
		return [];
	const source = ts.createSourceFile(
		candidate.path,
		candidate.content,
		ts.ScriptTarget.Latest,
		true,
		scriptKind(candidate.path),
	);
	const violations = [];
	for (const statement of source.statements) {
		if (!exported(statement)) continue;
		if (
			ts.isClassDeclaration(statement) ||
			ts.isEnumDeclaration(statement) ||
			ts.isFunctionDeclaration(statement) ||
			ts.isInterfaceDeclaration(statement) ||
			ts.isTypeAliasDeclaration(statement)
		) {
			if (!hasAttachedJSDoc(source, statement))
				violations.push(
					violation(
						source,
						statement,
						declarationKind(statement),
						declarationName(statement),
					),
				);
			else violations.push(...contractViolations(source, statement));
			continue;
		}
		if (
			!ts.isVariableStatement(statement) ||
			hasAttachedJSDoc(source, statement)
		)
			continue;
		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name))
				violations.push(
					violation(source, declaration, "variable", declaration.name.text),
				);
		}
	}
	return violations;
}
