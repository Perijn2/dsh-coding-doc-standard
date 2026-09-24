/**
 * @module hook-runner
 * @author Perijn Huijser
 * Builds pending candidates, enforces pinned fast formatting, and checks documentation.
 *
 * @remarks
 * Usage:
 *   Core principle: Validate exactly the candidate text a write or edit would
 *   create, never stale disk content or formatter-mutated files.
 *   Setup: The native DSH guard invokes this file with a pending tool payload;
 *   provision package tools before enabling formatting.
 *   Workflow: Parse a tool payload, build its candidate, check its pinned
 *   formatter, then invoke the Python documentation checker.
 *   API guide: Use candidateFromPayload and checkFormatting in integration tests;
 *   use runHook as the hook-process entry point.
 *   Worked example: echo '{"tool_input":{"file_path":"a.py","content":""}}' | node run.mjs
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkProjectPublicUnits } from "./public-unit-adapter.mjs";
import { checkTreeSitterPublicUnits } from "./tree-sitter-public-docs.mjs";
import { checkTypescriptPublicUnits } from "./typescript-public-docs.mjs";

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageRoot = dirname(sourceRoot);
const checker = join(sourceRoot, "hook", "checker.py");
const defaultsPolicy = join(sourceRoot, "policy", "defaults.json");
const durableRoot = join(homedir(), ".dsh", "plugins", "coding-doc-standard");
const durablePolicy = join(durableRoot, "policy.json");
const ruffVersion = "0.16.6";
const treeSitterLanguages = [
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

/**
 * Reads effective hook policy from durable state or package defaults.
 *
 * @returns {Record<string, unknown>} Effective policy object.
 */
export function loadPolicy() {
	const selected =
		process.env.CODING_DOC_STANDARD_POLICY ??
		(existsSync(durablePolicy) ? durablePolicy : defaultsPolicy);
	let policy;
	try {
		policy = JSON.parse(readFileSync(selected, "utf8"));
	} catch {
		policy = JSON.parse(readFileSync(defaultsPolicy, "utf8"));
	}
	policy.publicUnitDocs ??= {};
	for (const language of treeSitterLanguages) {
		policy.publicUnitDocs[language] = policy.languages?.[language] !== false;
	}
	return policy;
}
/**
 * Builds the proposed content from a DeepSeek Harness write or edit payload.
 *
 * @param {Record<string, unknown>} payload - Hook event payload.
 * @returns {Promise<{path: string, content: string}>} Candidate path and complete content.
 * @throws {Error} When the payload is unsupported or an edit cannot be applied exactly once.
 */
export async function candidateFromPayload(payload) {
	const input = payload.tool_input;
	if (!input || typeof input !== "object")
		throw new Error("tool_input must be an object");
	const path = input.file_path;
	if (typeof path !== "string" || !path)
		throw new Error("tool_input.file_path is required");
	if (typeof input.content === "string")
		return { path, content: input.content };
	if (
		typeof input.old_string !== "string" ||
		typeof input.new_string !== "string"
	) {
		throw new Error("expected write content or edit old_string/new_string");
	}
	const before = await readFile(path, "utf8");
	const count = before.split(input.old_string).length - 1;
	if (count !== 1)
		throw new Error(
			`edit old_string must match exactly once (matched ${count})`,
		);
	return { path, content: before.replace(input.old_string, input.new_string) };
}

/**
 * Identifies the pre-write formatter profile for a candidate path.
 *
 * @param {string} path - Candidate filesystem path.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {'python' | 'typescriptJavascript' | 'rust' | 'dockerCompose' | null} Formatter profile.
 */
export function formatterProfile(path, policy) {
	if (!policy.formatOnWrite) return null;
	const file = basename(path).toLowerCase();
	const extension = extname(file);
	if (extension === ".py" && policy.formatPython) return "python";
	if (
		[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"].includes(
			extension,
		) &&
		policy.formatTypescriptJavascript
	)
		return "typescriptJavascript";
	if (extension === ".rs" && policy.formatRust) return "rust";
	const patterns = policy.composePatterns ?? [];
	if (
		policy.formatDockerCompose &&
		patterns.some((pattern) => {
			const expression = `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`;
			return new RegExp(expression, "i").test(file);
		})
	)
		return "dockerCompose";
	return null;
}

