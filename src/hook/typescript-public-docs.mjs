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

const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs"]);

function scriptKind(path) {
	return (
		{
			".ts": ts.ScriptKind.TS,
			".js": ts.ScriptKind.JS,
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
