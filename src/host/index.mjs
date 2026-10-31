/**
 * @module coding-doc-standard-host
 * @author Perijn Huijser
 * Mounts native global pre-write enforcement and persistent settings for the coding documentation standard.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep bundle registration thin and enforce pending writes
 *   inside the asynchronous DSH tool policy pipeline.
 *   Setup: Load this package through its bundle patch in a DSH profile.
 *   Workflow: Resolve settings into one live policy object, then register one
 *   `tools/pre-execute` listener that builds the pending candidate, runs every
 *   check concurrently, and answers with the full finding list in one pass.
 *   API guide: Cordis invokes the exported `apply` lifecycle function, and the
 *   reusable enforcement decision is the exported `evaluatePendingWrite`.
 *   Worked example: The bundle patch inserts this package as coding-doc-standard.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
import {
	packSettingsApply,
	packSettingsFields,
	packSettingsSource,
} from "../engine/pack-settings.mjs";
import { runFormatterCommand } from "../formatter/command.mjs";
import {
	formatAndWrite,
	isSelfDispatch,
	previewFormat,
	renderReceipt,
} from "./write-through.mjs";

/**
 * Identifies the coding documentation standard plugin.
 */
export const name = "coding-doc-standard";

/**
 * Declares the host services required by the plugin.
 *
 * The system-prompt registry is resolved opportunistically rather than through
 * `inject`: the advisory is optional, so a host without that service still gets
 * complete pre-write enforcement.
 */
