/**
 * @module doxygen-tests
 * @author Perijn Huijser
 * Verifies pinned Doxygen project-level documentation validation.
 *
 * @remarks
 * Usage:
 *   Core principle: Exercise the verifier through a minimal, project-owned
 *   Doxyfile without inventing application documentation configuration.
 *   Setup: Provision the native Doxygen tool before running this integration test.
 *   Workflow: Write a temporary Doxyfile, invoke the verify command, and assert
 *   that required warning policy is accepted.
 *   API guide: The test skips only when the optional native tool is unprovisioned.
 *   Worked example: npm run provision-tools && npm test
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const doxygen = join(
	homedir(),
	".dsh",
	"plugins",
	"coding-doc-standard",
	"tools",
	"doxygen-1.18.0",
	"doxygen.exe",
);

/**
 * Executes an action in a temporary directory and removes it afterwards.
 *
 * @param {(directory: string) => Promise<void>} action - Temporary-directory action.
 * @returns {Promise<void>} Completion after cleanup.
 */
async function withTemporaryDirectory(action) {
	const directory = await mkdtemp(
		join(tmpdir(), "coding-doc-standard-doxygen-"),
	);
	try {
		await action(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("verifies a Doxyfile with required warning policy", {
	skip: !existsSync(doxygen),
}, async () => {
	await withTemporaryDirectory(async (directory) => {
		const doxyfile = join(directory, "Doxyfile");
		await writeFile(
			join(directory, "example.cpp"),
			`/** @brief Returns the configured answer. */
int answer() { return 42; }
`,
			"utf8",
		);
		await writeFile(
			doxyfile,
			`PROJECT_NAME = "Documentation Standard Test"
INPUT = ${directory}
OUTPUT_DIRECTORY = ${join(directory, "output")}
GENERATE_HTML = YES
GENERATE_LATEX = NO
WARN_IF_UNDOCUMENTED = YES
WARN_IF_DOC_ERROR = YES
WARN_AS_ERROR = YES
EXTRACT_ALL = YES
`,
			"utf8",
		);
		const result = spawnSync(
			process.execPath,
			[join(root, "scripts", "verify.mjs"), "--doxygen", doxyfile],
			{
				cwd: root,
				encoding: "utf8",
			},
		);
		assert.equal(result.status, 0, result.stderr);
	});
});
