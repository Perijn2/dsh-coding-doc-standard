/**
 * @module coding-doc-standard-write-through
 * @author Perijn Huijser
 * Formats one pending file, checks the formatted bytes, and hands them over in
 * the same agent call.
 *
 * @remarks
 * Usage:
 *   Core principle: One call covers formatting, the documentation check, and
 *   the write, so authoring cannot fan out into four calls that each reveal
 *   one class of problem.
 *   Setup: Reached through the `write_formatted` and `format_code` tools that
 *   `src/host/index.mjs` registers; this module is not an entry point.
 *   Workflow: Take the language the caller declared, refuse the request when
 *   the path contradicts it, format in memory, validate the formatted bytes
 *   against the live policy, then dispatch the inner write while this module
 *   holds the enclosing execution token so the pre-execute gate skips a
 *   candidate it has already checked.
 *   API guide: `formatAndWrite` lands one file; `previewFormat` runs the
 *   same cycle and returns the text without writing; `isSelfDispatch` tells
 *   the gate whether one pending execution came from here; `languageForPath`
 *   reports what the live policy would format here; `languageOfExtension`
 *   reports what one path says it is regardless of policy; `renderReceipt`
 *   turns a receipt into the model-facing text.
 *   Worked example: `await formatAndWrite({ filePath: "src/a.ts", language:
 *   "typescript", content, run, policy, exec, tools })` leaves one formatted,
 *   documented file on disk and returns `{ applied: true, formatter: "biome",
 *   validation: "pass" }`.
 */

import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { runFormatterCommand } from "../formatter/command.mjs";

/**
 * Prefix every message this module puts in front of the agent.
 */
const PREFIX = "[doc-standard] ";

/**
 * Namespace for a synthetic self-dispatch stamp, used only when the host
 * hands this tool no execution token of its own.
 */
const SELF_TOKEN_PREFIX = "coding-doc-standard";

/**
 * Managed formatter selector for each tool language key.
 */
const SELECTORS = {
	python: "--python",
	typescript: "--typescript",
	javascript: "--javascript",
	"docker-compose": "--docker-compose",
};

/**
 * Executable name behind each tool language key, for the receipt.
 */
const FORMATTER_BY_LANGUAGE = {
	python: "ruff",
	typescript: "biome",
	javascript: "biome",
	"docker-compose": "prettier",
};

/**
 * Extensions that are TypeScript by extension alone.
 */
const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

/**
 * Extensions that are JavaScript by extension alone.
 */
const JAVASCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Formatter toggles forced on, so one lookup reports what a path is rather
 * than what this workspace happens to allow today.
 */
const ALL_FORMATTERS_ON = {
	formatOnWrite: true,
	formatPython: true,
	formatTypescriptJavascript: true,
	formatRust: true,
	formatDockerCompose: true,
};

/**
 * Largest formatted text echoed back inside a report that wrote nothing.
 */
const MAX_INLINE_FORMATTED_BYTES = 8_192;

/**
 * Enclosing execution tokens whose writes this module dispatched itself.
 *
 * The inner write re-enters the whole tool pipeline, so the plugin own
 * pre-execute gate consults this set and skips a candidate that was already
 * checked here. Tokens are unique per execution, so concurrent calls never
 * collide, and every entry is removed as soon as its dispatch settles.
 *
 * @type {Set<unknown>}
 */
const selfDispatched = new Set();

/**
 * Reports whether one pending execution was dispatched by this module.
 *
 * @param {unknown} parent - The `parent` token carried by a pending execution.
 * @returns {boolean} True when this module owns the enclosing dispatch.
 */
export function isSelfDispatch(parent) {
	return parent !== undefined && parent !== null && selfDispatched.has(parent);
}

/**
 * Counts the self-dispatches currently holding a token.
 *
 * @returns {number} Registered token count, zero once every dispatch settled.
 */
export function selfDispatchDepth() {
	return selfDispatched.size;
}

/**
 * Lowercases one path extension so two of them can be compared.
 *
 * @param {string} filePath - Path whose extension is wanted.
 * @returns {string} Lowercased extension, dot included, empty when absent.
 */
function extensionOf(filePath) {
	return extname(String(filePath ?? "")).toLowerCase();
}