export const inject = ["commands", "tools"];

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const defaultsPath = join(packageRoot, "src", "policy", "defaults.json");
const statePath = join(homedir(), ".dsh", "plugins", name, "policy.json");
const adapterLanguages = [
	"rust",
	"cCpp",
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
 * Human-readable label and description for one adapter-capable language.
 *
 * @type {Record<string, {label: string, description: string}>}
 */
const adapterLanguageInfo = {
	rust: {
		label: "Rust",
		description: "Opt-in rustdoc missing_docs adapter for public items.",
	},
	cCpp: {
		label: "C / C++",
		description: "Project-owned native adapter for C and C++ public units.",
	},
	go: { label: "Go", description: "Go packages, types, and functions." },
	csharp: { label: "C#", description: "C# classes, members, and delegates." },
	java: { label: "Java", description: "Java types, methods, and fields." },
	kotlin: {
		label: "Kotlin",
		description: "Kotlin classes, functions, and properties.",
	},
	shell: { label: "Shell", description: "Bash and POSIX shell functions." },
	php: { label: "PHP", description: "PHP classes, traits, and functions." },
	ruby: { label: "Ruby", description: "Ruby classes, modules, and methods." },
	swift: {
		label: "Swift",
		description: "Swift types, extensions, and functions.",
	},
	dart: { label: "Dart", description: "Dart classes, mixins, and functions." },
	haskell: {
		label: "Haskell",
		description: "Haskell functions, types, and classes.",
	},
	lua: { label: "Lua", description: "Lua module functions." },
	scala: {
		label: "Scala",
		description: "Scala classes, objects, and definitions.",
	},
};

/**
 * Reads one language's editable adapter hook values from durable policy.
 *
 * @param {Record<string, unknown>} policy - Effective policy configuration.
 * @param {string} language - Policy language key.
 * @returns {{command: string, args: string, cwd: string, timeoutMs: number}} Editable hook values.
 */
function hookSettings(policy, language) {
	const adapter = policy.publicUnitAdapters?.[language] ?? {};
	const saved = policy.hookSettings?.[language] ?? {};
	return {
		command: saved.command ?? adapter.command ?? "",
		args: saved.args ?? (adapter.args ? JSON.stringify(adapter.args) : ""),
		cwd: saved.cwd ?? adapter.cwd ?? "",
		timeoutMs: saved.timeoutMs ?? adapter.timeoutMs ?? 10_000,
	};
}

/**
 * Builds the nested Schemastery section for one language's adapter hook.
 *
 * @param {object} schemaTools - Schemastery module.
 * @param {Record<string, unknown>} policy - Effective policy configuration.
 * @param {string} language - Policy language key.
 * @returns {object} Schemastery object schema for the adapter group.
 */
function adapterSection(schemaTools, policy, language) {
	const current = hookSettings(policy, language);
	return schemaTools
		.object({
			command: schemaTools
				.string()
				.default(current.command)
				.description(
					"Executable that receives one JSON candidate on standard input and answers with { violations: [...] }. Leave empty to disable the adapter.",
				),
			args: schemaTools
				.string()
				.default(current.args)
				.description('Argument array as JSON text, for example ["--strict"].'),
			cwd: schemaTools
				.string()
				.default(current.cwd)
				.description(
					"Optional working directory; empty resolves against the workspace.",
				),
			timeoutMs: schemaTools
				.number()
				.default(current.timeoutMs)
				.min(500)
				.step(500)
				.description("Adapter budget in milliseconds."),
		})
		.collapse(!current.command)
		.description(adapterLanguageInfo[language]?.description ?? "");
}

/**
 * Builds the nested Schemastery sections for every exposed adapter hook.
 *
 * @param {object} schemaTools - Schemastery module.
 * @param {Record<string, unknown>} policy - Effective policy configuration.
 * @returns {object} Schemastery object schema holding every adapter group.
 */
function adapterSettingsSchema(schemaTools, policy) {
	return schemaTools.object(
		Object.fromEntries(
			adapterLanguages.map((language) => [
				language,
				adapterSection(schemaTools, policy, language),
			]),
		),
	);
}

/**
 * Converts nested adapter settings values into executable hook policy.
 *
 * @param {Record<string, Record<string, unknown>>} adapters - Current adapter settings by language.
 * @returns {{hookSettingsByLanguage: object, publicUnitAdapters: object}} Durable hook policy.
 */
function configuredHooks(adapters) {
	const hookSettingsByLanguage = {};
	const publicUnitAdapters = {};
	for (const language of adapterLanguages) {
		const group = adapters?.[language] ?? {};
		const command = String(group.command ?? "").trim();
		const argsText = String(group.args ?? "").trim();
		const cwd = String(group.cwd ?? "").trim();
		const timeoutMs =
			Number(group.timeoutMs) > 0 ? Number(group.timeoutMs) : 10_000;
		hookSettingsByLanguage[language] = {
			command,
			args: argsText,
			cwd,
			timeoutMs,
		};
		if (!command) continue;
		let args = [];
		try {
			const parsed = argsText ? JSON.parse(argsText) : [];
			if (
				Array.isArray(parsed) &&
				parsed.every((item) => typeof item === "string")
			)
				args = parsed;
		} catch {}
		publicUnitAdapters[language] = {
			command,
			args,
			...(cwd ? { cwd } : {}),
			timeoutMs,
		};
	}
	return { hookSettingsByLanguage, publicUnitAdapters };
}

/**
 * Loads the packaged defaults and any persisted user policy.
 *
 * @returns {Promise<Record<string, unknown>>} Effective policy object.
 */
export async function loadPolicy() {
	const defaults = JSON.parse(await readFile(defaultsPath, "utf8"));
	if (!existsSync(statePath)) return defaults;
	try {
		const override = JSON.parse(await readFile(statePath, "utf8"));
		const policy = {
			...defaults,
			...override,
			languages: { ...defaults.languages, ...override.languages },
			publicUnitDocs: {
				...defaults.publicUnitDocs,
				...override.publicUnitDocs,
			},
		};
		for (const language of adapterLanguages) {
			if (!["rust", "cCpp"].includes(language))
				policy.publicUnitDocs[language] = policy.languages[language] !== false;
		}
		return policy;
	} catch {
		return defaults;
	}
}

/**
 * Atomically persists the effective policy outside the installed package.
 *
 * @param {Record<string, unknown>} policy - Effective policy to persist.
 * @returns {Promise<void>} Completion once replacement succeeds.
 */
export async function savePolicy(policy) {
	const directory = dirname(statePath);
	const temporary = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
	await mkdir(directory, { recursive: true });
	await writeFile(temporary, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
	await rename(temporary, statePath);
}

/**
 * Tool names guarded when the policy names no explicit matchers.
 */
const DEFAULT_MATCHED_TOOLS = [
	"write",
	"edit",
	"functions.write",
	"functions.edit",
];

/**
 * Name of this plugin's system-prompt advisory section.
 */
const ADVISORY_SECTION = "plugin:coding-doc-standard";

/**
 * Lazily loaded candidate-validator module.
 *
 * @type {typeof import("../hook/run.mjs") | null}
 */
let validatorModule = null;

/**
 * Loads the candidate validator once per process.
 *
 * Lazy loading means an unmatched tool name never pays for the validator, while
 * the live host and the standalone CLI hook keep sharing one implementation.
 *
 * @returns {Promise<typeof import("../hook/run.mjs")>} Validator module namespace.
 */
async function validator() {
	if (!validatorModule) validatorModule = await import("../hook/run.mjs");
	return validatorModule;
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
 * Splits one list-typed setting into trimmed entries.
 *
 * @param {unknown} value - Comma- or newline-separated text, or a string array.
 * @returns {string[]} Non-empty trimmed entries.
 */
function splitList(value) {
	const items = Array.isArray(value)
		? value
		: String(value ?? "").split(/[,\n]/u);
	return items.map((item) => String(item).trim()).filter((item) => item !== "");
}

/**
 * Renders one policy list as an editable settings string.
 *
 * @param {unknown} value - Policy list value.
 * @returns {string} Comma-separated entries.
 */
function joinList(value) {
	return splitList(value).join(", ");
}

/**
 * Matches one pending tool name against the configured matchers.
 *
 * Exact names are compared first, so a glob compiler is loaded only when the
 * configured list actually contains a wildcard.
 *
 * @param {string} toolName - Name of the pending tool call.
 * @param {string[]} matchers - Configured tool names or glob patterns.
 * @returns {Promise<boolean>} True when the tool is guarded.
 */
async function isMatchedTool(toolName, matchers) {
	if (matchers.includes(toolName)) return true;
	if (!matchers.some((matcher) => /[*?]/u.test(matcher))) return false;
	const run = await validator();
	return matchers.some(
		(matcher) =>
			matcher === toolName || run.globToRegExp(matcher).test(toolName),
	);
}

/**
 * Decides one pending write or edit without blocking the event loop.
 *
 * Builds the candidate, runs every applicable check concurrently, and renders
 * the complete finding list so the agent can fix everything in a single pass.
 * A candidate that cannot be built is never reported as a violation.
 *
 * @param {{name?: string, arguments?: unknown, signal?: AbortSignal, agent?: {session?: {header?: {cwd?: string}}}}} execution - Pending tool execution.
 * @param {Record<string, unknown>} [policy] - Effective policy.
 * @param {{cwd?: string, logger?: {warn?: (message: string) => void}}} [options] - Workspace override and diagnostics sink.
 * @returns {Promise<{action: "skip" | "allow" | "warn" | "deny", reason?: string, path?: string, elapsedMs: number}>} Enforcement decision.
 */
export async function evaluatePendingWrite(
	execution,
	policy = {},
	options = {},
) {
	const started = Date.now();
	const elapsed = () => Date.now() - started;
	if (!policy || policy.enabled === false)
		return { action: "skip", elapsedMs: elapsed() };
	// A write that write_formatted dispatched itself was already checked in
	// full before it reached the write tool, so validating it again would
	// duplicate every finding and run the formatter a second time.
	if (isSelfDispatch(execution?.parent))
		return { action: "skip", elapsedMs: elapsed() };
	const matchers =
		Array.isArray(policy.matchedTools) && policy.matchedTools.length
			? policy.matchedTools.map(String)
			: DEFAULT_MATCHED_TOOLS;
	const toolName = String(execution?.name ?? "");
	if (!(await isMatchedTool(toolName, matchers)))
		return { action: "skip", elapsedMs: elapsed() };
	let run;
	try {
		run = await validator();
	} catch (error) {
		options.logger?.warn?.(
			`[doc-standard] validator unavailable: ${error.message}`,
		);
		return { action: "skip", elapsedMs: elapsed() };
	}
	let built;
	try {
		built = await run.buildCandidate(
			{ tool_input: execution?.arguments ?? {} },
			policy,
		);
	} catch (error) {
		options.logger?.warn?.(
			`[doc-standard] could not read the pending change: ${error.message}`,
		);
		return { action: "skip", elapsedMs: elapsed() };
	}
	if (!built.applicable)
		return { action: "skip", reason: built.reason, elapsedMs: elapsed() };
	const path = built.candidate.path;
	if (execution?.signal?.aborted)
		return { action: "skip", path, elapsedMs: elapsed() };
	const max = positiveNumber(policy.aggregateMaxFindings, 15);
	const result = await run.validateCandidate(built.candidate, policy, {
		timeoutMs: positiveNumber(policy.validatorTimeoutMs, 20_000),
		cwd: options.cwd ?? execution?.agent?.session?.header?.cwd ?? process.cwd(),
	});
	if (execution?.signal?.aborted)
		return { action: "skip", path, elapsedMs: elapsed() };
	if (result.status === "violations")
		return {
			action: "deny",
			reason: run.renderFindings(result, { max }),
			path,
			elapsedMs: result.elapsedMs,
		};
	if (result.status === "pass")
		return { action: "allow", path, elapsedMs: result.elapsedMs };
	const report = run.renderFindings(result, { max });
	if (policy.validatorFailOpen === false)
		return {
			action: "deny",
			reason: `${report}\n\n[doc-standard] Blocked because validatorFailOpen is off: an incomplete check cannot pass.`,
			path,
			elapsedMs: result.elapsedMs,
		};
	return {
		action: "warn",
		reason: `${report}\n\n[doc-standard] Allowed: the check could not finish. Run /coding-doc-verify for the full report.`,
		path,
		elapsedMs: result.elapsedMs,
	};
}

/**
 * Surfaces one non-blocking notice to the agent that triggered the write.
 *
 * The notice rides the pending execution's own deferred context, so it reaches
 * the model with that tool result instead of failing or silently passing.
 *
 * @param {{deferContext?: (message: unknown) => void}} execution - Pending tool execution.
 * @param {string} text - Model-facing notice text.
 * @returns {Promise<void>} Completion once the notice is queued or dropped.
 */
export async function notifyDeferred(execution, text) {
	const message = String(text ?? "").trim();
	if (!message || typeof execution?.deferContext !== "function") return;
	try {
		const llm = await import("@deepseek-ai/dsh-llm");
		const create = llm.createUserMessage ?? llm.default?.createUserMessage;
		if (typeof create !== "function") return;
		const bound =
			typeof llm.boundContextSummary === "function"
				? llm.boundContextSummary
				: (value) => value.slice(0, 120);
		execution.deferContext(
			create({
				content: [{ type: "text", text: message }],
				source: {
					kind: "plugin",
					plugin: name,
					form: "notice",
					summary: bound(message.split("\n", 1)[0]),
				},
			}),
		);
	} catch {
		// A notice is advisory only and must never change a write outcome.
	}
}

/**
 * Resolves the system-prompt registry without declaring a hard dependency.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @returns {{section: (section: object) => (() => void)} | null} Prompt registry, or null when absent.
 */
function resolveSystemPrompt(ctx) {
	try {
		const viaReflect = ctx.reflect?.get?.("systemPrompt", false);
		if (viaReflect) return viaReflect;
		return ctx.systemPrompt ?? null;
	} catch {
		return null;
	}
}

/**
 * Builds the standing model-facing advisory for the current policy.
 *
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {string} System-prompt section text.
 */
function advisoryText(policy) {
	const lines = [
		"coding-doc-standard enforces this workspace's documentation and formatter policy on every write and edit before the change lands.",
		"",
		"- Read the rules before writing: skill coding-doc-standard, then the reference file for the language you are editing. Guessing the header format is the usual cause of a denial.",
		"- Put the required file header and the documentation of every public unit in the same draft as the code, not in a follow-up edit.",
		"- Call write_formatted with the intended file_path, the complete content, and the language you are writing: it formats, checks, and writes in one step.",
		"- language is required and must match file_path; a mismatch, a Rust path, and a path with no managed formatter are refused rather than guessed at.",
		"- format_code runs the same check and never writes, so use it to read the formatted text before you land it.",
		"- A denial lists every finding for that file at once, with the rule reference that fixes them. Fix them all, then retry once.",
		"- Vendored, generated, minified, and lockfile paths are never blocked.",
		"- Run /coding-doc-verify for a whole-workspace report.",
	];
	if (policy?.validatorFailOpen === false)
		lines.push(
			"- This workspace runs fail-closed: a check that cannot finish also blocks the write.",
		);
	return lines.join("\n");
}

/**
 * Registers the setting-gated system-prompt advisory.
 *
 * The caller owns the master switch and decides whether enforcement is running
 * at all; this function only answers whether the advisory's own setting permits
 * a registration.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {(() => void) | null} Disposer for the section, or null when nothing was registered.
 */
export function installSystemAdvisory(ctx, policy) {
	if (!policy || policy.systemPromptAdvisory === false) return null;
	const service = resolveSystemPrompt(ctx);
	if (!service || typeof service.section !== "function") return null;
	try {
		return service.section({
			name: ADVISORY_SECTION,
			order: 120,
			text: advisoryText(policy),
		});
	} catch (error) {
		ctx.logger?.warn?.(
			`coding-doc-standard: system prompt unavailable: ${error.message}`,
		);
		return null;
	}
}

/**
 * Installs the settings section and keeps durable policy in step with it.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @param {Record<string, unknown>} policy - Effective policy at startup.
 * @param {(policy: Record<string, unknown>) => unknown} [onPolicy] - Called with the persisted policy after every settings change.
 * @returns {Promise<void>} Completion once the section is installed.
 */
async function installSettings(ctx, policy, onPolicy) {
	try {
		const settings = await import("@deepseek-ai/dsh-settings");
		const schemaModule = await import("@deepseek-ai/schemastery");
		const schemaTools = schemaModule.default ?? schemaModule;
		if (
			typeof settings.installSettingsSection !== "function" ||
			typeof settings.settingsNamespace !== "function"
		)
			return;
		// The panel's own view of the policy. Kept fresh across changes so a
		// rapid sequence of edits can never rebuild the next policy from a
		// stale startup snapshot.
		let current = policy;
		/**
		 * Builds one described language toggle.
		 *
		 * @param {string} key - Policy language key.
		 * @param {string} description - UI description for the toggle.
		 * @returns {object} Schemastery boolean field.
		 */
		const languageToggle = (key, description) =>
			schemaTools
				.boolean()
				.default(current.languages[key] !== false)
				.description(description);
		const schema = schemaTools.object({
			general: schemaTools
				.object({
					enabled: schemaTools
						.boolean()
						.default(current.enabled !== false)
						.description(
							"Master switch: when off, the write guard, both commands, and both write-through tools are retracted.",
						),
					systemPromptAdvisory: schemaTools
						.boolean()
						.default(current.systemPromptAdvisory !== false)
						.description(
							"Standing system-prompt note that tells the agent the documentation rules before it writes.",
						),
					validatorTimeoutMs: schemaTools
						.number()
						.default(positiveNumber(current.validatorTimeoutMs, 20_000))
						.min(1000)
						.step(1000)
						.description(
							"Shared time budget in milliseconds for every check on one pending write.",
						),
					aggregateMaxFindings: schemaTools
						.number()
						.default(positiveNumber(current.aggregateMaxFindings, 15))
						.min(1)
						.step(1)
						.description("Maximum number of findings listed in one denial."),
					validatorFailOpen: schemaTools
						.boolean()
						.default(current.validatorFailOpen !== false)
						.description(
							"Allow the write with a visible notice when a check could not finish. Turn off to block instead.",
						),
					matchedTools: schemaTools
						.string()
						.default(joinList(current.matchedTools))
						.description(
							"Comma-separated tool names or globs the guard watches, for example mcp__*__write_file.",
						),
					ignoredPaths: schemaTools
						.string()
						.default(joinList(current.ignoredPaths))
						.description(
							"Extra glob paths to skip. Vendored, generated, minified, and lockfile paths are always skipped.",
						),
				})
				.description("Core gate behavior shared by every language."),
			languages: schemaTools
				.object({
					python: languageToggle(
						"python",
						"Python modules, docstring headers, and public docstrings.",
					),
					typescriptJavascript: languageToggle(
						"typescriptJavascript",
						"TypeScript and JavaScript, including optional JSDoc export checks.",
					),
					rust: languageToggle(
						"rust",
						"Rust file headers and public-unit docs.",
					),
					cCpp: languageToggle(
						"cCpp",
						"C and C++ Doxygen headers and public units.",
					),
					dockerCompose: languageToggle(
						"dockerCompose",
						"Compose root and service documentation.",
					),
					go: languageToggle("go", "Go package headers and declarations."),
					csharp: languageToggle(
						"csharp",
						"C# XML documentation headers and members.",
					),
					java: languageToggle("java", "Java Javadoc headers and members."),
					kotlin: languageToggle(
						"kotlin",
						"Kotlin KDoc headers and declarations.",
					),
					shell: languageToggle("shell", "Shell script headers and functions."),
					php: languageToggle("php", "PHP doc headers and declarations."),
					ruby: languageToggle("ruby", "Ruby headers, classes, and methods."),
					swift: languageToggle("swift", "Swift headers and declarations."),
					dart: languageToggle("dart", "Dart headers and declarations."),
					haskell: languageToggle(
						"haskell",
						"Haskell Haddock headers and declarations.",
					),
					lua: languageToggle("lua", "Lua EmmyLua headers and functions."),
					scala: languageToggle(
						"scala",
						"Scala Scaladoc headers and definitions.",
					),
				})
				.description("Turn individual language profiles on or off."),
			formatting: schemaTools
				.object({
					formatOnWrite: schemaTools
						.boolean()
						.default(current.formatOnWrite !== false)
						.description(
							"Enable the pinned pre-write formatter routing below.",
						),
					formatPython: schemaTools
						.boolean()
						.default(current.formatPython !== false)
						.description("Format Python writes with pinned Ruff."),
					formatTypescriptJavascript: schemaTools
						.boolean()
						.default(current.formatTypescriptJavascript !== false)
						.description(
							"Format TypeScript and JavaScript writes with pinned Biome.",
						),
					formatRust: schemaTools
						.boolean()
						.default(current.formatRust === true)
						.description(
							"Opt-in: format Rust writes with the project's rustfmt.",
						),
					formatDockerCompose: schemaTools
						.boolean()
						.default(current.formatDockerCompose !== false)
						.description("Format Compose writes with pinned Prettier."),
					blockOnMissingFormatter: schemaTools
						.boolean()
						.default(current.blockOnMissingFormatter !== false)
						.description(
							"Block a write when its pinned formatter is not provisioned. Turn off to allow unformatted writes with a notice.",
						),
				})
				.description("Pinned pre-write formatter routing."),
			adapters: adapterSettingsSchema(schemaTools, current),
			packs: packSettingsFields(schemaTools, current),
		});
		let source = () => ({
			general: {
				enabled: current.enabled !== false,
				systemPromptAdvisory: current.systemPromptAdvisory !== false,
				validatorTimeoutMs: positiveNumber(current.validatorTimeoutMs, 20_000),
				aggregateMaxFindings: positiveNumber(current.aggregateMaxFindings, 15),
				validatorFailOpen: current.validatorFailOpen !== false,
				matchedTools: joinList(current.matchedTools),
				ignoredPaths: joinList(current.ignoredPaths),
			},
			languages: { ...current.languages },
			formatting: {
				formatOnWrite: current.formatOnWrite,
				formatPython: current.formatPython,
				formatTypescriptJavascript: current.formatTypescriptJavascript,
				formatRust: current.formatRust,
				formatDockerCompose: current.formatDockerCompose,
				blockOnMissingFormatter: current.blockOnMissingFormatter,
			},
			adapters: Object.fromEntries(
				adapterLanguages.map((language) => [
					language,
					hookSettings(current, language),
				]),
			),
			packs: packSettingsSource(current),
		});
		settings.installSettingsSection(
			ctx,
			settings.settingsNamespace(name),
			schema,
			source(),
			{
				setSource: (next) => {
					source = next;
				},
				onChange: async () => {
					const value = source();
					const general = value.general ?? {};
					const languages = value.languages ?? {};
					const formatting = value.formatting ?? {};
					const { hookSettingsByLanguage, publicUnitAdapters } =
						configuredHooks(value.adapters);
					const next = {
						...current,
						enabled: general.enabled !== false,
						systemPromptAdvisory: general.systemPromptAdvisory !== false,
						validatorTimeoutMs: positiveNumber(
							general.validatorTimeoutMs,
							20_000,
						),
						aggregateMaxFindings: positiveNumber(
							general.aggregateMaxFindings,
							15,
						),
						validatorFailOpen: general.validatorFailOpen !== false,
						matchedTools: splitList(general.matchedTools),
						ignoredPaths: splitList(general.ignoredPaths),
						formatOnWrite: formatting.formatOnWrite !== false,
						formatPython: formatting.formatPython !== false,
						formatTypescriptJavascript:
							formatting.formatTypescriptJavascript !== false,
						formatRust: formatting.formatRust === true,
						formatDockerCompose: formatting.formatDockerCompose !== false,
						blockOnMissingFormatter:
							formatting.blockOnMissingFormatter !== false,
						hookSettings: hookSettingsByLanguage,
						publicUnitAdapters,
						publicUnitDocs: {
							...Object.fromEntries(
								adapterLanguages.map((language) => [
									language,
									languages[language] === true &&
										(!["rust", "cCpp"].includes(language) ||
											Boolean(publicUnitAdapters[language])),
								]),
							),
							typescriptJavascript: languages.typescriptJavascript === true,
						},
						languages: { ...current.languages, ...languages },
						packProfiles: packSettingsApply(value.packs, current),
					};
					current = next;
					await savePolicy(next);
					await onPolicy?.(next);
				},
			},
		);
	} catch (error) {
		ctx.logger?.warn?.(
			`coding-doc-standard: settings unavailable: ${error.message}`,
		);
	}
}

/**
 * Splits the command's optional CLI-style arguments without invoking a shell.
 *
 * @param {string} rawInput - Text entered after `/coding-doc-verify`.
 * @returns {string[]} Verifier arguments with matching outer quotes removed.
 */
function parseVerifyArguments(rawInput) {
	return (rawInput.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/gu) ?? []).map(
		(argument) => {
			if (
				(argument.startsWith('"') && argument.endsWith('"')) ||
				(argument.startsWith("'") && argument.endsWith("'"))
			)
				return argument.slice(1, -1);
			return argument;
		},
	);
}

/**
 * Runs the package verifier in the invoking session's workspace.
 *
 * @param {string[]} args - Parsed verifier arguments.
 * @param {string} cwd - Workspace used to resolve paths and project tools.
 * @param {AbortSignal} signal - UI-owned cancellation signal.
 * @returns {Promise<{kind: "success", text: string} | {kind: "error", text: string}>} Command outcome.
 */
function runVerification(args, cwd, signal) {
	const verifier = join(packageRoot, "scripts", "verify", "verify.mjs");
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [verifier, ...args], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});
		let output = "";
		const append = (chunk) => {
			output = `${output}${chunk}`.slice(-6000);
		};
		child.stdout.on("data", append);
		child.stderr.on("data", append);
		const abort = () => child.kill();
		signal.addEventListener("abort", abort, { once: true });
		child.once("error", (error) => {
			signal.removeEventListener("abort", abort);
			reject(error);
		});
		child.once("close", (code) => {
			signal.removeEventListener("abort", abort);
			const details = output.trim();
			if (code === 0) {
				resolve({
					kind: "success",
					text:
						details ||
						`Coding Documentation Standard verification passed in ${cwd}.`,
				});
				return;
			}
			resolve({
				kind: "error",
				text:
					details ||
					`Coding Documentation Standard verification failed (exit ${code ?? 1}).`,
			});
		});
	});
}

