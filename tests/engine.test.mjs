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
import test from "node:test";
import {
	decodeDocument,
	decodeUnitDoc,
	skipPreamble,
} from "../src/engine/codec.mjs";
import { checkDocumentation } from "../src/engine/contract.mjs";
import { packCoverageFor, validateWithPacks } from "../src/engine/index.mjs";
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

test("missing required header fields each produce a named finding", () => {
	const decoded = {
		header: {},
		unit_docs: {},
		header_present: false,
		header_line: 1,
	};
	const findings = checkDocumentation(decoded, []);
	const messages = findings.map((finding) => finding.message).join("\n");
	for (const field of ["author", "summary", "description"])
		assert.match(messages, new RegExp(field, "i"));
});

test("usage must reference a discovered unit when present", async () => {
	const profile = lua.profiles.get("modern");
	const content =
		"--- Author: X\n--- Summary: S.\n--- Description: D.\n--- Usage: Call add.\n\nfunction add() end\n";
	const units = await discoverUnits(content, profile);
	assert.equal(units.length, 1);
	const good = decodeDocument(content, profile, units);
	assert.equal(checkDocumentation(good, units).length, 0);
	const bad = decodeDocument(
		"--- Author: X\n--- Summary: S.\n--- Description: D.\n--- Usage: Call subtract.\n\nfunction add() end\n",
		profile,
		units,
	);
	assert.ok(
		checkDocumentation(bad, units).some((finding) =>
			finding.message.includes("Usage"),
		),
	);
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
		"--- @param left First operand.",
		"--- @param right Second operand.",
		"--- @return The integer sum of both operands.",
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

test("an undocumented lua candidate is denied through its pack", async () => {
	const coverage = packCoverageFor("example.lua");
	const lines = await validateWithPacks(
		{
			path: "example.lua",
			content: "local M = {}\n\nfunction M.add(a, b) return a + b end\n",
		},
		coverage,
	);
	assert.ok(
		lines.length >= 3,
		`expected header and unit findings, got: ${lines.join("\n")}`,
	);
	assert.ok(lines.every((line) => line.includes("[doc-standard]")));
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
	const profile = lua.profiles.get("modern");
	assert.equal(
		profile.formatter,
		undefined,
		"the lua pack declares no formatter",
	);
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