/**
 * Maps one formatter profile onto a tool language key.
 *
 * @param {string | null} profile - Profile the validator resolved for a path.
 * @param {string} extension - Lowercased extension of that same path.
 * @returns {string | null} Tool language key, or null when nothing maps.
 */
function keyForProfile(profile, extension) {
	if (profile === "python") return "python";
	if (profile === "dockerCompose") return "docker-compose";
	if (profile === "rust") return "rust";
	if (profile !== "typescriptJavascript") return null;
	if (TYPESCRIPT_EXTENSIONS.has(extension)) return "typescript";
	if (JAVASCRIPT_EXTENSIONS.has(extension)) return "javascript";
	return null;
}

/**
 * Reports what one path says it is, whatever the workspace policy allows.
 *
 * The extension is the evidence a caller cannot argue with, while the policy
 * only says what this workspace chooses to format today. Every toggle is
 * forced on here so a switched-off formatter cannot hide what the bytes are.
 *
 * @param {string} filePath - Path under discussion.
 * @param {typeof import("../hook/run.mjs")} run - Validator module namespace.
 * @param {Record<string, unknown>} [policy] - Policy supplying compose patterns.
 * @returns {string | null} Language key, "rust", or null for an unknown path.
 */
export function languageOfExtension(filePath, run, policy = {}) {
	return keyForProfile(
		run.formatterProfile(filePath, { ...policy, ...ALL_FORMATTERS_ON }),
		extensionOf(filePath),
	);
}

/**
 * Resolves the language the live policy will actually format here.
 *
 * The lookup delegates to the gate own profile rule so the tool can never
 * disagree with what a plain `write` would be held to. Rust is absent: its
 * formatter is the project toolchain rather than a managed executable this
 * plugin may invoke.
 *
 * @param {string} filePath - Target path supplied by the caller.
 * @param {typeof import("../hook/run.mjs")} run - Validator module namespace.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {string | null} Tool language key, or null when nothing formats here.
 */
export function languageForPath(filePath, run, policy) {
	const language = keyForProfile(
		run.formatterProfile(filePath, { ...policy, formatOnWrite: true }),
		extensionOf(filePath),
	);
	return language === "rust" ? null : language;
}

/**
 * Clamps one setting to a usable positive integer.
 *
 * @param {unknown} value - Raw setting value.
 * @param {number} fallback - Value used when the raw value is unusable.
 * @returns {number} Positive integer setting.
 */
function positiveNumber(value, fallback) {
	const numeric = Number(value);
	return Number.isFinite(numeric) && numeric > 0
		? Math.floor(numeric)
		: fallback;
}

/**
 * Measures one text for the receipt byte and line delta.
 *
 * @param {string} text - Candidate text.
 * @returns {{bytes: number, lines: number}} Size of the text in UTF-8 bytes and lines.
 */
function measure(text) {
	const value = String(text ?? "");
	return {
		bytes: Buffer.byteLength(value, "utf8"),
		lines: value.split(/\r?\n/).length,
	};
}

/**
 * Wraps text in a fenced block that cannot be broken by the text itself.
 *
 * @param {string} text - Text to embed.
 * @returns {string} Fenced block including both fence lines.
 */
function fenced(text) {
	const fence = String(text ?? "").includes("```") ? "~~~" : "```";
	const body = String(text ?? "");
	return `${fence}\n${body}${body.endsWith("\n") ? "" : "\n"}${fence}`;
}

/**
 * Lists the language keys the two write-through tools accept.
 *
 * @returns {string} Comma-separated language keys.
 */
function supportedLanguages() {
	return Object.keys(SELECTORS).join(", ");
}

/**
 * Points one refusal at the skill text that carries the rule behind it.
 *
 * A refusal that only says no leaves the agent guessing, which is the
 * failure this plugin exists to remove, so every refusal names the skill
 * reference that documents the standard for that path.
 *
 * @param {typeof import("../hook/run.mjs")} run - Validator module namespace.
 * @param {string} filePath - Path the refusal is about.
 * @param {Record<string, unknown>} policy - Policy supplying compose patterns.
 * @returns {string} Sentence naming the reference file when one applies.
 */
function skillPointer(run, filePath, policy) {
	const reference =
		typeof run?.referenceForPath === "function"
			? run.referenceForPath(filePath, policy)
			: null;
	if (!reference) return "Load the coding-doc-standard skill before retrying.";
	return (
		"Load the coding-doc-standard skill and read " +
		`skill/references/${reference} before retrying.`
	);
}