/**
 * Declares the receipt shared by both write-through tools.
 *
 * One schema keeps the dry run and the applied write telling the same story.
 * `formatted_content` stays optional because an applied write already put
 * those bytes in the file, and a receipt should not repeat a whole file.
 *
 * @returns {object} Output schema for one write-through receipt.
 */
function receiptSchema() {
	const field = (type) => ({ type, required: true });
	return {
		type: "object",
		additionalProperties: false,
		properties: {
			applied: field("boolean"),
			file_path: field("string"),
			language: field("string"),
			formatter: field("string"),
			changed: field("boolean"),
			bytes_before: field("number"),
			bytes_after: field("number"),
			lines_before: field("number"),
			lines_after: field("number"),
			validation: field("string"),
			findings: field("number"),
			note: field("string"),
			formatted_content: { type: "string" },
		},
	};
}

/**
 * Registers the workspace verifier as a DSH command.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @returns {() => void} Disposer that unregisters the command.
 */
function registerVerifyCommand(ctx) {
	return ctx.commands.register({
		name: "coding-doc-verify",
		description:
			"Run Coding Documentation Standard verification for this workspace.",
		input: {
			hint: "[paths\u2026] [--optional] [--doxygen Doxyfile]",
		},
		handler: (invocation) =>
			runVerification(
				parseVerifyArguments(invocation.rawInput),
				invocation.agent.session.header.cwd ?? process.cwd(),
				invocation.signal,
			),
	});
}