function executable(name) {
	const suffix = process.platform === "win32" ? ".cmd" : "";
	return join(packageRoot, "node_modules", ".bin", `${name}${suffix}`);
}

function ruffExecutable() {
	const name = process.platform === "win32" ? "ruff.exe" : "ruff";
	return join(durableRoot, "tools", `ruff-${ruffVersion}`, "bin", name);
}

function execute(
	command,
	args,
	content,
	cwd,
	shell = process.platform === "win32",
) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
			shell,
		});
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.once("error", (error) =>
			resolve({ code: null, stdout, stderr, error }),
		);
		child.once("exit", (code) => resolve({ code, stdout, stderr }));
		child.stdin.end(content);
	});
}

/**
 * Checks a candidate against its configured pinned formatter without modifying files.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {Record<string, unknown>} [policy] - Effective policy override for testing.
 * @returns {Promise<string | null>} Blocking message, or null when formatting passes or is disabled.
 */
export async function checkFormatting(candidate, policy = loadPolicy()) {
	const profile = formatterProfile(candidate.path, policy);
	if (!profile) return null;
	const unavailable = (label) =>
		policy.blockOnMissingFormatter !== false
			? `[doc-standard] Required pinned formatter is unavailable: ${label}. Run npm run provision-tools.`
			: null;
	if (profile === "python") {
		const command = ruffExecutable();
		if (!existsSync(command)) return unavailable(`ruff ${ruffVersion}`);
		const result = await execute(
			command,
			["format", "--check", "--stdin-filename", candidate.path, "-"],
			candidate.content,
		);
		if (result.code === 0) return null;
		const output = (result.stderr || result.stdout).trim();
		return [
			`[doc-standard] Ruff ${ruffVersion} could not validate ${candidate.path}.`,
			`Executable: ${command}`,
			`Exit: ${result.code ?? "not started"}`,
			output ? `Formatter output:\n${output}` : "Formatter output: none.",
			result.error ? `Start error: ${result.error.message}` : null,
			"Remediation: run npm run provision-tools, then call format_code with language, file_path, and complete content.",
		]
			.filter(Boolean)
			.join("\n");
	}
	if (profile === "rust") {
		const command = process.platform === "win32" ? "rustfmt.exe" : "rustfmt";
		const result = await execute(
			command,
			["--emit", "stdout"],
			candidate.content,
			dirname(resolve(candidate.path)),
			false,
		);
		if (result.error?.code === "ENOENT") return unavailable("rustfmt");
		if (result.code !== 0) {
			const output = (result.stderr || result.stdout).trim();
			return [
				`[doc-standard] rustfmt could not format ${candidate.path}.`,
				`Executable: ${command}`,
				`Exit: ${result.code ?? "not started"}`,
				output ? `Formatter output:\n${output}` : "Formatter output: none.",
				result.error ? `Start error: ${result.error.message}` : null,
			]
				.filter(Boolean)
				.join("\n");
		}
		return result.stdout === candidate.content
			? null
			: `[doc-standard] ${candidate.path} must match rustfmt formatting.`;
	}
	const command = executable(
		profile === "typescriptJavascript" ? "biome" : "prettier",
	);
	const label =
		profile === "typescriptJavascript"
			? "@biomejs/biome 2.5.12"
			: "prettier 3.9.6";
	if (!existsSync(command)) return unavailable(label);
	const args =
		profile === "typescriptJavascript"
			? ["format", "--stdin-file-path", candidate.path]
			: ["--stdin-filepath", candidate.path];
	const result = await execute(command, args, candidate.content);
	if (result.code !== 0) {
		const output = (result.stderr || result.stdout).trim();
		const renderedArgs = args
			.map((argument) => JSON.stringify(argument))
			.join(" ");
		return [
			`[doc-standard] ${label} could not format ${candidate.path}.`,
			`Executable: ${command}`,
			`Arguments: ${renderedArgs}`,
			`Exit: ${result.code ?? "not started"}`,
			output ? `Formatter output:\n${output}` : "Formatter output: none.",
			result.error ? `Start error: ${result.error.message}` : null,
			"Remediation: run npm run provision-tools in coding-doc-standard, then call format_code with language, file_path, and complete content.",
		]
			.filter(Boolean)
			.join("\n");
	}
	return result.stdout === candidate.content
		? null
		: [
				`[doc-standard] ${candidate.path} must match ${label} formatting.`,
				`Managed executable: ${command}`,
				"Call format_code with the matching language, intended file_path, and complete pending content, then retry with formatted_content.",
			].join("\n");
}

