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

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
	formatterDeclarationFor,
	runFormatterAdapter,
} from "../engine/formatters.mjs";
import { packCoverageFor, validateWithPacks } from "../engine/index.mjs";
import { getRegistry } from "../engine/registry.mjs";
import { checkProjectPublicUnits } from "./public-unit-adapter.mjs";
import { checkTypescriptPublicUnits } from "./typescript-public-docs.mjs";

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultsPolicy = join(sourceRoot, "policy", "defaults.json");
const durableRoot = join(homedir(), ".dsh", "plugins", "coding-doc-standard");
const durablePolicy = join(durableRoot, "policy.json");

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
	// Unit documentation for packed languages is pack-owned; the legacy
	// publicUnitDocs overlay that gated the checker's syntax table is gone
	// (ADR-0009).
	return policy;
}

/**
 * Paths exempt from pre-write validation unless a policy replaces them.
 *
 * Vendored, generated, minified, and lockfile paths are never a documentation
 * or formatting problem the agent can fix, so blocking them is pure friction.
 * `skill` exempts the plugin's own skill directories: their example files
 * demonstrate the standard and follow its layout, not the checker's rules.
 */
export const ignoredPathDefaults = [
	"**/node_modules/**",
	"**/bower_components/**",
	"**/vendor/**",
	"**/skill/**",
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
 * Maps a candidate path onto the language-pack skill that documents its rules.
 *
 * Every installed pack ships a skill named coding-doc-standard-<pack id> that
 * carries its exact header syntax and formatter, so the pointer is derived
 * from the live registry rather than a fixed extension table: a language
 * without an installed pack has no pack skill to name.
 *
 * @param {string} candidatePath - Path of the pending candidate.
 * @param {Record<string, unknown>} [policy] - Effective policy supplying compose patterns.
 * @returns {string | null} Pack skill name, or null when no installed pack covers the path.
 */
export function skillForPath(candidatePath, policy = {}) {
	const file = basename(normalizePath(candidatePath)).toLowerCase();
	const patterns = Array.isArray(policy.composePatterns)
		? policy.composePatterns
		: [];
	if (patterns.some((pattern) => globToRegExp(String(pattern)).test(file)))
		return "coding-doc-standard-docker-compose";
	const extension = extname(file);
	for (const pack of getRegistry().packs.values()) {
		for (const profile of pack.profiles.values()) {
			const covered =
				(profile.extensions ?? []).some(
					(value) => String(value).toLowerCase() === extension,
				) ||
				(profile.filenames ?? []).some((value) =>
					globToRegExp(String(value).toLowerCase()).test(file),
				);
			if (covered) return `coding-doc-standard-${pack.manifest.id}`;
		}
	}
	return null;
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
 * Apply one literal edit pair, tolerating line-ending drift.
 *
 * Try exact bytes first; otherwise normalize CRLF to LF and restore the file's
 * CRLF ending when present. Replacement text is literal, including dollar signs.
 *
 * @param {string} before     (in) - Existing file content; never modified.
 * @param {string} oldString  (in) - Nonempty literal text to replace.
 * @param {string} newString  (in) - Literal replacement text, including empty text.
 * @param {boolean} replaceAll (in) - True to replace every non-overlapping match; false requires exactly one.
 *
 * @returns {string | null} Edited content on an unambiguous match; null for an
 * empty needle, no match, or multiple matches without replaceAll. Inputs stay
 * unchanged on failure. Strings and a boolean are trusted; invalid types can
 * throw TypeError.
 *
 * @example
 * ```js
 * applyEditPair("hello world", "world", "$&", false); // "hello $&"
 * applyEditPair("a a", "a", "b", false); // null
 * applyEditPair("a a", "a", "b", true); // "b b"
 * applyEditPair("a", "", "b", false); // null
 * ```
 */
export function applyEditPair(before, oldString, newString, replaceAll) {
	if (oldString === "") return null;
	const exact = editMatchCount(before, oldString);
	if (exact > 0 && (replaceAll || exact === 1))
		return replaceAll
			? before.split(oldString).join(newString)
			: before.replace(oldString, () => newString);
	const lineEnding = before.includes("\r\n") ? "\r\n" : "\n";
	const normalizedBefore = before.replace(/\r\n/g, "\n");
	const normalizedOld = oldString.replace(/\r\n/g, "\n");
	const normalizedNew = newString.replace(/\r\n/g, "\n");
	const tolerant = editMatchCount(normalizedBefore, normalizedOld);
	if (tolerant === 0 || (!replaceAll && tolerant > 1)) return null;
	const edited = replaceAll
		? normalizedBefore.split(normalizedOld).join(normalizedNew)
		: normalizedBefore.replace(normalizedOld, () => normalizedNew);
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
 * @param {string} [cwd] - Workspace root relative tool paths resolve against.
 * @returns {Promise<{applicable: false, reason: string} | {applicable: true, candidate: {path: string, content: string}}>} A skip reason, or the complete candidate.
 */
export async function buildCandidate(
	payload,
	policy = loadPolicy(),
	cwd = process.cwd(),
) {
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
			// Relative tool paths are workspace-relative, so the pre-edit text
			// must be read against the workspace the tool will actually write
			// in, not the host process directory: reading it against the wrong
			// cwd skipped every relative edit and silently disarmed the gate.
			before = await readFile(
				isAbsolute(path) ? path : resolve(cwd, path),
				"utf8",
			);
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
 * Identifies the pre-write formatter profile for a candidate path.
 *
 * The routing derives from pack formatter declarations, not engine knowledge:
 * each embedded pack's declaration carries the settings key that gates it, and
 * the pack id maps onto this module's legacy profile keys for write-through
 * routing. The Rust pack declares the project-toolchain rustfmt through the
 * external-command adapter, so no engine-side tool branch exists anymore.
 *
 * @param {string} path - Candidate filesystem path.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {'python' | 'typescriptJavascript' | 'rust' | 'dockerCompose' | null} Formatter profile.
 */
export function formatterProfile(path, policy) {
	const declaration = formatterDeclarationFor(path);
	if (!declaration) return null;
	const settingsKey = declaration.formatter.settingsKey;
	if (settingsKey && policy[settingsKey] === false) return null;
	const keyByPackId = {
		python: "python",
		"typescript-javascript": "typescriptJavascript",
		"docker-compose": "dockerCompose",
		rust: "rust",
	};
	return keyByPackId[declaration.pack.manifest.id] ?? null;
}

/**
 * Checks a candidate against its pack-declared formatter adapter without modifying files.
 *
 * The engine carries no formatter knowledge: the covering pack profile declares
 * the adapter, the pinned dependency, and the argument template. A project
 * toolchain formatter (Rust's rustfmt) runs when the binary exists and
 * degrades per blockOnMissingFormatter when it does not.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {Record<string, unknown>} [policy] - Effective policy override for testing.
 * @param {string} [cwd] - Workspace root the formatter runs in and resolves paths against.
 * @param {{signal?: AbortSignal}} [options] - Cancellation that kills the formatter.
 * @returns {Promise<string | null>} Blocking message, or null when formatting passes or is disabled.
 */
export async function checkFormatting(
	candidate,
	policy = loadPolicy(),
	cwd = process.cwd(),
	options = {},
) {
	if (!policy.formatOnWrite) return null;
	return runFormatterAdapter(candidate, policy, cwd, options);
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
	const skill = skillForPath(path);
	guidance.push(
		skill
			? `Rules: skill coding-doc-standard and its ${skill} pack skill.`
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
 * @param {{timeoutMs?: number, cwd?: string, signal?: AbortSignal}} [options] - Validation budget, workspace root, and cancellation.
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
	// One signal carries the budget and the caller's cancellation into every
	// spawn the passes make: a hung formatter or checker used to outlive the
	// validation it belonged to, so a slow file stacked one live child per
	// retry while the host kept waiting on nothing.
	const budgetSignal = AbortSignal.timeout(timeoutMs);
	const kill = options.signal
		? AbortSignal.any([budgetSignal, options.signal])
		: budgetSignal;
	// A covering language pack owns documentation checking for its paths: its
	// codec decodes the file header and its unit provider judges unit
	// documents, so the checker interpreter and the legacy tree-sitter table
	// are gone (ADR-0007, ADR-0008, ADR-0009). Paths no pack covers keep only
	// the source-level public-unit pass.
	let packCoverage = null;
	try {
		packCoverage = packCoverageFor(candidate.path, policy);
	} catch {
		packCoverage = null;
	}
	const passes = [
		runPass("formatting", async () => {
			add(
				"formatting",
				await checkFormatting(candidate, policy, cwd, { signal: kill }),
			);
		}),
	];
	if (packCoverage) {
		passes.push(
			runPass("packs", async () => {
				for (const line of await validateWithPacks(candidate, packCoverage))
					add("packs", line);
			}),
		);
	}
	if (!packCoverage?.profile.units) {
		passes.push(
			runPass("public units", async () => {
				for (const line of checkSourcePublicUnits(candidate, policy))
					add("public units", line);
			}),
		);
	}
	passes.push(
		runPass("project adapter", async () => {
			const violations = await checkProjectPublicUnits(
				{ ...candidate, cwd },
				policy,
				{ signal: kill },
			);
			for (const line of violations) add("project adapter", line);
		}),
	);
	const work = Promise.all(passes);
	// The race names why the checks stopped: budget expiry or the caller
	// aborting the pending execution. The kill signal already ends every
	// child, so nothing outlives this decision.
	const stopped = new Promise((_resolve, reject) => {
		const stop = () =>
			reject(
				new Error(
					options.signal?.aborted
						? "stopped by an aborted execution"
						: `exceeded the ${timeoutMs} ms validation budget`,
				),
			);
		if (kill.aborted) stop();
		else kill.addEventListener("abort", stop, { once: true });
	});
	let incomplete = false;
	try {
		await Promise.race([work, stopped]);
	} catch (error) {
		incomplete = true;
		failures.push(`validation ${error?.message ?? "failed"}`);
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
		built = await buildCandidate(payload, policy, options.cwd);
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