/**
 * Registers the managed formatter as a DSH command.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @returns {() => void} Disposer that unregisters the command.
 */
function registerFormatterCommand(ctx) {
	return ctx.commands.register({
		name: "code-formatter",
		description:
			"Run a pinned managed formatter without relying on the agent PATH.",
		input: {
			hint: "<--python|--typescript|--javascript|--docker-compose> --file <path> [-- flags\u2026]",
		},
		handler: (invocation) =>
			runFormatterCommand(
				invocation.rawInput,
				invocation.agent.session.header.cwd ?? process.cwd(),
				invocation.signal,
			),
	});
}

/**
 * Registers the read-only formatter preview tool.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @param {() => Record<string, unknown>} livePolicy - Reader for the current policy.
 * @returns {() => void} Disposer that unregisters the tool.
 */
function registerFormatCode(ctx, livePolicy) {
	return ctx.tools.register(
		defineTool({
			name: "format_code",
			description:
				"Preview one file through the pinned managed formatter and the documentation check without writing anything. The formatted text comes back here; write_formatted is the only tool that lands a change.",
			parameters: {
				file_path: {
					type: "string",
					required: true,
					description:
						"Load-bearing: it selects the formatter, the parser, and the configuration the formatter resolves from the file. Pass the intended workspace path; the file itself need not exist.",
				},
				content: {
					type: "string",
					required: true,
					description: "Complete pending UTF-8 source text.",
				},
				language: {
					type: "string",
					required: true,
					enum: ["python", "typescript", "javascript", "docker-compose"],
					description:
						"Required, and it must match file_path: python for .py, typescript for .ts/.tsx/.mts/.cts, javascript for .js/.jsx/.mjs/.cjs, docker-compose for a compose file. A contradiction is refused instead of formatting the bytes with the wrong parser. Rust is excluded because its formatter is the project toolchain rather than a managed executable.",
				},
				formatter_args: {
					type: "array",
					items: { type: "string" },
				},
			},
			output: {
				schema: receiptSchema(),
				render: (_args, value) => renderReceipt(value),
			},
			isConcurrencySafe: () => true,
			async execute(args, exec) {
				return previewFormat({
					filePath: args.file_path,
					content: args.content,
					language: args.language,
					formatterArgs: args.formatter_args ?? [],
					exec,
					tools: ctx.tools,
					run: await validator(),
					policy: livePolicy(),
					cwd: exec?.agent?.session?.header?.cwd ?? process.cwd(),
				});
			},
		}),
	);
}

