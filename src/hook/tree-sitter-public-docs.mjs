/**
 * @module tree-sitter-public-docs
 * @author Perijn Huijser
 * Enforces native documentation on structurally recognized declarations.
 *
 * @remarks
 * Usage:
 *   Core principle: Parse pending source in memory through one shared baseline.
 *   Setup: Call checkTreeSitterPublicUnits with a candidate and effective policy.
 *   Workflow: Select a grammar, collect configured declarations, bind adjacent
 *   native comments, and report missing documentation.
 *   API guide: checkTreeSitterPublicUnits returns normalized diagnostics.
 *   Worked example: await checkTreeSitterPublicUnits(candidate, policy)
 */

import { extname } from "node:path";
import { getWasmPath } from "tree-sitter-wasm";
import { Language, Parser } from "web-tree-sitter";

const FUNCTION_SCOPES = new Set([
	"anonymous_function",
	"closure_expression",
	"function_body",
	"function_declaration",
	"function_definition",
	"lambda_expression",
	"method",
	"method_declaration",
]);
const IDENTIFIERS = new Set([
	"constant",
	"constructor",
	"identifier",
	"name",
	"simple_identifier",
	"type_identifier",
	"variable",
]);

const PROFILES = {
	go: profile("go", [".go"], "go", {
		function_declaration: "function",
		method_declaration: "method",
		type_spec: "type",
		const_spec: "constant",
		var_spec: "variable",
	}),
	csharp: profile("c_sharp", [".cs"], "slash", {
		class_declaration: "class",
		struct_declaration: "struct",
		interface_declaration: "interface",
		enum_declaration: "enum",
		record_declaration: "record",
		delegate_declaration: "delegate",
		method_declaration: "method",
		constructor_declaration: "constructor",
		property_declaration: "property",
		indexer_declaration: "indexer",
		field_declaration: "field",
		event_declaration: "event",
		event_field_declaration: "event",
	}),
	java: profile("java", [".java"], "block", {
		class_declaration: "class",
		interface_declaration: "interface",
		enum_declaration: "enum",
		record_declaration: "record",
		annotation_type_declaration: "annotation",
		method_declaration: "method",
		constructor_declaration: "constructor",
		field_declaration: "field",
		constant_declaration: "constant",
	}),
	kotlin: profile("kotlin", [".kt", ".kts"], "block", {
		class_declaration: "class",
		object_declaration: "object",
		function_declaration: "function",
		property_declaration: "property",
		type_alias: "type alias",
		secondary_constructor: "constructor",
	}),
	shell: profile("bash", [".sh", ".bash"], "hash", {
		function_definition: "function",
	}),
	php: profile("php", [".php"], "block", {
		class_declaration: "class",
		interface_declaration: "interface",
		trait_declaration: "trait",
		enum_declaration: "enum",
		function_definition: "function",
		method_declaration: "method",
		property_declaration: "property",
		const_declaration: "constant",
	}),
	ruby: profile("ruby", [".rb"], "hash", {
		class: "class",
		module: "module",
		method: "method",
		singleton_method: "singleton method",
	}),
	swift: profile("swift", [".swift"], "slashOrBlock", {
		class_declaration: "class",
		struct_declaration: "struct",
		protocol_declaration: "protocol",
		enum_declaration: "enum",
		extension_declaration: "extension",
		function_declaration: "function",
		init_declaration: "initializer",
		deinit_declaration: "deinitializer",
		property_declaration: "property",
		typealias_declaration: "type alias",
		subscript_declaration: "subscript",
	}),
	dart: profile("dart", [".dart"], "slashOrBlock", {
		class_definition: "class",
		mixin_declaration: "mixin",
		enum_declaration: "enum",
		extension_declaration: "extension",
		type_alias: "type alias",
		function_signature: "function",
		method_signature: "method",
		constructor_signature: "constructor",
		declaration: "declaration",
	}),
	haskell: profile("haskell", [".hs"], "haddock", {
		function: "function",
		signature: "signature",
		data_type: "data type",
		newtype: "newtype",
		type_synonym: "type synonym",
		class: "class",
	}),
	lua: profile("lua", [".lua"], "lua", {
		function_declaration: "function",
	}),
	scala: profile("scala", [".scala", ".sc"], "block", {
		class_definition: "class",
		object_definition: "object",
		trait_definition: "trait",
		enum_definition: "enum",
		function_definition: "function",
		function_declaration: "function",
		val_definition: "value",
		var_definition: "variable",
		type_definition: "type",
	}),
};

function profile(grammar, extensions, docStyle, declarations) {
	return { grammar, extensions, docStyle, declarations };
}

const BY_EXTENSION = new Map(
	Object.entries(PROFILES).flatMap(([language, value]) =>
		value.extensions.map((extension) => [extension, { language, ...value }]),
	),
);
let initialization;
const languageCache = new Map();

