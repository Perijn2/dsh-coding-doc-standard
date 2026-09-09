/**
 * @module doxygen-tests
 * @author Perijn Huijser
 * Verifies pinned Doxygen project-level documentation validation.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise the verifier through the project-owned fixture
 *   instead of inventing throwaway documentation configuration.
 *   Setup: Provision the native Doxygen tool before running the positive test.
 *   Workflow: Run the verify command against the fixture Doxyfile and assert the
 *   required warning policy is enforced.
 *   API guide: The positive test skips only when the optional native tool is
 *   unprovisioned; the policy test always runs.
 *   Worked example: npm run provision-tools && npm test
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveDoxygenBinary } from "../src/policy/platform.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(root, "tests", "fixtures", "cpp-doxygen");
const tools = JSON.parse(
	readFileSync(join(root, "src", "policy", "tools.json"), "utf8"),
);
const toolsRoot = join(
	homedir(),
	".dsh",
	"plugins",
	"coding-doc-standard",
	"tools",
);
const doxygen = resolveDoxygenBinary(toolsRoot, tools.doxygen);

/**
 * Runs the repository verify command with the given arguments.
 *
 * @param {string[]} args - Arguments passed to scripts/verify.mjs.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} Spawn result.
 */
function runVerify(args) {
	return spawnSync(
		process.execPath,
		[join(root, "scripts", "verify.mjs"), ...args],
		{
			cwd: root,
			encoding: "utf8",
		},
	);
}

test("verifies the C++ fixture through the pinned Doxygen binary", {
	skip: !doxygen || !existsSync(doxygen),
}, () => {
	const result = runVerify(["--doxygen", join(fixture, "Doxyfile")]);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("resolves a relative Doxyfile path after changing the working directory", {
	skip: !doxygen || !existsSync(doxygen),
}, () => {
	const result = runVerify([
		"--doxygen",
		join("tests", "fixtures", "cpp-doxygen", "Doxyfile"),
	]);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("rejects a Doxyfile without the required warning policy", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "coding-doc-standard-doxyfile-"),
	);
	try {
		const doxyfile = join(directory, "Doxyfile");
		await writeFile(
			doxyfile,
			`PROJECT_NAME = "Weak Policy Fixture"
INPUT = ${fixture}
GENERATE_HTML = YES
WARN_IF_UNDOCUMENTED = YES
EXTRACT_ALL = YES
`,
			"utf8",
		);
		const result = runVerify(["--doxygen", doxyfile]);
		assert.notEqual(result.status, 0);
		assert.match(
			`${result.stdout}${result.stderr}`,
			/WARN_IF_DOC_ERROR|WARN_AS_ERROR/,
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
