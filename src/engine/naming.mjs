/**
 * @module naming
 * Check identifier naming through language-pack syntax queries.
 */

import { Parser, Query } from "web-tree-sitter";
import { loadGrammar, ProviderUnavailableError } from "./providers.mjs";

// ponytail: casing only; semantic language tooling is needed for acronym and legacy API policy.
const styles = {
	snake_case:
		/^[\p{Ll}\p{Lo}\p{Lm}\p{N}\p{M}]+(?:_[\p{Ll}\p{Lo}\p{Lm}\p{N}\p{M}]+)*$/u,
	UpperCamelCase: /^[\p{Lu}\p{Lt}\p{Lo}][\p{L}\p{N}\p{M}]*$/u,
	lowerCamelCase: /^[\p{Ll}\p{Lo}][\p{L}\p{N}\p{M}]*$/u,
	SCREAMING_SNAKE_CASE:
		/^[\p{Lu}\p{Lt}\p{Lo}\p{Lm}\p{N}\p{M}]+(?:_[\p{Lu}\p{Lt}\p{Lo}\p{Lm}\p{N}\p{M}]+)*$/u,
	MixedCaps: /^[\p{L}][\p{L}\p{N}\p{M}]*$/u,
	lowercase: /^[\p{Ll}\p{Lo}\p{Lm}\p{N}\p{M}]+$/u,
};

function exempt(node, ancestors) {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (ancestors.includes(parent.type)) return true;
	}
	return false;
}

function identifier(node, grammar) {
	if (/string|quoted|literal/.test(node.type)) return null;
	let name = node.text;
	if (grammar === "rust") name = name.replace(/^r#/, "");
	if (grammar === "c_sharp") name = name.replace(/^@/, "");
	if (
		["swift", "kotlin", "scala"].includes(grammar) &&
		name.startsWith("`") &&
		name.endsWith("`")
	)
		return null;
	if (grammar === "ruby") name = name.replace(/[!?]$/, "");
	return name.replace(/^_+|_+$/g, "");
}

/**
 * Return naming violations for declarations selected by syntax queries.
 *
 * @param content (in) - Complete source text; never changed.
 * @param profile (in) - Optional naming object with informational source string,
 * grammar name and rules. Each rule has an inline query capturing @name, a style
 * (snake_case, UpperCamelCase, lowerCamelCase, SCREAMING_SNAKE_CASE, MixedCaps,
 * lowercase), optional label, excludeNamePattern (Unicode regexp on raw names),
 * skipAncestors (syntax node types), and excludeQuery (inline query capturing
 * exempt names as @name). A match capturing @exclude is exempt.
 *
 * @returns One-based line/message findings, sorted by line and deduplicated;
 * absent naming returns an empty array. Strings and underscore-only names are
 * ignored, as are backtick-escaped Swift/Kotlin/Scala identifiers. Surrounding
 * underscores, Rust r#, C# @ and Ruby !/? do not affect casing.
 *
 * @throws {ProviderUnavailableError} When configuration, grammar, query or
 * parsing cannot be used. Inputs stay unchanged; parser, tree and queries are
 * released even on failure. Profile queries and exclusion regexps are trusted
 * configuration; source text is parsed rather than scanned for declarations.
 *
 * @example
 * ```js
 * await checkNaming("anything", {}); // []
 * ```
 */
export async function checkNaming(content, profile) {
	const naming = profile?.naming;
	if (naming == null) return [];
	let parser;
	let tree;
	try {
		if (
			typeof naming.source !== "string" ||
			typeof naming.grammar !== "string" ||
			!Array.isArray(naming.rules)
		) {
			throw new Error("expected naming source, grammar and rules");
		}
		const rules = naming.rules.map((rule) => {
			if (
				typeof rule.query !== "string" ||
				!Object.hasOwn(styles, rule.style) ||
				(rule.label !== undefined && typeof rule.label !== "string") ||
				(rule.excludeQuery !== undefined &&
					typeof rule.excludeQuery !== "string") ||
				(rule.excludeNamePattern !== undefined &&
					typeof rule.excludeNamePattern !== "string") ||
				(rule.skipAncestors !== undefined &&
					(!Array.isArray(rule.skipAncestors) ||
						rule.skipAncestors.some((type) => typeof type !== "string")))
			) {
				throw new Error("invalid naming rule");
			}
			return {
				...rule,
				exclude:
					rule.excludeNamePattern === undefined
						? null
						: new RegExp(rule.excludeNamePattern, "u"),
			};
		});
		const language = await loadGrammar(naming.grammar);
		parser = new Parser();
		parser.setLanguage(language);
		tree = parser.parse(content);
		if (!tree) throw new Error("parser returned no syntax tree");
		const findings = [];
		const seen = new Set();
		for (const rule of rules) {
			const excluded = new Set();
			if (rule.excludeQuery !== undefined) {
				let exclusion;
				try {
					exclusion = new Query(language, rule.excludeQuery);
					if (!exclusion.captureNames.includes("name"))
						throw new Error("naming excludeQuery must capture @name");
					for (const capture of exclusion.captures(tree.rootNode)) {
						if (capture.name === "name")
							excluded.add(
								`${capture.node.startIndex}:${capture.node.endIndex}`,
							);
					}
				} finally {
					exclusion?.delete();
				}
			}
			let query;
			try {
				query = new Query(language, rule.query);
				if (!query.captureNames.includes("name"))
					throw new Error("naming query must capture @name");
				for (const match of query.matches(tree.rootNode)) {
					if (match.captures.some((capture) => capture.name === "exclude"))
						continue;
					for (const { name: capture, node } of match.captures) {
						if (
							capture !== "name" ||
							excluded.has(`${node.startIndex}:${node.endIndex}`) ||
							rule.exclude?.test(node.text) ||
							exempt(node, rule.skipAncestors ?? [])
						)
							continue;
						const name = identifier(node, naming.grammar);
						if (!name || styles[rule.style].test(name)) continue;
						const line = node.startPosition.row + 1;
						const message = `${rule.label ?? "Identifier"} '${node.text}' must use ${rule.style}. See ${naming.source}.`;
						const key = `${line}:${message}`;
						if (!seen.has(key)) {
							seen.add(key);
							findings.push({ line, message });
						}
					}
				}
			} finally {
				query?.delete();
			}
		}
		return findings.sort((left, right) => left.line - right.line);
	} catch (error) {
		throw new ProviderUnavailableError(
			`naming checker unavailable: ${error.message}`,
		);
	} finally {
		try {
			tree?.delete();
		} finally {
			parser?.delete();
		}
	}
}
