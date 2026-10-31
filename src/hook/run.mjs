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
 *   Workflow: Build the pending candidate, run every applicable check
 *   concurrently, then render all findings together in one response.
 *   API guide: The host imports buildCandidate, validateCandidate, and
 *   renderFindings and calls them in-process. candidateFromPayload and
 *   checkFormatting stay available for integration tests. runHook is the
 *   standalone hook-process entry point returning 0 for pass or skip, 2 for
 *   violations, and 3 for validator errors.
 *   Worked example: echo '{"tool_input":{"file_path":"a.py","content":""}}' | node run.mjs
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	formatterDeclarationFor,
	runFormatterAdapter,
} from "../engine/formatters.mjs";
import { packCoverageFor, validateWithPacks } from "../engine/index.mjs";
import { checkProjectPublicUnits } from "./public-unit-adapter.mjs";
import { checkTreeSitterPublicUnits } from "./tree-sitter-public-docs.mjs";
import { checkTypescriptPublicUnits } from "./typescript-public-docs.mjs";

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const checker = join(sourceRoot, "hook", "checker.py");
const defaultsPolicy = join(sourceRoot, "policy", "defaults.json");
const durableRoot = join(homedir(), ".dsh", "plugins", "coding-doc-standard");
const durablePolicy = join(durableRoot, "policy.json");
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
 * Paths exempt from pre-write validation unless a policy replaces them.
 *
 * Vendored, generated, minified, and lockfile paths are never a documentation
 * or formatting problem the agent can fix, so blocking them is pure friction.
 */
export const ignoredPathDefaults = [
	"**/node_modules/**",
	"**/bower_components/**",
	"**/vendor/**",
	"**/dist/**",
	"**/build/**",
	"**/out/**",
	"**/coverage/**",
	"**/.git/**",
	"**/.venv/**",
	"**/venv/**",
	"**/__pycache__/**",
	"**/.pytest_cache/**",
	"**/.mypy_cache/**",
	"**/.ruff_cache/**",
	"**/generated/**",
	"**/*.min.js",
	"**/*.min.css",
	"**/*.map",
	"**/*.d.ts",
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"uv.lock",
	"poetry.lock",
	"Cargo.lock",
	"go.sum",
	"Gemfile.lock",
];

const referenceByExtension = new Map([
	[".py", "python.md"],
	[".pyi", "python.md"],
	[".ts", "typescript-javascript.md"],
	[".tsx", "typescript-javascript.md"],
	[".mts", "typescript-javascript.md"],
	[".cts", "typescript-javascript.md"],
	[".js", "typescript-javascript.md"],
	[".jsx", "typescript-javascript.md"],
	[".mjs", "typescript-javascript.md"],
	[".cjs", "typescript-javascript.md"],
	[".rs", "rust.md"],
	[".c", "c-cpp.md"],
	[".h", "c-cpp.md"],
	[".cpp", "c-cpp.md"],
	[".cc", "c-cpp.md"],
	[".hpp", "c-cpp.md"],
	[".hxx", "c-cpp.md"],
	[".go", "go.md"],
	[".cs", "csharp.md"],
	[".java", "java.md"],
	[".kt", "kotlin.md"],
	[".kts", "kotlin.md"],
	[".php", "php.md"],
	[".rb", "ruby.md"],
	[".swift", "swift.md"],
	[".dart", "dart.md"],
	[".hs", "haskell.md"],
	[".lua", "lua.md"],
	[".scala", "scala.md"],
	[".sh", "shell.md"],
	[".bash", "shell.md"],
	[".ksh", "shell.md"],
	[".zsh", "shell.md"],
]);

/**
 * Normalizes a path for policy pattern matching.
 *
 * @param {string} path - Path using native or POSIX separators.
 * @returns {string} Slash-separated path without a leading `./` prefix.
 */