async function loadLanguage(profileValue) {
	initialization ??= Parser.init();
	await initialization;
	if (!languageCache.has(profileValue.grammar)) {
		languageCache.set(
			profileValue.grammar,
			await Language.load(getWasmPath(profileValue.grammar)),
		);
	}
	return languageCache.get(profileValue.grammar);
}

function walk(node, visit) {
	visit(node);
	for (const child of node.namedChildren) walk(child, visit);
}

function firstIdentifier(node) {
	const named = node.childForFieldName("name");
	if (named) return named.text;
	let result;
	walk(node, (child) => {
		if (!result && child !== node && IDENTIFIERS.has(child.type))
			result = child.text;
	});
	return result ?? "<anonymous>";
}

function isNested(node) {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (FUNCTION_SCOPES.has(parent.type)) return true;
	}
	return false;
}

function kindFor(node, profileValue) {
	const kind = profileValue.declarations[node.type];
	if (!kind || isNested(node)) return null;
	if (
		node.type === "declaration" &&
		node.parent?.type !== "program" &&
		node.parent?.type !== "class_body"
	)
		return null;
	return kind;
}

function leadingHeaderEnd(source) {
	const preamble =
		source.match(/^(?:\uFEFF)?(?:#![^\n]*\r?\n)?(?:\s*<\?php\s*)?/u)?.[0] ?? "";
	const tail = source.slice(preamble.length);
	const header = tail.match(
		/^\s*(\/\*\*[\s\S]*?\*\/|(?:(?:\/\/\/|\/\/|#|---|--\s*\|)[^\n]*(?:\r?\n|$))+|\{-[\s\S]*?-\})/u,
	);
	return header ? preamble.length + header[0].length : -1;
}

function attachedDocumentation(source, startIndex, style) {
	const before = source.slice(0, startIndex).replace(/[ \t]+$/u, "");
	const patterns = {
		block: /(\/\*\*(?:(?!\/\*\*)[\s\S])*?\*\/)[ \t]*(?:\r?\n)?[ \t]*$/u,
		slash: /((?:[ \t]*\/\/\/[^\n]*(?:\r?\n|$))+)[ \t]*$/u,
		slashOrBlock:
			/(\/\*\*[\s\S]*?\*\/|(?:[ \t]*\/\/\/[^\n]*(?:\r?\n|$))+)[ \t]*$/u,
		go: /((?:[ \t]*\/\/[^\n]*(?:\r?\n|$))+|\/\*[^*][\s\S]*?\*\/)[ \t]*$/u,
		hash: /((?:[ \t]*#[^!\n][^\n]*(?:\r?\n|$))+)[ \t]*$/u,
		haddock:
			/((?:[ \t]*--\s*\|[^\n]*(?:\r?\n|$)(?:[ \t]*--[^\n]*(?:\r?\n|$))*)|\{-\|[\s\S]*?-\})[ \t]*$/u,
		lua: /((?:[ \t]*---[^\n]*(?:\r?\n|$))+)[ \t]*$/u,
	};
	const match = before.match(patterns[style]);
	return match ? { start: before.length - match[0].length } : null;
}

/**
 * Checks configured module declarations and direct type members.
 *
 * @param {{path: string, content: string}} candidate - Pending source candidate.
 * @param {Record<string, unknown>} policy - Effective documentation policy.
 * @returns {Promise<string[]>} Diagnostics for missing native documentation.
 */
export async function checkTreeSitterPublicUnits(candidate, policy) {
	const selected = BY_EXTENSION.get(extname(candidate.path).toLowerCase());
	if (
		!selected ||
		policy.languages?.[selected.language] === false ||
		policy.publicUnitDocs?.[selected.language] !== true
	)
		return [];
	if (
		selected.language === "dart" &&
		candidate.path.toLowerCase().endsWith(".g.dart")
	)
		return [];
	const language = await loadLanguage(selected);
	const parser = new Parser();
	let tree;
	try {
		parser.setLanguage(language);
		tree = parser.parse(candidate.content);
		if (!tree) throw new Error("parser returned no syntax tree");
		const headerEnd = leadingHeaderEnd(candidate.content);
		const violations = [];
		walk(tree.rootNode, (node) => {
			const kind = kindFor(node, selected);
			if (!kind) return;
			const documentation = attachedDocumentation(
				candidate.content,
				node.startIndex,
				selected.docStyle,
			);
			if (documentation && documentation.start >= headerEnd) return;
			violations.push(
				`${candidate.path}:${node.startPosition.row + 1} [doc-standard] Missing native documentation for ${kind} '${firstIdentifier(node)}'.`,
			);
		});
		return violations;
	} catch (error) {
		return [
			`${candidate.path}:1 [doc-standard] Tree-sitter ${selected.language} analysis failed: ${error.message}`,
		];
	} finally {
		tree?.delete();
		parser.delete();
	}
}