/**
 * Runs the documentation passes over one candidate and maps them to a verdict.
 *
 * Ignored and oversized paths skip instead of failing: the write gate treats
 * them as out of scope, and a preview should not contradict it.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @param {object} options - Check inputs.
 * @param {typeof import("../hook/run.mjs")} options.run - Validator namespace.
 * @param {Record<string, unknown>} options.policy - Policy used for the check.
 * @param {string} options.cwd - Workspace root for the check.
 * @param {boolean} options.enforcing - False when the plugin is disabled, which skips every check.
 * @returns {Promise<{verdict: string, findings: number, report: string}>} One verdict with its rendered report.
 */
async function assessCandidate(candidate, { run, policy, cwd, enforcing }) {
	if (!enforcing) return { verdict: "skipped", findings: 0, report: "" };
	if (run.isIgnoredPath(candidate.path, policy)) {
		return {
			verdict: "skipped",
			findings: 0,
			report: `${candidate.path} is an ignored path.`,
		};
	}
	const limit = positiveNumber(policy.maxValidatedBytes, 4_194_304);
	const bytes = Buffer.byteLength(candidate.content, "utf8");
	if (bytes > limit) {
		return {
			verdict: "skipped",
			findings: 0,
			report: `${bytes} bytes is above the ${limit}-byte validation limit.`,
		};
	}
	const result = await run.validateCandidate(candidate, policy, {
		timeoutMs: positiveNumber(policy.validatorTimeoutMs, 20_000),
		cwd,
	});
	const max = positiveNumber(policy.aggregateMaxFindings, 15);
	if (result.status === "pass")
		return { verdict: "pass", findings: 0, report: "" };
	if (result.status === "violations") {
		return {
			verdict: "issues",
			findings: result.findings.length,
			report: run.renderFindings(result, { max }),
		};
	}
	return {
		verdict: "incomplete",
		findings: result.findings.length,
		report: run.renderFindings(result, { max }),
	};
}

/**
 * Renders the report for a request that wrote nothing because of findings.
 *
 * When the formatter did change the text and the result is small enough, the
 * formatted version is echoed so the next attempt only has to fix the
 * documentation instead of re-formatting first.
 *
 * @param {string} filePath - Target path that was not written.
 * @param {{verdict: string, report: string}} verdict - Assessment of the formatted text.
 * @param {object} context - What formatting did to this candidate.
 * @param {string} context.formatted - Text the formatter produced.
 * @param {boolean} context.changed - Whether the formatter changed the text.
 * @param {boolean} context.hasFormatter - Whether a managed formatter ran at all.
 * @param {string} context.language - Language key the request declared.
 * @returns {string} Multi-line blocking report ending with the next step.
 */
function notWrittenReport(filePath, verdict, context) {
	const { formatted, changed, hasFormatter, language } = context;
	const lines = [
		`${PREFIX}Nothing was written to ${filePath}.`,
		"",
		verdict.report,
		"",
	];
	const bytes = Buffer.byteLength(formatted, "utf8");
	if (changed && bytes <= MAX_INLINE_FORMATTED_BYTES) {
		lines.push(
			"Formatting is already correct. Fix the findings above; the text",
			"below is exactly what would have been written:",
			"",
			fenced(formatted),
		);
	} else if (changed) {
		lines.push(
			`Formatting is already correct; the ${bytes}-byte result is over`,
			`the ${MAX_INLINE_FORMATTED_BYTES}-byte inline limit, so call`,
			`format_code with this file_path and language "${language}" to`,
			"see the formatted text.",
		);
	} else if (hasFormatter) {
		lines.push(
			"The text you sent was already correctly formatted, so only the",
			"findings above remain. Fix them and call write_formatted again.",
		);
	} else {
		lines.push(
			`This workspace policy does not format ${language}, so the text`,
			"was checked exactly as you sent it. Fix the findings above and",
			"call write_formatted again.",
		);
	}
	return lines.join("\n");
}

