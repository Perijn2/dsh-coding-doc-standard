/**
 * @module pack-probe
 * @author Perijn Huijser
 * Exercises one candidate path against the installed pack registry from the command line.
 *
 * @remarks
 * Usage:
 *   Core principle: Pack builders verify declarations through the same engine the gate uses.
 *   Setup: Run from the repository root with Node.
 *   Workflow: Resolve pack coverage for the logical path, apply it to the content file, and print findings, units, or the syntax tree.
 *   API guide: Default mode prints coverage and findings; --units lists discovered units; --tree prints the grammar tree.
 *   Worked example: node scripts/dev/pack-probe.mjs --units a.py fixture.py
 */

import { readFileSync } from "node:fs";
import { getWasmPath } from "tree-sitter-wasm";
import { Language, Parser } from "web-tree-sitter";
import { packCoverageFor, validateWithPacks } from "../../src/engine/index.mjs";
import { discoverUnits } from "../../src/engine/providers.mjs";

const argv = process.argv.slice(2);
const modes = new Set(["--units", "--tree"]);
const flags = argv.filter((value) => modes.has(value));
const [logicalPath, contentFile] = argv.filter((value) => !modes.has(value));
if (!logicalPath || !contentFile) {
	console.error(
		"usage: pack-probe.mjs [--units|--tree] <logical-path> <content-file>",
	);
	process.exit(64);
}
const content = readFileSync(contentFile, "utf8");
const coverage = packCoverageFor(logicalPath);
if (!coverage) {
	console.log("coverage: none");
	process.exit(0);
}
console.log(
	`coverage: ${coverage.pack.manifest.id}/${coverage.profile.id} units=${coverage.profile.units?.provider ?? "none"}`,
);
if (flags.includes("--tree") && coverage.profile.units?.grammar) {
	await Parser.init();
	const parser = new Parser();
	parser.setLanguage(
		await Language.load(getWasmPath(coverage.profile.units.grammar)),
	);
	const tree = parser.parse(content);
	console.log(tree.rootNode.toString().slice(0, 8000));
	tree.delete();
	parser.delete();
}
if (flags.includes("--units") && coverage.profile.units) {
	for (const unit of await discoverUnits(content, coverage.profile))
		console.log(`unit: ${unit.kind} ${unit.name} line=${unit.line}`);
}
for (const line of await validateWithPacks(
	{ path: logicalPath, content },
	coverage,
))
	console.log(line);