export function normalizePath(path) {
	return String(path).replaceAll("\\", "/").replace(/^\.\//, "");
}

/**
 * Converts a glob pattern into an anchored regular expression.
 *
 * `**` spans any number of path segments, `*` spans exactly one segment, and
 * `?` matches exactly one character inside a segment.
 *
 * @param {string} pattern - Glob pattern written with `/` separators.
 * @returns {RegExp} Expression anchored to the whole normalized path.
 */
export function globToRegExp(pattern) {
	const normalized = normalizePath(pattern);
	let body = "";
	for (let index = 0; index < normalized.length; index += 1) {
		const char = normalized[index];
		if (char === "*") {
			if (normalized[index + 1] === "*") {
				if (normalized[index + 2] === "/") {
					body += "(?:[^/]+/)*";
					index += 2;
				} else {
					body += ".*";
					index += 1;
				}
				continue;
			}
			body += "[^/]*";
			continue;
		}
		if (char === "?") {
			body += "[^/]";
			continue;
		}
		body += char.replace(/[.+^${}()|[\]\\/*?]/g, "\\$&");
	}
	return new RegExp(`^${body}$`);
}

/**
 * Decides whether a path is exempt from pre-write validation.
 *
 * A wildcarded pattern is matched against both the whole normalized path and the
 * basename, so `*.d.ts` exempts declaration files at any depth. A pattern
 * without wildcards additionally exempts any file below a directory of that name.
 * The built-in list always applies; a policy `ignoredPaths` list only adds to it,
 * so a custom pattern can never silently un-exempt vendored or generated code.
 *
 * @param {string} candidatePath - Path of the pending candidate.
 * @param {Record<string, unknown>} [policy] - Effective policy supplying `ignoredPaths`.
 * @returns {boolean} True when pre-write validation must be skipped.
 */
export function isIgnoredPath(candidatePath, policy = loadPolicy()) {
	const normalized = normalizePath(candidatePath);
	const configured = Array.isArray(policy?.ignoredPaths)
		? policy.ignoredPaths.map((entry) => String(entry))
		: [];
	const patterns = [...ignoredPathDefaults, ...configured];
	const file = normalized.split("/").pop() ?? normalized;
	const segments = normalized.split("/");
	return patterns.some((entry) => {
		const pattern = normalizePath(String(entry)).replace(/\/+$/, "");
		if (!pattern) return false;
		const expression = globToRegExp(pattern);
		if (expression.test(normalized) || expression.test(file)) return true;
		return !/[*?]/.test(pattern) && segments.includes(pattern);
	});
}

/**
 * Maps a candidate path onto the skill reference that documents its rules.
 *
 * @param {string} candidatePath - Path of the pending candidate.
 * @param {Record<string, unknown>} [policy] - Effective policy supplying compose patterns.
 * @returns {string | null} Reference filename, or null when none applies.
 */
export function referenceForPath(candidatePath, policy = {}) {
	const file = basename(normalizePath(candidatePath)).toLowerCase();
	const patterns = Array.isArray(policy.composePatterns)
		? policy.composePatterns
		: [];
	if (patterns.some((pattern) => globToRegExp(String(pattern)).test(file)))
		return "docker-compose.md";
	return referenceByExtension.get(extname(file)) ?? null;
}

/**
 * Counts non-overlapping occurrences of one literal needle.
 *
 * @param {string} text - Text to search.
 * @param {string} needle - Literal text to count.
 * @returns {number} Number of occurrences.
 */
function editMatchCount(text, needle) {
	return text.split(needle).length - 1;
}

/**
 * Applies one literal edit pair, tolerating line-ending drift.
 *
 * The exact bytes are tried first, so a normal edit keeps its exact behavior.
 * When the pair matches zero copies only because the file stores CRLF while
 * the pending pair uses LF (or the reverse), the match is retried in a
 * line-ending-normalized copy and the file's own dominant ending is restored,
 * so a legitimate edit is validated instead of silently skipped. `replaceAll`
 * permits and requires applying the pair to every occurrence.
 *
 * @param {string} before - Existing file content.
 * @param {string} oldString - Literal text to replace.
 * @param {string} newString - Replacement text.
 * @param {boolean} replaceAll - Replace every occurrence instead of one.
 * @returns {string | null} Edited content, or null when no single valid interpretation exists.
 */
function applyEditPair(before, oldString, newString, replaceAll) {
	const exact = editMatchCount(before, oldString);
	if (exact > 0 && (replaceAll || exact === 1))
		return replaceAll
			? before.split(oldString).join(newString)
			: before.replace(oldString, newString);
	const lineEnding = before.includes("\r\n") ? "\r\n" : "\n";
	const normalizedBefore = before.replace(/\r\n/g, "\n");
	const normalizedOld = oldString.replace(/\r\n/g, "\n");
	const normalizedNew = newString.replace(/\r\n/g, "\n");
	const tolerant = editMatchCount(normalizedBefore, normalizedOld);
	if (tolerant === 0 || (!replaceAll && tolerant > 1)) return null;
	const edited = replaceAll
		? normalizedBefore.split(normalizedOld).join(normalizedNew)
		: normalizedBefore.replace(normalizedOld, normalizedNew);
	return edited.replace(/\n/g, lineEnding);
}

/**
 * Builds the pending candidate for validation without failing on unusable input.
 *
 * Unlike `candidateFromPayload`, every outcome that cannot be validated becomes
 * a visible skip reason instead of an exception, so the write gate never blames
 * the documentation standard for a payload it could not read or a tool error the
 * tool itself should report.
 *
 * @param {Record<string, unknown>} payload - Tool payload exposing `tool_input`.
 * @param {Record<string, unknown>} [policy] - Effective policy.
 * @returns {Promise<{applicable: false, reason: string} | {applicable: true, candidate: {path: string, content: string}}>} A skip reason, or the complete candidate.
 */
export async function buildCandidate(payload, policy = loadPolicy()) {
	const input = payload?.tool_input ?? payload?.arguments ?? payload;
	if (!input || typeof input !== "object")
		return {
			applicable: false,
			reason: "the tool payload carries no input object",
		};
	const requested = input.file_path ?? input.path ?? input.file;
	if (typeof requested !== "string" || requested.trim() === "")
		return {
			applicable: false,
			reason: "the tool input carries no file path",
		};
	const path = requested;
	if (isIgnoredPath(path, policy))
		return { applicable: false, reason: `${path} is on the ignored-path list` };
	let content = null;
	if (typeof input.content === "string") content = input.content;
	else if (
		typeof input.old_string === "string" &&
		typeof input.new_string === "string"
	) {
		let before = null;
		try {
			before = await readFile(path, "utf8");
		} catch (error) {
			return {
				applicable: false,
				reason: `the existing file ${path} could not be read to materialize the edit (${error.code ?? error.message})`,
			};
		}
		const replaceAll = input.replace_all === true;
		const edited = applyEditPair(
			before,
			input.old_string,
			input.new_string,
			replaceAll,
		);
		if (edited === null) {
			const matches = editMatchCount(
				before.replace(/\r\n/g, "\n"),
				input.old_string.replace(/\r\n/g, "\n"),
			);
			return {
				applicable: false,
				reason: replaceAll
					? `the edit matched ${matches} copies of old_string in ${path}, so replace_all has nothing to change`
					: `the edit matched ${matches} copies of old_string in ${path}, so no single candidate exists`,
			};
		}
		content = edited;
	} else
		return {
			applicable: false,
			reason:
				"the tool input carries neither complete content nor an old_string/new_string pair",
		};
	const bytes = Buffer.byteLength(content, "utf8");
	const limit = Number(policy?.maxValidatedBytes);
	const maxBytes = Number.isFinite(limit) && limit > 0 ? limit : 4_194_304;
	if (bytes > maxBytes)
		return {
			applicable: false,
			reason: `${path} is ${bytes} bytes, above the ${maxBytes}-byte validation limit`,
		};
	return { applicable: true, candidate: { path, content } };
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
	const replaceAll = input.replace_all === true;
	const content = applyEditPair(
		before,
		input.old_string,
		input.new_string,
		replaceAll,
	);
	if (content === null) {
		const count = editMatchCount(
			before.replace(/\r\n/g, "\n"),
			input.old_string.replace(/\r\n/g, "\n"),
		);
		throw new Error(
			replaceAll
				? `edit old_string matched nothing (matched ${count})`
				: `edit old_string must match exactly once (matched ${count})`,
		);
	}
	return { path, content };
}

/**
/**
 * Spawns one process and captures its streams (rustfmt migration path only).
 *
 * @param {string} command - Executable path.
 * @param {string[]} args - Argument list.
 * @param {string} content - Standard-input payload.
 * @param {string} cwd - Working directory.
 * @param {boolean} [shell] - Whether to spawn through the shell.
 * @returns {Promise<{code: number | null, stdout: string, stderr: string, error: Error | null}>} Run result.
 */
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
 * Runs the project rustfmt for one candidate (migration exception, REQ-028 audit).
 *
 * @param {string} command - rustfmt executable.
 * @param {string} content - Candidate content.
 * @param {string} cwd - Working directory for the run.
 * @returns {Promise<null | {unavailable?: boolean, message?: string}>} Null when formatted; otherwise the outcome.
 */
async function runRustfmt(command, content, cwd) {
	const result = await execute(
		command,
		["--emit", "stdout"],
		content,
		cwd,
		false,
	);
	if (result.error?.code === "ENOENT") return { unavailable: true };
	if (result.code !== 0) {
		const output = (result.stderr || result.stdout).trim();
		return {
			message: [
				`[doc-standard] rustfmt could not format.`,
				`Executable: ${command}`,
				`Exit: ${result.code ?? "not started"}`,
				output ? `Formatter output:\n${output}` : "Formatter output: none.",
				result.error ? `Start error: ${result.error.message}` : null,
			]
				.filter(Boolean)
				.join("\n"),
		};
	}
	return result.stdout === content
		? null
		: { message: "[doc-standard] must match rustfmt formatting." };
}

/**
 * Identifies the pre-write formatter profile for a candidate path.
 *
 * The routing derives from pack formatter declarations, not engine knowledge:
 * each embedded pack's declaration carries the settings key that gates it, and
 * the pack id maps onto this module's legacy profile keys for write-through
 * routing. Rust remains the documented migration exception.
 *
 * @param {string} path - Candidate filesystem path.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {'python' | 'typescriptJavascript' | 'rust' | 'dockerCompose' | null} Formatter profile.
 */
export function formatterProfile(path, policy) {
	if (extname(path).toLowerCase() === ".rs" && policy.formatRust) return "rust";
	const declaration = formatterDeclarationFor(path);
	if (!declaration) return null;
	const settingsKey = declaration.formatter.settingsKey;
	if (settingsKey && policy[settingsKey] === false) return null;
	const keyByPackId = {
		python: "python",
		"typescript-javascript": "typescriptJavascript",
		"docker-compose": "dockerCompose",
	};
	return keyByPackId[declaration.pack.manifest.id] ?? null;
}

/**
 * Checks a candidate against its pack-declared formatter adapter without modifying files.
 *
 * The engine carries no formatter knowledge: the covering pack profile declares
 * the adapter, the pinned dependency, and the argument template. Rust remains a
 * documented migration exception (REQ-028 audit exception) until the Rust pack
 * ships, because its formatter is the project toolchain rather than a managed one.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {Record<string, unknown>} [policy] - Effective policy override for testing.
 * @param {string} [cwd] - Workspace root the formatter runs in and resolves paths against.
 * @returns {Promise<string | null>} Blocking message, or null when formatting passes or is disabled.
 */
export async function checkFormatting(
	candidate,
	policy = loadPolicy(),
	cwd = process.cwd(),
) {
	if (!policy.formatOnWrite) return null;
	// Migration exception: the Rust pack has not shipped, so the opt-in
	// project-rustfmt check stays engine-side until it does.
	if (extname(candidate.path).toLowerCase() === ".rs" && policy.formatRust) {
		const command = process.platform === "win32" ? "rustfmt.exe" : "rustfmt";
		const target = resolve(cwd, candidate.path);
		const result = await runRustfmt(
			command,
			candidate.content,
			dirname(target),
		);
		if (result === null) return null;
		if (result.unavailable)
			return policy.blockOnMissingFormatter !== false
				? "[doc-standard] Required formatter is unavailable: rustfmt."
				: null;
		return result.message;
	}
	return runFormatterAdapter(candidate, policy, cwd);
}

/**
 * Resolves the policy document handed to the Python documentation checker.
 *
 * This is the fallback for standalone runs. The host passes the policy it is
 * enforcing right now through the environment, so a durable write that failed
 * or was interrupted can never leave the checker on a stale rule set.
 *
 * @param {Record<string, unknown>} [policy] - Effective policy optionally carrying `policyPath`.
 * @returns {string} Filesystem path of the policy document for the checker.
 */
function checkerPolicyPath(policy = {}) {
	if (typeof policy.policyPath === "string" && policy.policyPath)
		return policy.policyPath;
	return (
		process.env.CODING_DOC_STANDARD_POLICY ??
		(existsSync(durablePolicy) ? durablePolicy : defaultsPolicy)
	);
}

/**
 * Largest live policy document handed to the checker through its environment.
 *
 * A child process environment is a bounded block, so an oversized policy falls
 * back to the durable file rather than failing to start at all.
 */
const MAX_INLINE_POLICY_BYTES = 16_000;

/**
 * Serializes the live policy for the documentation checker.
 *
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {string} JSON document, or an empty string to use the file fallback.
 */
function inlineCheckerPolicy(policy) {
	if (!policy || typeof policy !== "object" || Object.keys(policy).length === 0)
		return "";
	const serialized = JSON.stringify(policy);
	return serialized.length <= MAX_INLINE_POLICY_BYTES ? serialized : "";
}

/**
 * Runs the Python documentation checker and captures its diagnostics.
 *
 * Capturing stdout and stderr lets the host aggregate checker findings with every
 * other pass instead of letting one child process print straight past the caller.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {Record<string, unknown>} [policy] - Effective policy.
 * @returns {Promise<{code: number, lines: string[]}>} Checker exit code and trimmed diagnostic lines.
 */
export function runCheckerOutput(candidate, policy = {}) {
	const python = process.platform === "win32" ? "py" : "python3";
	const policyPath = checkerPolicyPath(policy);
	const args =
		process.platform === "win32"
			? ["-3", checker, candidate.path, "--policy", policyPath, "--stdin"]
			: [checker, candidate.path, "--policy", policyPath, "--stdin"];
	const inline = inlineCheckerPolicy(policy);
	return new Promise((resolve, reject) => {
		const child = spawn(python, args, {
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
			// Pin the child to UTF-8 I/O. Without this a BOM-prefixed candidate
			// reaches the checker through the Windows locale codec, every header
			// regex fails, and a documented file is reported as undocumented.
			// checker.py decodes with utf-8-sig for the same reason.
			env: {
				...process.env,
				PYTHONUTF8: "1",
				PYTHONIOENCODING: "utf-8",
				...(inline ? { CODING_DOC_STANDARD_POLICY_JSON: inline } : {}),
			},
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
		child.once("error", reject);
		child.once("exit", (code) => {
			const lines = `${stdout ? `${stdout}\n` : ""}${stderr}`
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line !== "");
			resolve({ code: code ?? 1, lines });
		});
		child.stdin.end(candidate.content);
	});
}

/**
 * Runs the Python documentation checker for one pending candidate.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @returns {Promise<number>} Checker exit code.
 */
export async function runChecker(candidate) {
	const { code } = await runCheckerOutput(candidate);
	return code;
}

/**
 * Checks source-only public-unit policies against one pending candidate.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {Record<string, unknown>} [policy] - Effective policy override for testing.
 * @returns {string[]} Blocking diagnostics for enabled source-only public-unit policies.
 */
export function checkSourcePublicUnits(candidate, policy = loadPolicy()) {
	if (policy?.enabled === false) return [];
	return checkTypescriptPublicUnits(candidate, policy).map(
		(violation) =>
			`${candidate.path}:${violation.line} [doc-standard] ${violation.message}`,
	);
}

/**
 * Collapses one multi-line finding into a few aligned lines.
 *
 * @param {string} text - Raw finding text.
 * @param {number} [maxLines] - Maximum number of lines to keep.
 * @returns {string} Compacted finding text indented under its list marker.
 */
function compactFinding(text, maxLines = 3) {
	const continuation = "\n     ";
	const lines = String(text ?? "")
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.trim() !== "");
	const kept = lines.slice(0, Math.max(1, maxLines));
	return `${kept.join(continuation)}${lines.length > maxLines ? " …" : ""}`;
}

/**
 * Renders aggregated validation findings into one actionable blocking message.
 *
 * The report lists every known finding up to the cap instead of only the first
 * one, keeps the `[doc-standard]` marker agents recognize, and points at the
 * skill reference plus the tools that repair each class of finding.
 *
 * @param {{status: string, findings?: {pass: string, text: string}[], failures?: string[], candidate?: {path?: string, bytes?: number}}} result - Aggregated validation result.
 * @param {{max?: number, maxChars?: number}} [options] - Caps on listed findings and total characters.
 * @returns {string} Multi-line report suitable for a tool denial reason.
 */
export function renderFindings(result, options = {}) {
	const max =
		Number.isFinite(options.max) && Number(options.max) > 0
			? Number(options.max)
			: 15;
	const maxChars =
		Number.isFinite(options.maxChars) && Number(options.maxChars) > 0
			? Number(options.maxChars)
			: 2_400;
	const findings = Array.isArray(result.findings) ? result.findings : [];
	const failures = Array.isArray(result.failures) ? result.failures : [];
	const path = result.candidate?.path ?? "this file";
	const shown = findings.slice(0, max);
	const lines = [
		findings.length
			? `[doc-standard] ${findings.length} issue(s) block writing ${path}.`
			: `[doc-standard] Validation could not complete for ${path}.`,
		"",
	];
	shown.forEach((finding, index) => {
		lines.push(
			`${index + 1}. [${finding.pass}] ${compactFinding(finding.text)}`,
		);
	});
	if (findings.length > shown.length)
		lines.push(`… plus ${findings.length - shown.length} more issue(s).`);
	const guidance = [];
	if (shown.some((finding) => finding.pass === "formatting"))
		guidance.push(
			"Formatting: call write_formatted with the language and this file_path: it formats, checks, and writes the result in one call.",
		);
	const reference = referenceForPath(path);
	guidance.push(
		reference
			? `Rules: skill coding-doc-standard → references/${reference}.`
			: "Rules: skill coding-doc-standard.",
	);
	guidance.push("Full workspace report: /coding-doc-verify.");
	lines.push("", ...guidance);
	if (failures.length)
		lines.push("", `[doc-standard] Not fully checked: ${failures.join("; ")}`);
	const text = lines.join("\n");
	return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/**
 * Runs every applicable check for one candidate concurrently.
 *
 * All passes run in parallel so one round trip reveals the complete picture,
 * real findings outrank internal failures, and a slow or broken pass cannot hold
 * the agent beyond the configured budget.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {Record<string, unknown>} [policy] - Effective policy.
 * @param {{timeoutMs?: number, cwd?: string}} [options] - Validation budget and workspace root.
 * @returns {Promise<{status: "pass" | "violations" | "error", findings: {pass: string, text: string}[], failures: string[], incomplete: boolean, elapsedMs: number, candidate: {path: string, bytes: number}}>} Aggregated validation outcome.
 */
export async function validateCandidate(
	candidate,
	policy = loadPolicy(),
	options = {},
) {
	const started = Date.now();
	const findings = [];
	const failures = [];
	const timeoutMs =
		Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
			? Number(options.timeoutMs)
			: 20_000;
	const cwd =
		typeof options.cwd === "string" && options.cwd
			? options.cwd
			: process.cwd();
	const add = (pass, text) => {
		const trimmed = String(text ?? "").trim();
		if (trimmed) findings.push({ pass, text: trimmed });
	};
	const runPass = async (pass, task) => {
		try {
			await task();
		} catch (error) {
			failures.push(
				`${pass} check failed: ${error?.code ?? error?.message ?? "unknown error"}`,
			);
		}
	};
	// A covering language pack owns documentation checking for its paths: the
	// legacy Python checker and tree-sitter table stay out of the way so one
	// candidate is never judged by two rule sets (Phase 1 of ADR-0007).
	let packCoverage = null;
	try {
		packCoverage = packCoverageFor(candidate.path, policy);
	} catch {
		packCoverage = null;
	}
	const passes = [
		runPass("formatting", async () => {
			add("formatting", await checkFormatting(candidate, policy, cwd));
		}),
	];
	if (!packCoverage) {
		passes.push(
			runPass("documentation", async () => {
				const { code, lines } = await runCheckerOutput(candidate, policy);
				if (code === 0) return;
				if (code === 2) {
					for (const line of lines) add("documentation", line);
					return;
				}
				failures.push(
					`documentation checker exited ${code}${lines.length ? `: ${lines[0]}` : ""}`,
				);
			}),
			runPass("public units", async () => {
				for (const line of checkSourcePublicUnits(candidate, policy))
					add("public units", line);
			}),
			runPass("tree-sitter", async () => {
				for (const line of await checkTreeSitterPublicUnits(candidate, policy))
					add("tree-sitter", line);
			}),
		);
	} else {
		passes.push(
			runPass("packs", async () => {
				for (const line of await validateWithPacks(candidate, packCoverage))
					add("packs", line);
			}),
		);
	}
	passes.push(
		runPass("project adapter", async () => {
			const violations = await checkProjectPublicUnits(
				{ ...candidate, cwd },
				policy,
			);
			for (const line of violations) add("project adapter", line);
		}),
	);
	const work = Promise.all(passes);
	let timer;
	const budget = new Promise((_resolve, reject) => {
		timer = setTimeout(
			() => reject(new Error(`exceeded the ${timeoutMs} ms validation budget`)),
			timeoutMs,
		);
	});
	let incomplete = false;
	try {
		await Promise.race([work, budget]);
	} catch (error) {
		incomplete = true;
		failures.push(`validation ${error?.message ?? "failed"}`);
	} finally {
		clearTimeout(timer);
	}
	const status =
		findings.length > 0 ? "violations" : failures.length > 0 ? "error" : "pass";
	return {
		status,
		findings: [...findings],
		failures: [...failures],
		incomplete,
		elapsedMs: Date.now() - started,
		candidate: {
			path: candidate.path,
			bytes: Buffer.byteLength(candidate.content ?? "", "utf8"),
		},
	};
}

/**
 * Executes a hook payload and renders its findings for a standalone run.
 *
 * @param {Record<string, unknown>} payload - Hook event payload.
 * @param {{timeoutMs?: number, cwd?: string}} [options] - Validation budget and workspace root.
 * @returns {Promise<number>} Process status: 0 for pass or skip, 2 for violations, 3 for validator error.
 */
export async function runHook(payload, options = {}) {
	const policy = loadPolicy();
	if (policy.enabled === false) return 0;
	let built;
	try {
		built = await buildCandidate(payload, policy);
	} catch (error) {
		console.error(
			`[doc-standard] Validator could not read the pending change: ${error.message}`,
		);
		return 3;
	}
	if (!built.applicable) {
		console.log(`[doc-standard] Skipped validation: ${built.reason}`);
		return 0;
	}
	const result = await validateCandidate(built.candidate, policy, options);
	if (result.status === "violations") {
		console.error(renderFindings(result));
		return 2;
	}
	if (result.status === "pass") return 0;
	console.error(
		`[doc-standard] Validation could not complete for ${built.candidate.path}: ${result.failures.join("; ")}`,
	);
	return 3;
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