/**
 * Runs the Python documentation checker for one pending candidate.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @returns {Promise<number>} Checker exit code.
 */
export function runChecker(candidate) {
	const python = process.platform === "win32" ? "py" : "python3";
	const policy =
		process.env.CODING_DOC_STANDARD_POLICY ??
		(existsSync(durablePolicy) ? durablePolicy : defaultsPolicy);
	const args =
		process.platform === "win32"
			? ["-3", checker, candidate.path, "--policy", policy, "--stdin"]
			: [checker, candidate.path, "--policy", policy, "--stdin"];
	return new Promise((resolve, reject) => {
		const child = spawn(python, args, {
			stdio: ["pipe", "inherit", "inherit"],
		});
		child.once("error", reject);
		child.once("exit", (code) => resolve(code ?? 1));
		child.stdin.end(candidate.content);
	});
}

/**
 * Checks source-only public-unit policies against one pending candidate.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {Record<string, unknown>} [policy] - Effective policy override for testing.
 * @returns {string[]} Blocking diagnostics for enabled source-only public-unit policies.
 */
export function checkSourcePublicUnits(candidate, policy = loadPolicy()) {
	return checkTypescriptPublicUnits(candidate, policy).map(
		(violation) =>
			`${candidate.path}:${violation.line} [doc-standard] ${violation.message}`,
	);
}

/**
 * Executes a hook payload and converts validation failures into blocking feedback.
 *
 * @param {Record<string, unknown>} payload - Hook event payload.
 * @returns {Promise<number>} Hook-compatible process status.
 */
export async function runHook(payload) {
	try {
		const candidate = await candidateFromPayload(payload);
		const policy = loadPolicy();
		const formattingFailure = await checkFormatting(candidate, policy);
		if (formattingFailure) {
			console.error(formattingFailure);
			return 2;
		}
		const checkerStatus = await runChecker(candidate);
		if (checkerStatus !== 0) return checkerStatus;
		const publicUnitViolations = checkSourcePublicUnits(candidate, policy);
		if (publicUnitViolations.length) {
			console.error(publicUnitViolations.join("\n"));
			return 2;
		}
		const treeSitterViolations = await checkTreeSitterPublicUnits(
			candidate,
			policy,
		);
		if (treeSitterViolations.length) {
			console.error(treeSitterViolations.join("\n"));
			return 2;
		}
		const projectViolations = await checkProjectPublicUnits(
			{ ...candidate, cwd: process.cwd() },
			policy,
		);
		if (projectViolations.length) {
			console.error(projectViolations.join("\n"));
			return 2;
		}
		return 0;
	} catch (error) {
		console.error(
			`[doc-standard] Cannot validate pending write: ${error.message}`,
		);
		return 2;
	}
}

if (
	process.argv[1] &&
	resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
	let raw = "";
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk) => {
		raw += chunk;
	});
	process.stdin.once("end", async () => {
		try {
			process.exitCode = await runHook(JSON.parse(raw));
		} catch {
			console.error("[doc-standard] Hook payload is not valid JSON");
			process.exitCode = 2;
		}
	});
}