/**
 * Renders the report for a formatter failure, alongside the raw scan.
 *
 * The raw scan runs with formatting already satisfied so the response carries
 * the formatter failure and the documentation findings without repeating the
 * same formatter message twice.
 *
 * @param {string} filePath - Target path that was not written.
 * @param {{kind?: string, text?: string}} result - Formatter command outcome.
 * @param {{verdict: string, report: string}} verdict - Documentation scan of the raw text.
 * @returns {string} Multi-line blocking report.
 */
function formatterFailureReport(filePath, result, verdict) {
	const lines = [
		`${PREFIX}The managed formatter could not process ${filePath}.`,
		"Nothing was written.",
		"",
		String(result?.text ?? "The formatter produced no output."),
	];
	if (verdict.verdict === "pass") {
		lines.push(
			"",
			`${PREFIX}The documentation check passed, so only the`,
			"formatting is at fault. Fix the formatter problem above and call",
			"write_formatted again.",
		);
		return lines.join("\n");
	}
	if (verdict.verdict === "skipped") {
		lines.push(
			"",
			`${PREFIX}The documentation check was skipped for this path.`,
		);
		return lines.join("\n");
	}
	lines.push(
		"",
		`${PREFIX}The documentation scan of your unformatted text also`,
		"found problems, so one response covers both:",
		"",
		verdict.report,
	);
	return lines.join("\n");
}

/**
 * Refuses a request whose declared language contradicts the path.
 *
 * The formatter is picked from the language and the parser from the path, so a
 * disagreement means one of the two is wrong about the bytes. Refusing beats
 * formatting a file with a parser that will mangle it.
 *
 * @param {string} filePath - Path that disagrees with the request.
 * @param {string} own - Language the path extension states.
 * @param {string} declared - Language the caller declared.
 * @param {typeof import("../hook/run.mjs")} run - Validator module namespace.
 * @param {Record<string, unknown>} policy - Policy supplying compose patterns.
 * @returns {string} Refusal text naming both readings.
 */
function mismatchReport(filePath, own, declared, run, policy) {
	return [
		`${PREFIX}Declared language "${declared}" contradicts ${filePath}.`,
		`That path is ${own} and formats with ${FORMATTER_BY_LANGUAGE[own]}; ` +
			`${declared} formats with ${FORMATTER_BY_LANGUAGE[declared]}.`,
		"Nothing was written: running one language formatter over another " +
			"language bytes is how files get mangled.",
		`Pass language "${own}" for this file_path. ` +
			skillPointer(run, filePath, policy),
	].join("\n");
}

/**
 * Refuses a Rust path, which this plugin deliberately does not format.
 *
 * @param {string} filePath - Rust path the request pointed at.
 * @param {string} declared - Language the caller declared.
 * @param {typeof import("../hook/run.mjs")} run - Validator module namespace.
 * @param {Record<string, unknown>} policy - Policy supplying compose patterns.
 * @returns {string} Refusal text naming the project-toolchain rule.
 */
function rustReport(filePath, declared, run, policy) {
	return [
		`${PREFIX}${filePath} is Rust, which this plugin does not format.`,
		"rustfmt belongs to the project toolchain, so it is not offered as a " +
			`managed formatter here, and declaring "${declared}" cannot change ` +
			"that.",
		"Use the plain write tool for this file and run cargo fmt yourself.",
		skillPointer(run, filePath, policy),
	].join("\n");
}

/**
 * Refuses a path no managed formatter is wired up for.
 *
 * @param {string} filePath - Path outside every formatter mapping.
 * @param {string} declared - Language the caller declared.
 * @param {typeof import("../hook/run.mjs")} run - Validator module namespace.
 * @param {Record<string, unknown>} policy - Policy supplying compose patterns.
 * @returns {string} Refusal text pointing at the plain write tool.
 */
function unformattableReport(filePath, declared, run, policy) {
	return [
		`${PREFIX}No managed formatter is wired up for ${filePath}, so this ` +
			"tool has nothing to do.",
		`The declared "${declared}" cannot make an unknown extension ` +
			"formatter-backed: the formatter is chosen from the path so the " +
			"parser matches the bytes.",
		"Use the plain write tool; the documentation gate still checks the " +
			"file exactly as sent.",
		skillPointer(run, filePath, policy),
	].join("\n");
}

