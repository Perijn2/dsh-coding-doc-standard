/**
 * @module checker-tests
 * @author Perijn Huijser
 * Exercises source and Docker Compose documentation-policy fixtures.
 *
 * @remarks
 * Usage:
 *   Core principle: Test the pure checker through its public command-line boundary.
 *   Setup: Run with Node's built-in test runner and a Python 3 interpreter.
 *   Workflow: Feed candidate content over standard input and assert checker status.
 *   API guide: Each test documents one required profile behavior.
 *   Worked example: npm test
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checker = join(root, "src", "hook", "checker.py");
const python = process.platform === "win32" ? "py" : "python3";
const baseArgs = process.platform === "win32" ? ["-3"] : [];
const policyDirectory = mkdtempSync(
	join(tmpdir(), "coding-doc-standard-policy-"),
);
const enabledPolicyPath = join(policyDirectory, "first-batch.json");
const enabledPolicy = JSON.parse(
	readFileSync(join(root, "src", "policy", "defaults.json"), "utf8"),
);
for (const language of ["go", "csharp", "java", "kotlin", "shell"])
	enabledPolicy.languages[language] = true;
writeFileSync(enabledPolicyPath, `${JSON.stringify(enabledPolicy)}\n`, "utf8");

/**
 * Runs the policy checker with one candidate fixture.
 *
 * @param {string} path - Candidate fixture path.
 * @param {string} content - Complete candidate content.
 * @returns {number} Checker status code.
 */
function check(path, content, policyPath) {
	const args = [...baseArgs, checker, path];
	if (policyPath) args.push("--policy", policyPath);
	args.push("--stdin");
	return spawnSync(python, args, {
		input: content,
		encoding: "utf8",
	}).status;
}

test("accepts a documented Docker Compose file", () => {
	const content = `# Author: Perijn Huijser
# Summary: Starts the local application stack.
#
# Usage:
#   Core principle: Services communicate on an isolated network.
#   Setup: Configure the environment before startup.
#   Workflow: Start app and then stop the stack.
#   API guide: Use app for local development.
#   Worked example: docker compose up app
services:
  # Summary: Runs the local application server.
  app:
    image: example/app
`;
	assert.equal(check("compose.yaml", content), 0);
});

test("blocks a Compose service without a summary comment", () => {
	const content = `# Author: Perijn Huijser
# Summary: Starts the local application stack.
# Usage:
#   Core principle: Services communicate on an isolated network.
#   Setup: Configure the environment before startup.
#   Workflow: Start app and then stop the stack.
#   API guide: Use app for local development.
#   Worked example: docker compose up app
services:
  app:
    image: example/app
`;
	assert.equal(check("compose.yml", content), 2);
});

test("blocks an incomplete Compose root header", () => {
	const content = `# Author: Perijn Huijser
# Summary: Starts the local application stack.
services:
  # Summary: Runs the local application server.
  app:
    image: example/app
`;
	assert.equal(check("docker-compose.yaml", content), 2);
});

test("ignores unrelated YAML files", () => {
	assert.equal(check("application.yaml", "enabled: true\n"), 0);
});

test("accepts documented public Python units", () => {
	const content = `"""Author: Perijn Huijser
Summary: Demonstrates a documented Python module.

Usage:
    Core principle: Keep behavior explicit.
    Setup: Import the module.
    Workflow: Call value.
    API guide: value returns a stable integer.
    Worked example: value()
"""

def value():
    """Return a stable integer."""
    return 1
`;
	assert.equal(check("example.py", content), 0);
});

test("blocks undocumented public Python units", () => {
	const content = `"""Author: Perijn Huijser
Summary: Demonstrates a documented Python module.

Usage:
    Core principle: Keep behavior explicit.
    Setup: Import the module.
    Workflow: Call value.
    API guide: value returns a stable integer.
    Worked example: value()
"""

def value():
    return 1
`;
	assert.equal(check("example.py", content), 2);
});

test("accepts a documented TypeScript module header", () => {
	const content = `/**
 * @module example
 * @author Perijn Huijser
 * Demonstrates module documentation.
 *
 * Usage:
 *   Core principle: Keep behavior explicit.
 */
export const value = 1
`;
	assert.equal(check("example.ts", content), 0);
});

const FIRST_BATCH_HEADERS = [
	[
		"example.go",
		`// Author: Perijn Huijser
// Summary: Demonstrates a documented Go package.
// Usage: Import the package from a caller.
package example
`,
	],
	[
		"Example.cs",
		`/// @author Perijn Huijser
/// Usage: Demonstrates a documented C# source file.
public sealed class Example {}
`,
	],
	[
		"Example.java",
		`/**
 * @author Perijn Huijser
 * Usage: Demonstrates a documented Java source file.
 */
class Example {}
`,
	],
	[
		"Example.kt",
		`/**
 * @author Perijn Huijser
 * Usage: Demonstrates a documented Kotlin source file.
 */
class Example
`,
	],
	[
		"script.sh",
		`#!/usr/bin/env bash
# Author: Perijn Huijser
# Summary: Demonstrates a documented shell script.
# Usage: Run the script with its supported arguments.
printf '%s\\n' example
`,
	],
	[
		"script.bash",
		`# Author: Perijn Huijser
# Summary: Demonstrates a documented Bash script.
# Usage: Source or execute the script as documented.
printf '%s\\n' example
`,
	],
];

test("accepts enabled first-batch language headers", () => {
	for (const [path, content] of FIRST_BATCH_HEADERS)
		assert.equal(check(path, content, enabledPolicyPath), 0, path);
});

test("blocks enabled first-batch language files without headers", () => {
	for (const [path] of FIRST_BATCH_HEADERS)
		assert.equal(check(path, "value\n", enabledPolicyPath), 2, path);
});

test("bypasses disabled first-batch language profiles", () => {
	for (const [path] of FIRST_BATCH_HEADERS)
		assert.equal(check(path, "value\n"), 0, path);
});

test("supports the documented first-batch preambles only", () => {
	const go = `//go:build linux

// Author: Perijn Huijser
// Summary: Documents a build-constrained Go package.
// Usage: Import the package on supported hosts.
package example
`;
	const python = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Author: Perijn Huijser
Summary: Documents a shebang Python module.

Usage: Import the module from a caller.
"""
`;
	const node = `#!/usr/bin/env node
/**
 * @author Perijn Huijser
 * Usage: Documents a shebang JavaScript module.
 */
export {};
`;
	assert.equal(check("example.go", go, enabledPolicyPath), 0);
	assert.equal(check("example.py", python), 0);
	assert.equal(check("example.mjs", node), 0);
});

test("leaves unsupported extensions and preambles outside the first batch", () => {
	const header = `/**
 * @author Perijn Huijser
 * Usage: Demonstrates a structural header.
 */
`;
	assert.equal(check("script.kts", "value\n", enabledPolicyPath), 0);
	assert.equal(check("script.csx", "value\n", enabledPolicyPath), 0);
	assert.equal(check("script", "value\n", enabledPolicyPath), 0);
	assert.equal(
		check(
			"Example.java",
			`@Deprecated\n${header}class Example {}\n`,
			enabledPolicyPath,
		),
		2,
	);
	assert.equal(
		check(
			"Example.kt",
			`@file:Suppress("unused")\n${header}class Example\n`,
			enabledPolicyPath,
		),
		2,
	);
	assert.equal(
		check(
			"Example.cs",
			`#nullable enable\n${header}public class Example {}\n`,
			enabledPolicyPath,
		),
		2,
	);
});

test.after(() => rmSync(policyDirectory, { recursive: true, force: true }));