/**
 * Registers the write-through tool that lands one formatted, checked file.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @param {() => Record<string, unknown>} livePolicy - Reader for the current policy.
 * @returns {() => void} Disposer that unregisters the tool.
 */
function registerWriteFormatted(ctx, livePolicy) {
	return ctx.tools.register(
		defineTool({
			name: "write_formatted",
			description:
				"Format one complete file, check the formatted text against this workspace standard, and write it in a single call. This is the normal way to land code here: the findings refer to the formatted lines that actually land.",
			parameters: {
				file_path: {
					type: "string",
					required: true,
					description:
						"Intended workspace path. It selects the formatter and the configuration, and the file itself need not exist yet.",
				},
				content: {
					type: "string",
					required: true,
					description: "Complete file text, header and docs included.",
				},
				language: {
					type: "string",
					required: true,
					enum: ["python", "typescript", "javascript", "docker-compose"],
					description:
						"Required, and it must match file_path: python for .py, typescript for .ts/.tsx/.mts/.cts, javascript for .js/.jsx/.mjs/.cjs, docker-compose for a compose file. A contradiction is refused instead of formatting the bytes with the wrong parser.",
				},
				formatter_args: {
					type: "array",
					items: { type: "string" },
				},
			},
			output: {
				schema: receiptSchema(),
				render: (_args, value) => renderReceipt(value),
			},
			isConcurrencySafe: () => true,
			async execute(args, exec) {
				return formatAndWrite({
					filePath: args.file_path,
					content: args.content,
					language: args.language,
					formatterArgs: args.formatter_args ?? [],
					exec,
					tools: ctx.tools,
					run: await validator(),
					policy: livePolicy(),
					cwd: exec?.agent?.session?.header?.cwd ?? process.cwd(),
				});
			},
		}),
	);
}

