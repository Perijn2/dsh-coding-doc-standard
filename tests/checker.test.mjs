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
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checker = join(root, "src", "hook", "checker.py");
const python = process.platform === "win32" ? "py" : "python3";
const baseArgs = process.platform === "win32" ? ["-3"] : [];

/**
 * Runs the policy checker with one candidate fixture.
 *
 * @param {string} path - Candidate fixture path.
 * @param {string} content - Complete candidate content.
 * @returns {number} Checker status code.
 */
function check(path, content) {
	return spawnSync(python, [...baseArgs, checker, path, "--stdin"], {
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
