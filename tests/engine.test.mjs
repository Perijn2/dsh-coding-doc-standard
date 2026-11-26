/**
 * @module engine-tests
 * @author Perijn Huijser
 * Verifies the language pack registry, codec, contract engine, providers, and gate integration.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise the pack architecture through its public engine boundary with real fixtures.
 *   Setup: Run with Node's built-in test runner from the package root.
 *   Workflow: Load the Lua pilot pack, decode and check fixtures, and drive the gate end to end.
 *   API guide: Covers registry exclusion, codec preamble and fields, contract findings, providers, and gate routing.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import schemastery from "@deepseek-ai/schemastery";
import {
	decodeDocument,
	decodeUnitDoc,
	skipPreamble,
} from "../src/engine/codec.mjs";
import { checkDocumentation } from "../src/engine/contract.mjs";
import {
	checkFormatting,
	formatterDeclarationFor,
} from "../src/engine/formatters.mjs";
import { packCoverageFor, validateWithPacks } from "../src/engine/index.mjs";
import {
	packProfileEnabled,
	packSettingsApply,
	packSettingsFields,
	packSettingsSource,
} from "../src/engine/pack-settings.mjs";
import { resolveProfile, versionSatisfies } from "../src/engine/profiles.mjs";
import {
	discoverUnits,
	ProviderUnavailableError,
} from "../src/engine/providers.mjs";
import { getRegistry, loadPacks } from "../src/engine/registry.mjs";

const registry = getRegistry();
const lua = registry.packs.get("lua");

test("loads the lua pilot pack with its modern profile", () => {
	assert.ok(lua, "the lua pack must register");
	assert.equal(lua.manifest.label, "Lua");
	assert.equal(lua.defaultProfile, "modern");
	const profile = lua.profiles.get("modern");
	assert.deepEqual(profile.extensions, [".lua"]);
	assert.equal(profile.units.provider, "tree-sitter");
});

test("excludes broken packs with a reason", () => {
	assert.ok(registry.excluded.length >= 0);
	const { packs, excluded } = loadPacks();
	assert.ok(packs.has("lua"));
	for (const entry of excluded) assert.ok(entry.reason.length > 0);
});

test("skips the declared preamble before the header", () => {
	const profile = lua.profiles.get("modern");
	const withShebang = "#!/usr/bin/env lua\n--- Author: X\n";
	const without = "--- Author: X\n";
	assert.equal(
		skipPreamble(withShebang, profile).offset,
		"#!/usr/bin/env lua\n".length,
	);
	assert.equal(skipPreamble(without, profile).offset, 0);
});

test("decodes declared field spellings into universal names", () => {
	const profile = lua.profiles.get("modern");
	const content = [
		"--- Author: Perijn Huijser",
		"--- Summary: Adds numbers for callers.",
		"--- Description: A tiny module used to verify decoding.",
		"--- Usage: Call add with two integers.",
		"",
		"return {}",
	].join("\n");
	const decoded = decodeDocument(content, profile);
	assert.equal(decoded.header.author, "Perijn Huijser");
	assert.equal(decoded.header.summary, "Adds numbers for callers.");
	assert.equal(
		decoded.header.description,
		"A tiny module used to verify decoding.",
	);
	assert.equal(decoded.header.usage, "Call add with two integers.");
	assert.equal(decoded.header_present, true);
});

test("a multi-sentence brief summary passes the contract", () => {
	const profile = lua.profiles.get("modern");
	const content = [
		"--- Author: X",
		"--- Summary: Adds numbers. Handles negatives. Never rounds.",
		"--- Description: Small helper.",
		"",
		"return {}",
	].join("\n");
	const decoded = decodeDocument(content, profile);
	const findings = checkDocumentation(decoded, []);
	assert.equal(
		findings.some((finding) => finding.message.includes("Summary")),
		false,
	);
});

test("a missing summary produces a named finding; author is optional", () => {
	const decoded = {
		header: {},
		unit_docs: {},
		header_present: false,
		header_line: 1,
	};
	const findings = checkDocumentation(decoded, []);
	assert.equal(findings.length, 1, "only the summary is gate-required");
	assert.match(findings[0].message, /summary/i);
	assert.doesNotMatch(findings[0].message, /author/i);
});

test("a Usage section carries no checking obligation", async () => {
	const profile = lua.profiles.get("modern");
	const content =
		"--- Author: X\n--- Summary: S.\n--- Usage: Call subtract.\n\nfunction add() end\n";
	const units = await discoverUnits(content, profile);
	assert.equal(units.length, 1);
	const decoded = decodeDocument(content, profile, units);
	assert.equal(decoded.header.usage, "Call subtract.");
	assert.equal(checkDocumentation(decoded, units, profile).length, 0);
});

test("tree-sitter provider discovers lua functions through the pack query", async () => {
	const profile = lua.profiles.get("modern");
	const content =
		"local M = {}\n\nfunction M.add(a, b) return a + b end\n\nreturn M\n";
	const units = await discoverUnits(content, profile);
	assert.equal(units.length, 1);
	assert.equal(units[0].kind, "function_declaration");
	assert.match(units[0].name, /add/);
});

test("regex provider discovers units from declared patterns", async () => {
	const profile = {
		units: {
			provider: "regex",
			pattern: "^function\\s+([A-Za-z_][\\w.]*)",
			flags: "gm",
			kind: "function",
		},
	};
	const units = await discoverUnits(
		"function one() end\nfunction two() end\n",
		profile,
	);
	assert.deepEqual(
		units.map((unit) => unit.name),
		["one", "two"],
	);
});

test("an unavailable provider surfaces a typed skip", async () => {
	const profile = { units: { provider: "npm", package: "@nowhere/missing" } };
	await assert.rejects(discoverUnits("x", profile), ProviderUnavailableError);
});

test("a documented lua candidate passes the gate through its pack", async () => {
	const content = [
		"--- Author: Perijn Huijser",
		"--- Summary: Demonstrates a documented Lua module.",
		"--- Description: Exercises the pack engine end to end with one function.",
		"--- Usage: Call add with two integers to get their sum.",
		"",
		"local M = {}",
		"",
		"--- Adds two integers and writes the sum.",
		"--- @param left  (in) number: first operand",
		"--- @param right (in) number: second operand",
		"--- @return number: the integer sum of both operands",
		"function M.add(left, right)",
		"\treturn left + right",
		"end",
		"",
		"return M",
	].join("\n");
	const coverage = packCoverageFor("example.lua");
	assert.ok(coverage, "lua files must be covered by the pack");
	const lines = await validateWithPacks(
		{ path: "example.lua", content },
		coverage,
	);
	assert.deepEqual(lines, []);
});

test("a declared parameter entry without a direction marker is denied", async () => {
	const coverage = packCoverageFor("example.lua");
	const lines = await validateWithPacks(
		{
			path: "example.lua",
			content: [
				"--- Author: Perijn Huijser",
				"--- Summary: Demonstrates a documented Lua module.",
				"",
				"--- Adds two integers.",
				"--- @param left number: first operand",
				"--- @param right (in) number: second operand",
				"function M.add(left, right) return left + right end",
				"",
				"return M",
			].join("\n"),
		},
		coverage,
	);
	assert.equal(lines.length, 1);
	assert.match(lines[0], /missing a direction marker/);
	assert.match(lines[0], /left number: first operand/);
});

test("an undocumented lua candidate is denied through its pack", async () => {
	const coverage = packCoverageFor("example.lua");
	const lines = await validateWithPacks(
		{
			path: "example.lua",
			content: "local M = {}\n\nfunction M.add(a, b) return a + b end\n",
		},
		coverage,
	);
	// The summary header field and the undocumented unit are the findings;
	// Author is optional since VCS owns authorship.
	assert.equal(lines.length, 2, `got: ${lines.join("\n")}`);
	assert.ok(lines.every((line) => line.includes("[doc-standard]")));
});

test("python units enforce docstrings while underscore names stay private", async () => {
	const path = "pkg/widgets.py";
	const coverage = packCoverageFor(path);
	const header = '"""Author: Ada Lovelace\nSummary: Counts widgets.\n"""\n';
	const privateOnly = await validateWithPacks(
		{ path, content: `${header}\n\ndef _helper():\n    return 1\n` },
		coverage,
	);
	assert.deepEqual(
		privateOnly,
		[],
		"an underscore name is private and needs no document",
	);
	const undocumented = await validateWithPacks(
		{ path, content: `${header}\n\ndef compute():\n    return 2\n` },
		coverage,
	);
	assert.equal(undocumented.length, 1);
	assert.match(
		undocumented[0],
		/Missing unit documentation for 'compute'/u,
		"a public unit without a docstring is denied",
	);
	const documented = await validateWithPacks(
		{
			path,
			content: `${header}\n\ndef compute():\n    """Summary: Doubles the input."""\n    return 2\n`,
		},
		coverage,
	);
	assert.deepEqual(documented, []);
});

test("compose services each need a summary comment", async () => {
	const path = "deploy/compose.yaml";
	const coverage = packCoverageFor(path);
	const lines = await validateWithPacks(
		{
			path,
			content:
				"# Author: Ada Lovelace\n# Summary: Runs the demo stack.\n\nservices:\n  # Summary: Serves the site.\n  web:\n    image: nginx\n  worker:\n    image: nginx\n",
		},
		coverage,
	);
	assert.equal(lines.length, 1, lines.join("\n"));
	assert.match(
		lines[0],
		/Missing unit documentation for 'worker'/u,
		"a service without a summary comment is denied",
	);
});

test("profile resolution prefers pins over detection over defaults", () => {
	const pinned = resolveProfile(lua, { profilePins: { lua: "modern" } });
	assert.equal(pinned.resolution.source, "pin");
	const detected = resolveProfile(lua, {}, { detectedVersion: "5.4" });
	assert.equal(detected.resolution.source, "detect");
	assert.equal(versionSatisfies("5.4", ">=5.1"), true);
	assert.equal(versionSatisfies("5.0", ">=5.1"), false);
	const fallback = resolveProfile(lua, {});
	assert.equal(fallback.resolution.source, "default");
	assert.equal(fallback.profile.id, lua.defaultProfile);
});

test("a pack without a formatter runs no formatting pass", async () => {
	assert.equal(
		lua.profiles.get("modern").formatter,
		undefined,
		"the lua pack declares no formatter",
	);
	const result = await checkFormatting(
		{ path: "example.lua", content: "return 1\n" },
		{ formatOnWrite: true },
	);
	assert.equal(
		result,
		null,
		"no formatter declaration means no formatting pass",
	);
});

test("formatter-only packs with a codec own the file header", () => {
	const python = registry.packs.get("python");
	assert.ok(python, "the python formatter pack registers");
	const profile = python.profiles.get("modern");
	assert.equal(profile.formatterOnly, true);
	const coverage = packCoverageFor("example.py");
	assert.equal(
		coverage?.profile.codec.headerSyntax,
		"docstring",
		"a codec declaration gives the formatter pack header coverage",
	);
	assert.ok(registry.packs.get("docker-compose"));
	assert.ok(
		packCoverageFor("compose.yaml"),
		"filename-matched packs gain header coverage through their codec",
	);
});

test("the stdin-binary adapter declarations resolve for embedded packs", () => {
	const ruff = formatterDeclarationFor("example.py");
	assert.equal(ruff.formatter.adapter, "stdin-binary");
	assert.equal(ruff.formatter.dependency.source, "legacy-engine-tools");
	const biome = formatterDeclarationFor("example.ts");
	assert.equal(biome.formatter.adapter, "stdin-binary");
	assert.equal(biome.formatter.checkMode, "stdout-diff");
	const prettier = formatterDeclarationFor("a/compose.yaml");
	assert.ok(prettier, "compose filenames must resolve");
	assert.equal(prettier.formatter.checkMode, "stdout-diff");
});

test("settings surface renders one group per installed pack", () => {
	const fields = packSettingsFields(schemastery, {});
	const packIds = Object.keys(fields.dict ?? {});
	for (const expected of [
		"lua",
		"python",
		"typescript-javascript",
		"docker-compose",
	])
		assert.ok(packIds.includes(expected), `missing pack group ${expected}`);
	const source = packSettingsSource({});
	assert.equal(source.lua.modern, true);
	const applied = packSettingsApply({ lua: { modern: false } }, {});
	assert.equal(applied.lua.modern, false);
	assert.equal(
		packProfileEnabled({ packProfiles: applied }, "lua", "modern"),
		false,
		"a disabled profile must not enforce",
	);
});

test("settings surface renders stale policy packs as not installed", () => {
	const fields = packSettingsFields(schemastery, {
		packProfiles: { "gone-pack": { modern: false } },
	});
	assert.ok(fields.dict["gone-pack"], "stale pack entries must render");
});

test("unit doc decoding extracts summary and sections", () => {
	const profile = lua.profiles.get("modern");
	const content = [
		"--- Adds two integers.",
		"--- @param left First operand.",
		"--- @param right Second operand.",
		"--- @return The sum.",
		"function add(left, right) end",
	].join("\n");
	const offset = content.indexOf("function add");
	const doc = decodeUnitDoc(content, offset, profile);
	assert.equal(doc.summary, "Adds two integers.");
	assert.equal(doc.sections.parameters.length, 2);
	assert.equal(doc.sections.returns[0], "The sum.");
});

const pythonProfile = registry.packs.get("python").profiles.get("modern");
const tsProfile = registry.packs
	.get("typescript-javascript")
	.profiles.get("modern");

test("block syntax decodes tagged and unlabeled header prose", () => {
	const content = [
		"/**",
		" * @module hidden",
		" * @author Ada Lovelace",
		" * Reads manifests without opening them.",
		" *",
		" * @remarks",
		" * Grammar is pack data; the engine never learns a language.",
		" */",
		"export const value = 1;",
	].join("\n");
	const decoded = decodeDocument(content, tsProfile);
	assert.equal(decoded.header_present, true);
	assert.equal(decoded.header.author, "Ada Lovelace");
	assert.ok(decoded.header.summary.startsWith("Reads manifests"));
});