/**
 * Refuses a format preview where the policy switched that language off.
 *
 * @param {string} filePath - Path whose formatting is switched off.
 * @param {string} declared - Language the caller declared.
 * @param {typeof import("../hook/run.mjs")} run - Validator module namespace.
 * @param {Record<string, unknown>} policy - Policy supplying compose patterns.
 * @returns {string} Refusal text pointing at the setting and write_formatted.
 */
function noFormatterPreviewReport(filePath, declared, run, policy) {
	return [
		`${PREFIX}This workspace policy does not format ${declared}, so a ` +
			"format preview has nothing to show.",
		`Formatting ${filePath} would need the ` +
			`${FORMATTER_BY_LANGUAGE[declared]} toggle for that language ` +
			"switched on in the coding-doc-standard settings.",
		"Use write_formatted instead: it still checks the documentation and " +
			"writes the file as sent.",
		skillPointer(run, filePath, policy),
	].join("\n");
}

/**
 * Picks the write tool name this host actually registers.
 *
 * @param {{get?: (name: string, scope?: unknown) => unknown}} tools - Tool runtime.
 * @param {unknown} agent - Calling agent, tried first as the scope key.
 * @returns {string} Registered write tool name, defaulting to `write`.
 */
function resolveWriteToolName(tools, agent) {
	const candidates = ["write", "functions.write"];
	if (typeof tools?.get !== "function") return candidates[0];
	for (const scope of [agent, undefined]) {
		for (const candidate of candidates) {
			try {
				if (tools.get(candidate, scope)) return candidate;
			} catch {
				// A scope this runtime cannot resolve just means "try the next".
			}
		}
	}
	return candidates[0];
}

/**
 * Mints one call id correlated with the enclosing call.
 *
 * @param {string} [parentCallId] - Enclosing call identity, when known.
 * @param {string} toolName - Tool being dispatched.
 * @returns {string} Unique call id for the inner dispatch.
 */
function mintCallId(parentCallId, toolName) {
	const prefix = parentCallId ? String(parentCallId) : "coding-doc-standard";
	return `${prefix}:${toolName}:${randomUUID()}`;
}

/**
 * Dispatches the inner write and keeps the self-dispatch token for its lifetime.
 *
 * @param {object} options - Dispatch inputs.
 * @param {string} options.filePath - Path handed to the write tool.
 * @param {string} options.content - Formatted content handed to the write tool.
 * @param {{callId?: string, rootCallId?: string, token?: unknown, agent?: unknown, signal?: AbortSignal}} options.exec - Enclosing tool execution.
 * @param {{execute?: (input: object) => Promise<any>}} options.tools - Tool runtime.
 * @returns {Promise<{name: string, result: any}>} Inner tool name and settled result.
 * @throws {Error} When no tool dispatcher is reachable.
 */
async function dispatchWrite({ filePath, content, exec, tools }) {
	if (typeof tools?.execute !== "function")
		throw new Error(
			`${PREFIX}This host exposes no tool dispatcher, so nothing was ` +
				"written. Format with format_code and write the result yourself.",
		);
	const name = resolveWriteToolName(tools, exec?.agent);
	// Always stamp a parent. The registry mints its own correlation
	// token per execution, so a host that hands this tool one supplies a
	// real key; when it does not, a synthetic unique stamp keeps the
	// inner call a transport sub-dispatch, which is what makes it legal
	// where a direct call to the write tool would be collapsed.
	const token = exec?.token ?? `${SELF_TOKEN_PREFIX}:${randomUUID()}`;
	selfDispatched.add(token);
	try {
		const result = await tools.execute({
			callId: mintCallId(exec?.callId, name),
			rootCallId: exec?.rootCallId,
			name,
			arguments: { file_path: filePath, content },
			agent: exec?.agent,
			parent: token,
			signal: exec?.signal,
		});
		return { name, result };
	} finally {
		if (token !== undefined && token !== null) selfDispatched.delete(token);
	}
}

/**
 * Renders one receipt as the model-facing tool output.
 *
 * @param {Record<string, unknown>} value - Receipt produced by `formatAndWrite`.
 * @returns {{type: string, text: string}[]} Rendered content blocks.
 */