/**
 * Owns every surface the plugin adds to the host, so one setting retracts all
 * of them together.
 *
 * The advisory, both commands, and both write-through tools are enforcement
 * surfaces rather than decoration. A master switch that only stopped the deny
 * gate would still tell the model to route every edit through
 * `write_formatted`, which keeps reformatting files the user believes are
 * untouched. Both registries return an effect disposer, so `sync` mounts on the
 * transition to enabled, retracts on the transition to disabled, and leaves an
 * unchanged master switch alone so ordinary policy edits never churn a
 * registration.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @returns {{sync: (policy: Record<string, unknown>) => void}} Controller whose `sync` applies one policy to every surface.
 */
function createSurfaces(ctx) {
	let live = {};
	let advisoryDispose = null;
	let advisoryMounted = false;
	let mounted = null;
	const disposers = [];

	/**
	 * Disposes and clears one tracked registration list.
	 *
	 * @param {Array<() => void>} list - Disposers to retire.
	 * @returns {void} Completion once every disposer settled.
	 */
	function retract(list) {
		for (const dispose of list.splice(0, list.length)) {
			try {
				dispose();
			} catch {
				// An already-removed registration leaves the state we wanted.
			}
		}
	}

	/**
	 * Retires the advisory section if one is installed.
	 *
	 * @returns {void} Completion once the section is gone.
	 */
	function dropAdvisory() {
		const dispose = advisoryDispose;
		advisoryDispose = null;
		advisoryMounted = false;
		try {
			dispose?.();
		} catch {
			// An already-removed section leaves the state we wanted.
		}
	}

	/**
	 * Installs or removes the advisory to match the two gates it depends on.
	 *
	 * The boolean is tracked separately from the disposer because a host without
	 * a system-prompt service answers with a null disposer, and re-asking on
	 * every policy change would be noise rather than repair.
	 *
	 * @returns {void} Completion once the advisory matches the policy.
	 */
	function syncAdvisory() {
		const wanted =
			live.enabled !== false && live.systemPromptAdvisory !== false;
		if (wanted === advisoryMounted) return;
		if (!wanted) {
			dropAdvisory();
			return;
		}
		advisoryDispose = installSystemAdvisory(ctx, live);
		advisoryMounted = true;
	}

	return {
		sync(policy) {
			live = policy ?? {};
			syncAdvisory();
			const wanted = live.enabled !== false;
			if (wanted === mounted) return;
			if (!wanted) {
				retract(disposers);
				mounted = false;
				return;
			}
			disposers.push(registerVerifyCommand(ctx), registerFormatterCommand(ctx));
			const livePolicy = () => live;
			disposers.push(
				registerFormatCode(ctx, livePolicy),
				registerWriteFormatted(ctx, livePolicy),
			);
			mounted = true;
		},
	};
}

/**
 * Mounts settings, every enforcement surface, and the asynchronous pre-write
 * policy listener driven by one live policy object.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @returns {Promise<void>} Completion after every registration.
 */
export async function apply(ctx) {
	let policy = await loadPolicy();
	await savePolicy(policy);
	const surfaces = createSurfaces(ctx);
	// Once before the settings section can exist, and again after every change,
	// so the advisory, the commands, and the tools always match the switch.
	surfaces.sync(policy);
	await installSettings(ctx, policy, async (next) => {
		policy = next;
		surfaces.sync(policy);
	});
	// The pre-execute pipeline is asynchronous, so formatters and the checker
	// never stall the harness event loop the way a synchronous guard did.
	ctx.on("tools/pre-execute", async (execution, next) => {
		const decision = await evaluatePendingWrite(execution, policy, {
			logger: ctx.logger,
		});
		if (decision.action === "deny")
			return { kind: "deny", reason: decision.reason };
		if (decision.action === "warn")
			await notifyDeferred(execution, decision.reason ?? "");
		return next();
	});
}