test("unknown tags decode as no content and plain prose routes to the declared field", () => {
	const decoded = decodeDocument(
		"/**\n * @module hidden\n * @author Ada Lovelace\n * Reads manifests.\n */\n",
		tsProfile,
	);
	assert.equal(decoded.header.summary, "Reads manifests.");
});

test("an unterminated block header is no header at all", () => {
	const decoded = decodeDocument(
		"/**\n * @author Ada Lovelace\n * Summary: S.\n",
		tsProfile,
	);
	assert.equal(decoded.header_present, false);
});

test("docstring syntax decodes labeled fields behind prefixes and comments", () => {
	const plain = decodeDocument(
		'"""Author: Ada Lovelace\nSummary: Sums numbers.\n"""\nVALUE = 1\n',
		pythonProfile,
	);
	assert.equal(plain.header.author, "Ada Lovelace");
	assert.equal(plain.header.summary, "Sums numbers.");
	const rawForm = decodeDocument(
		"r'''Author: Ada Lovelace\nSummary: Reads raw text.\n'''\nVALUE = 1\n",
		pythonProfile,
	);
	assert.equal(rawForm.header.summary, "Reads raw text.");
	const afterEncoding = decodeDocument(
		'#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n"""Author: Ada Lovelace\nSummary: Declares an encoding.\n"""\nVALUE = 1\n',
		pythonProfile,
	);
	assert.equal(afterEncoding.header.summary, "Declares an encoding.");
});