export function renderReceipt(value) {
	const applied = value?.applied === true;
	const target = String(value?.file_path ?? "the file");
	const formatter = value?.formatter ?? "none";
	const via =
		formatter === "none" ? "with no managed formatter" : `via ${formatter}`;
	const delta =
		value?.changed === true
			? `${value.bytes_before} to ${value.bytes_after} bytes, ${value.lines_before} to ${value.lines_after} lines`
			: "already formatted";
	const head = applied
		? `Wrote ${target} ${via} (${delta}).`
		: `Formatted ${target} ${via} (${delta}). Not written: this was a preview.`;
	const lines = [
		head,
		`Documentation check: ${value?.validation ?? "skipped"}.`,
	];
	const note = typeof value?.note === "string" ? value.note : "";
	if (note !== "") lines.push("", note);
	if (typeof value?.formatted_content === "string")
		lines.push(
			"",
			applied
				? "Formatted content:"
				: "Formatted content; call write_formatted to write it once the checks pass:",
			"",
			fenced(value.formatted_content),
		);
	return [{ type: "text", text: lines.join("\n") }];
}

/**
 * Runs one full write-through cycle, with or without the write.
 *
 * The documentation check always runs against the bytes that would actually
 * land, so reported line numbers match the file. When the formatter itself
 * fails, the check still runs against the raw text so one response carries
 * both problems instead of one per round trip.
 *
 * @param {object} options - One write-through request.
 * @param {string} options.filePath - Target path; it is the evidence the declared language is checked against, and it need not exist yet.
 * @param {string} options.content - Complete pending file text.
 * @param {string} options.language - Declared language key; it must agree with the path.
 * @param {string[]} [options.formatterArgs] - Extra arguments for the pinned formatter.
 * @param {{callId?: string, rootCallId?: string, token?: unknown, agent?: unknown, signal?: AbortSignal}} [options.exec] - Enclosing tool execution that owns the dispatch.
 * @param {{execute?: (input: object) => Promise<any>, get?: (name: string, scope?: unknown) => unknown}} [options.tools] - Tool runtime for the inner write.
 * @param {typeof import("../hook/run.mjs")} options.run - Validator module namespace.
 * @param {Record<string, unknown>} options.policy - Effective policy.
 * @param {string} [options.cwd] - Workspace root for the checks.
 * @param {boolean} writes - True to land the file, false to preview only.
 * @returns {Promise<Record<string, unknown>>} Receipt of what was written or previewed.
 * @throws {Error} When the request is refused or nothing was written; the message carries every finding.
 */
