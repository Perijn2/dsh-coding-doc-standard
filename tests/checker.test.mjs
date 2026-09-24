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
const enabledPolicyPath = join(policyDirectory, "all-languages.json");
const disabledPolicyPath = join(policyDirectory, "disabled-languages.json");
const enabledPolicy = JSON.parse(
	readFileSync(join(root, "src", "policy", "defaults.json"), "utf8"),
);
const additionalLanguages = [
	"go",
	"csharp",
	"java",
	"kotlin",
	"shell",
	"php",
	"ruby",
	"swift",
	"dart",
	"haskell",
	"lua",
	"scala",
];
const disabledPolicy = structuredClone(enabledPolicy);
for (const language of additionalLanguages)
	disabledPolicy.languages[language] = false;
writeFileSync(enabledPolicyPath, `${JSON.stringify(enabledPolicy)}\n`, "utf8");
writeFileSync(
	disabledPolicyPath,
	`${JSON.stringify(disabledPolicy)}\n`,
	"utf8",
);

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

test("enforces documentation for TypeScript and JavaScript module variants", () => {
	const content = `/**
 * @module example
 * @author Perijn Huijser
 * Documents a source module variant.
 *
 * Usage: Import the module from a supported caller.
 */
export const value = 1;
`;
	for (const path of [
		"example.tsx",
		"example.mts",
		"example.cts",
		"example.jsx",
	])
		assert.equal(check(path, content), 0, path);
});

test("enforces the C/C++ Doxygen file and public API contract", () => {
	const content = `/**
 * @file calculator.h
 * @author Perijn Huijser
 * @brief Declares calculator operations.
 *
 * Usage:
 *   Core principle: Keep arithmetic behind a small API.
 *   Setup: Include calculator.h.
 *   Workflow: Pass operands and use the returned result.
 *   API guide: add returns the sum of its operands.
 *   Worked example: add(1, 2) returns 3.
 */

/**
 * @brief Adds two integers.
 *
 * @param[in] left First operand.
 * @param[in] right Second operand.
 *
 * @return The sum of both operands.
 */
int add(int left, int right);
`;
	assert.equal(check("calculator.h", content), 0);
});

test("blocks incomplete C/C++ Doxygen API contracts", () => {
	const content = `/**
 * @file calculator.c
 * @author Perijn Huijser
 * @brief Declares calculator operations.
 *
 * Usage:
 *   Core principle: Keep arithmetic behind a small API.
 *   Setup: Include calculator.c.
 *   Workflow: Pass operands and use the returned result.
 *   API guide: add returns a result.
 *   Worked example: Call add with two operands.
 */
int add(int left, int right);
`;
	assert.equal(check("calculator.c", content), 2);
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
	[
		"Example.php",
		`<?php
/**
 * @author Perijn Huijser
 * Usage: Demonstrates a documented PHP source file.
 */
final class Example {}
`,
	],
	[
		"example.rb",
		`#!/usr/bin/env ruby
# Author: Perijn Huijser
# Summary: Demonstrates a documented Ruby source file.
# Usage: Require or execute the file as documented.
puts "example"
`,
	],
	[
		"Example.swift",
		`/// Author: Perijn Huijser
/// Summary: Demonstrates a documented Swift source file.
/// Usage: Import the module from a supported caller.
struct Example {}
`,
	],
	[
		"example.dart",
		`/// Author: Perijn Huijser
/// Summary: Demonstrates a documented Dart source file.
/// Usage: Import the library from a supported caller.
class Example {}
`,
	],
	[
		"Example.hs",
		`{-# LANGUAGE OverloadedStrings #-}

-- | Author: Perijn Huijser
-- Summary: Demonstrates a documented Haskell module.
-- Usage: Import the module from a supported caller.
module Example where
`,
	],
	[
		"example.lua",
		`--- Author: Perijn Huijser
--- Summary: Demonstrates a documented Lua module.
--- Usage: Require the module from a supported caller.
return {}
`,
	],
	[
		"Example.scala",
		`/**
 * @author Perijn Huijser
 * Usage: Demonstrates a documented Scala source file.
 */
object Example
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

test("bypasses explicitly disabled language profiles", () => {
	for (const [path] of FIRST_BATCH_HEADERS)
		assert.equal(check(path, "value\n", disabledPolicyPath), 0, path);
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

test("leaves unsupported extensions and preambles outside header-only batches", () => {
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

test("rejects unsupported PHP, Ruby, Swift, and Dart preambles when enabled", () => {
	const php = `<?php
/**
 * @author Perijn Huijser
 * Usage: Documents a PHP header.
 */
`;
	const ruby = `# Author: Perijn Huijser
# Summary: Documents a Ruby header.
# Usage: Require the file from a caller.
`;
	const slash = `/// Author: Perijn Huijser
/// Summary: Documents a source header.
/// Usage: Import the module from a caller.
`;
	assert.equal(check("template.phtml", "value\n", enabledPolicyPath), 0);
	assert.equal(
		check("Example.swiftinterface", "value\n", enabledPolicyPath),
		0,
	);
	assert.equal(check("example.g.dart", "value\n", enabledPolicyPath), 0);
	assert.equal(
		check(
			"Example.php",
			`<?php\ndeclare(strict_types=1);\n${php}`,
			enabledPolicyPath,
		),
		2,
	);
	assert.equal(
		check("Example.php", `#!/usr/bin/env php\n${php}`, enabledPolicyPath),
		2,
	);
	assert.equal(
		check(
			"example.rb",
			`# frozen_string_literal: true\n${ruby}`,
			enabledPolicyPath,
		),
		2,
	);
	assert.equal(
		check(
			"example.rb",
			`#!/usr/bin/env ruby\n# encoding: utf-8\n${ruby}`,
			enabledPolicyPath,
		),
		2,
	);
	assert.equal(
		check(
			"Example.swift",
			`import Foundation\n${slash}struct Example {}\n`,
			enabledPolicyPath,
		),
		2,
	);
	assert.equal(
		check(
			"example.dart",
			`import "dart:core";\n${slash}class Example {}\n`,
			enabledPolicyPath,
		),
		2,
	);
});

test("rejects unsupported Haskell, Lua, and Scala preambles when enabled", () => {
	const haskell = `-- | Author: Perijn Huijser
-- Summary: Documents a Haskell module.
-- Usage: Import the module from a caller.
module Example where
`;
	const lua = `--- Author: Perijn Huijser
--- Summary: Documents a Lua module.
--- Usage: Require the module from a caller.
`;
	const scala = `/**
 * @author Perijn Huijser
 * Usage: Documents a Scala source file.
 */
`;
	assert.equal(check("Example.lhs", "value\n", enabledPolicyPath), 0);
	assert.equal(check("example.luau", "value\n", enabledPolicyPath), 0);
	assert.equal(check("Example.sc", "value\n", enabledPolicyPath), 0);
	assert.equal(
		check(
			"Example.hs",
			`{-# OPTIONS_GHC -Wall #-}\n${haskell}`,
			enabledPolicyPath,
		),
		2,
	);
	assert.equal(
		check("example.lua", `#!/usr/bin/env lua\n${lua}`, enabledPolicyPath),
		2,
	);
	assert.equal(
		check("example.lua", lua.replaceAll("---", "--"), enabledPolicyPath),
		2,
	);
	assert.equal(
		check(
			"Example.scala",
			`//> using scala "3.3.0"\n${scala}object Example\n`,
			enabledPolicyPath,
		),
		2,
	);
});

test.after(() => rmSync(policyDirectory, { recursive: true, force: true }));