test("the required summary is reported by its first declared spelling", () => {
	const empty = {
		header: {},
		unit_docs: {},
		header_present: false,
		header_line: 1,
	};
	const tsMessages = checkDocumentation(empty, [], tsProfile).map(
		(finding) => finding.message,
	);
	assert.deepEqual(tsMessages, ["Missing 'Summary:' in file header"]);
	const pythonMessages = checkDocumentation(empty, [], pythonProfile).map(
		(finding) => finding.message,
	);
	assert.deepEqual(pythonMessages, ["Missing 'Summary:' in file header"]);
});

test("an alternate declared spelling satisfies a field", () => {
	const decoded = decodeDocument(
		"/**\n * Author: Ada Lovelace\n * Summary: Reads prose forms.\n */\n",
		tsProfile,
	);
	assert.equal(decoded.header.author, "Ada Lovelace");
	assert.equal(checkDocumentation(decoded, [], tsProfile).length, 0);
});

test("every pack decodes its own golden example without findings", async () => {
	for (const pack of registry.packs.values()) {
		const profile = pack.profiles.get(pack.defaultProfile);
		assert.ok(
			profile.codec,
			`${pack.manifest.id} must declare the doc syntax it teaches`,
		);
		const skillDirectory = join(pack.directory, "skill");
		const examples = existsSync(skillDirectory)
			? readdirSync(skillDirectory).filter((name) =>
					name.toLowerCase().startsWith("example."),
				)
			: [];
		assert.ok(
			examples.length > 0,
			`${pack.manifest.id} must ship skill/example.* as its golden header`,
		);
		for (const name of examples) {
			const content = readFileSync(join(skillDirectory, name), "utf8");
			const units = profile.units ? await discoverUnits(content, profile) : [];
			assert.deepEqual(
				checkDocumentation(
					decodeDocument(content, profile, units),
					units,
					profile,
				),
				[],
				`${pack.manifest.id}/${name} must satisfy its own standard`,
			);
		}
	}
});