async function runThrough(options, writes) {
	const {
		filePath,
		content,
		language,
		formatterArgs = [],
		exec = {},
		tools = null,
		run,
		policy = {},
	} = options;
	if (typeof filePath !== "string" || filePath === "")
		throw new Error(`${PREFIX}file_path is required.`);
	if (typeof language !== "string" || language.trim() === "")
		throw new Error(
			`${PREFIX}language is required: pass one of ` +
				`${supportedLanguages()}, so the formatter and the checker are ` +
				"chosen explicitly instead of guessed from a name. " +
				skillPointer(run, String(filePath), policy),
		);
	if (!(language in SELECTORS))
		throw new Error(
			`${PREFIX}Unsupported language "${language}". Supported: ` +
				`${supportedLanguages()}. ` +
				skillPointer(run, String(filePath), policy),
		);
	const own = languageOfExtension(filePath, run, policy);
	if (own === "rust")
		throw new Error(rustReport(filePath, language, run, policy));
	if (own === null)
		throw new Error(unformattableReport(filePath, language, run, policy));
	if (own !== language)
		throw new Error(mismatchReport(filePath, own, language, run, policy));
	const cwd = options.cwd ?? exec?.agent?.session?.header?.cwd ?? process.cwd();
	const enforcing = policy?.enabled !== false;
	const available = languageForPath(filePath, run, policy);
	if (writes !== true && available === null)
		throw new Error(noFormatterPreviewReport(filePath, language, run, policy));
	const before = measure(content);
	let formatted = content;
	const hasFormatter = available !== null;
	if (hasFormatter) {
		const encoded = Buffer.from(content, "utf8").toString("base64");
		const extra = (formatterArgs ?? [])
			.map((argument) => JSON.stringify(argument))
			.join(" ");
		const rawInput =
			`${SELECTORS[language]} --file ${JSON.stringify(filePath)}` +
			` --content-base64 ${encoded}${extra ? ` -- ${extra}` : ""}`;
		const signal = exec?.signal ?? new AbortController().signal;
		const result = await runFormatterCommand(rawInput, cwd, signal);
		if (result.kind !== "success" || result.formattedContent === undefined) {
			const raw = await assessCandidate(
				{ path: filePath, content },
				{
					run,
					policy: { ...policy, formatOnWrite: false },
					cwd,
					enforcing,
				},
			);
			throw new Error(formatterFailureReport(filePath, result, raw));
		}
		formatted = result.formattedContent;
	}
	const after = measure(formatted);
	const verdict = await assessCandidate(
		{ path: filePath, content: formatted },
		{
			run,
			policy: hasFormatter ? { ...policy, formatOnWrite: false } : policy,
			cwd,
			enforcing,
		},
	);
	const base = {
		file_path: filePath,
		language,
		formatter: hasFormatter ? FORMATTER_BY_LANGUAGE[language] : "none",
		changed: formatted !== content,
		bytes_before: before.bytes,
		bytes_after: after.bytes,
		lines_before: before.lines,
		lines_after: after.lines,
		validation: verdict.verdict,
		findings: verdict.findings,
		note: verdict.report,
	};
	if (writes !== true)
		return { ...base, applied: false, formatted_content: formatted };
	if (verdict.verdict === "issues")
		throw new Error(
			notWrittenReport(filePath, verdict, {
				formatted,
				changed: base.changed,
				hasFormatter,
				language,
			}),
		);
	if (verdict.verdict === "incomplete" && policy.validatorFailOpen === false)
		throw new Error(
			`${verdict.report}\n\n${PREFIX}Blocked because ` +
				`validatorFailOpen is off: an incomplete check cannot pass.`,
		);
	if (exec?.signal?.aborted)
		throw new Error(
			`${PREFIX}Cancelled before writing ${filePath}; nothing was written.`,
		);
	const dispatched = await dispatchWrite({
		filePath,
		content: formatted,
		exec,
		tools,
	});
	if (dispatched.result?.isError) {
		const failure = dispatched.result?.error?.message
			? String(dispatched.result.error.message)
			: String(dispatched.result?.content ?? "the write tool failed");
		throw new Error(
			`${PREFIX}${dispatched.name} refused the formatted text for ` +
				`${filePath}. Formatting and checks passed:\n${failure}`,
		);
	}
	return { ...base, applied: true };
}

/**
 * Formats one candidate, checks the formatted bytes, and writes them when clean.
 *
 * This is the only path in the plugin that lands a file. It is deliberately
 * separate from the preview: a tool that could do both is a tool whose callers
 * cannot tell what it just did, so `format_code` previews and this writes.
 *
 * @param {object} options - One write-through request.
 * @param {string} options.filePath - Target path, which need not exist yet.
 * @param {string} options.content - Complete pending file text.
 * @param {string} options.language - Declared language key, matching the path.
 * @param {string[]} [options.formatterArgs] - Extra formatter arguments.
 * @param {{callId?: string, rootCallId?: string, token?: unknown, agent?: unknown, signal?: AbortSignal}} [options.exec] - Enclosing tool execution.
 * @param {{execute?: (input: object) => Promise<any>, get?: (name: string, scope?: unknown) => unknown}} [options.tools] - Tool runtime for the inner write.
 * @param {typeof import("../hook/run.mjs")} options.run - Validator module namespace.
 * @param {Record<string, unknown>} options.policy - Effective policy.
 * @param {string} [options.cwd] - Workspace root for the checks.
 * @returns {Promise<Record<string, unknown>>} Receipt of the write.
 * @throws {Error} When the request is refused or the checks blocked the write.
 */
export function formatAndWrite(options) {
	return runThrough(options, true);
}

/**
 * Runs the whole cycle and stops before the filesystem.
 *
 * `format_code` uses this: the caller sees exactly which bytes the formatter
 * produced and what the standard says about them, while no file changes. The
 * caller who wants the file on disk calls `formatAndWrite`, so no single tool
 * can do both and the two can never drift apart.
 *
 * @param {object} options - Same request shape `formatAndWrite` takes, and the
 *   same refusal rules apply before anything is formatted.
 * @returns {Promise<Record<string, unknown>>} Preview receipt carrying `formatted_content`.
 * @throws {Error} When the request is refused or nothing can be previewed.
 */
export function previewFormat(options) {
	return runThrough(options, false);
}
