/**
 * @module coding-doc-standard-host
 * @author Perijn Huijser
 * Mounts native global pre-write enforcement and persistent settings for the coding documentation standard.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep bundle registration thin and enforce pending writes at
 *   the native global DSH tool-guard boundary.
 *   Setup: Load this package through its bundle patch in a DSH profile.
 *   Workflow: Resolve settings, create durable policy state, then register one
 *   synchronous guard that invokes the candidate validator before every write.
 *   API guide: Cordis invokes the exported `apply` lifecycle function.
 *   Worked example: The bundle patch inserts this package as coding-doc-standard.
 */

import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { runFormatterCommand } from "../formatter/command.mjs";

/**
 * Identifies the coding documentation standard plugin.
 */
export const name = "coding-doc-standard";

/**
 * Declares the host services required by the plugin.
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
 * Builds the flat settings-field prefix for a language hook.
 *
 * @param {string} language - Policy language key.
 * @returns {string} Flat settings-field prefix.
 */
function hookPrefix(language) {
	return `${language}Hook`;
}

/**
 * Reads one language's editable hook values from durable policy.
 *
 * @param {Record<string, unknown>} policy - Effective policy configuration.
 * @param {string} language - Policy language key.
 * @returns {Record<string, string | number>} Flat settings values.
 */
function hookSettings(policy, language) {
	const prefix = hookPrefix(language);
	const adapter = policy.publicUnitAdapters?.[language] ?? {};
	const saved = policy.hookSettings?.[language] ?? {};
	return {
		[`${prefix}Command`]: saved.command ?? adapter.command ?? "",
		[`${prefix}Args`]:
			saved.args ?? (adapter.args ? JSON.stringify(adapter.args) : ""),
		[`${prefix}Cwd`]: saved.cwd ?? adapter.cwd ?? "",
		[`${prefix}TimeoutMs`]: saved.timeoutMs ?? adapter.timeoutMs ?? 10_000,
	};
}

/**
 * Builds Schemastery fields for every exposed custom hook value.
 *
 * @param {object} schemaTools - Schemastery module.
 * @param {Record<string, unknown>} policy - Effective policy configuration.
 * @returns {Record<string, object>} Flat Schemastery field dictionary.
 */
function adapterSettingsSchema(schemaTools, policy) {
	return Object.fromEntries(
		adapterLanguages.flatMap((language) => {
			const prefix = hookPrefix(language);
			const current = hookSettings(policy, language);
			return [
				[
					`${prefix}Command`,
					schemaTools.string().default(current[`${prefix}Command`]),
				],
				[
					`${prefix}Args`,
					schemaTools.string().default(current[`${prefix}Args`]),
				],
				[`${prefix}Cwd`, schemaTools.string().default(current[`${prefix}Cwd`])],
				[
					`${prefix}TimeoutMs`,
					schemaTools.number().default(current[`${prefix}TimeoutMs`]),
				],
			];
		}),
	);
}

/**
 * Converts flat settings values into executable hook policy.
 *
 * @param {Record<string, unknown>} value - Current settings snapshot.
 * @returns {{hookSettingsByLanguage: object, publicUnitAdapters: object}} Durable hook policy.
 */
function configuredHooks(value) {
	const hookSettingsByLanguage = {};
	const publicUnitAdapters = {};
	for (const language of adapterLanguages) {
		const prefix = hookPrefix(language);
		const command = value[`${prefix}Command`]?.trim() ?? "";
		const argsText = value[`${prefix}Args`]?.trim() ?? "";
		const cwd = value[`${prefix}Cwd`]?.trim() ?? "";
		const timeoutMs = value[`${prefix}TimeoutMs`] ?? 10_000;
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
 * Checks one write or edit execution synchronously before DSH dispatches it.
 *
 * DSH global guards are synchronous. This executes the existing candidate
 * validator in a bounded child process so its asynchronous formatters and
 * checker retain their established behavior.
 *
 * @param {{name: string, arguments: Record<string, unknown>, agent?: {session?: {header?: {cwd?: string}}}}} execution - Pending tool execution.
 * @returns {string | undefined} A denial reason, or undefined when validation passes or is inapplicable.
 */
export function guardPendingWrite(execution) {
	if (!/^(?:functions\.)?(?:write|edit)$/.test(execution.name))
		return undefined;
	let input;
	try {
		input = `${JSON.stringify({ tool_input: execution.arguments })}\n`;
	} catch (error) {
		return `[doc-standard] Cannot serialize pending write: ${error.message}`;
	}
	const result = spawnSync(
		process.execPath,
		[join(packageRoot, "src", "hook", "run.mjs")],
		{
			cwd: execution.agent?.session?.header?.cwd ?? process.cwd(),
			encoding: "utf8",
			input,
			shell: false,
			timeout: 10_000,
			windowsHide: true,
		},
	);
	if (result.status === 0) return undefined;
	const diagnostic = (
		result.stderr ||
		result.stdout ||
		result.error?.message ||
		"validator failed"
	)
		.trim()
		.slice(0, 2_000);
	return `[doc-standard] ${diagnostic}`;
}

async function installSettings(ctx, policy) {
	try {
		const settings = await import("@deepseek-ai/dsh-settings");
		const schemaModule = await import("@deepseek-ai/schemastery");
		const schemaTools = schemaModule.default ?? schemaModule;
		if (
			typeof settings.installSettingsSection !== "function" ||
			typeof settings.settingsNamespace !== "function"
		)
			return;
		const schema = schemaTools.object({
			enabled: schemaTools.boolean().default(policy.enabled),
			python: schemaTools.boolean().default(policy.languages.python),
			typescriptJavascript: schemaTools
				.boolean()
				.default(policy.languages.typescriptJavascript),
			rust: schemaTools.boolean().default(policy.languages.rust),
			cCpp: schemaTools.boolean().default(policy.languages.cCpp),
			dockerCompose: schemaTools
				.boolean()
				.default(policy.languages.dockerCompose),
			go: schemaTools.boolean().default(policy.languages.go),
			csharp: schemaTools.boolean().default(policy.languages.csharp),
			java: schemaTools.boolean().default(policy.languages.java),
			kotlin: schemaTools.boolean().default(policy.languages.kotlin),
			shell: schemaTools.boolean().default(policy.languages.shell),
			php: schemaTools.boolean().default(policy.languages.php),
			ruby: schemaTools.boolean().default(policy.languages.ruby),
			swift: schemaTools.boolean().default(policy.languages.swift),
			dart: schemaTools.boolean().default(policy.languages.dart),
			haskell: schemaTools.boolean().default(policy.languages.haskell),
			lua: schemaTools.boolean().default(policy.languages.lua),
			scala: schemaTools.boolean().default(policy.languages.scala),
			...adapterSettingsSchema(schemaTools, policy),
			formatOnWrite: schemaTools.boolean().default(policy.formatOnWrite),
			formatPython: schemaTools.boolean().default(policy.formatPython),
			formatTypescriptJavascript: schemaTools
				.boolean()
				.default(policy.formatTypescriptJavascript),
			formatRust: schemaTools.boolean().default(policy.formatRust),
			formatDockerCompose: schemaTools
				.boolean()
				.default(policy.formatDockerCompose),
			blockOnMissingFormatter: schemaTools
				.boolean()
				.default(policy.blockOnMissingFormatter),
		});
		let source = () => ({
			enabled: policy.enabled,
			...policy.languages,
			...Object.fromEntries(
				adapterLanguages.flatMap((language) =>
					Object.entries(hookSettings(policy, language)),
				),
			),
			formatOnWrite: policy.formatOnWrite,
			formatPython: policy.formatPython,
			formatTypescriptJavascript: policy.formatTypescriptJavascript,
			formatRust: policy.formatRust,
			formatDockerCompose: policy.formatDockerCompose,
			blockOnMissingFormatter: policy.blockOnMissingFormatter,
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
					const { hookSettingsByLanguage, publicUnitAdapters } =
						configuredHooks(value);
					await savePolicy({
						...policy,
						enabled: value.enabled,
						formatOnWrite: value.formatOnWrite,
						formatPython: value.formatPython,
						formatTypescriptJavascript: value.formatTypescriptJavascript,
						formatRust: value.formatRust,
						formatDockerCompose: value.formatDockerCompose,
						blockOnMissingFormatter: value.blockOnMissingFormatter,
						hookSettings: hookSettingsByLanguage,
						publicUnitAdapters,
						publicUnitDocs: {
							...Object.fromEntries(
								adapterLanguages.map((language) => [
									language,
									value[language] === true &&
										(!["rust", "cCpp"].includes(language) ||
											Boolean(publicUnitAdapters[language])),
								]),
							),
							typescriptJavascript: value.typescriptJavascript === true,
						},
						languages: {
							python: value.python,
							typescriptJavascript: value.typescriptJavascript,
							rust: value.rust,
							cCpp: value.cCpp,
							dockerCompose: value.dockerCompose,
							go: value.go,
							csharp: value.csharp,
							java: value.java,
							kotlin: value.kotlin,
							shell: value.shell,
							php: value.php,
							ruby: value.ruby,
							swift: value.swift,
							dart: value.dart,
							haskell: value.haskell,
							lua: value.lua,
							scala: value.scala,
						},
					});
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
	const verifier = join(packageRoot, "scripts", "verify.mjs");
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
 * Mounts settings, the detailed verifier command, and the native tool guard.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @returns {Promise<void>} Completion after settings, command, and guard registration.
 */
export async function apply(ctx) {
	const effectivePolicy = await loadPolicy();
	await savePolicy(effectivePolicy);
	await installSettings(ctx, effectivePolicy);
	ctx.commands.register({
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
	ctx.commands.register({
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
	ctx.tools.register(
		defineTool({
			name: "format_code",
			description:
				"Format complete pending UTF-8 source in memory with the pinned managed formatter before calling write or edit.",
			parameters: {
				language: {
					type: "string",
					required: true,
					enum: ["python", "typescript", "javascript", "docker-compose"],
				},
				file_path: {
					type: "string",
					required: true,
					description:
						"Intended workspace-relative path used for parser and configuration selection; the file need not exist.",
				},
				content: {
					type: "string",
					required: true,
					description: "Complete pending UTF-8 source text.",
				},
				formatter_args: {
					type: "array",
					items: { type: "string" },
				},
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						changed: { type: "boolean", required: true },
						formatted_content: { type: "string", required: true },
						formatter: { type: "string", required: true },
					},
				},
				render: (_args, value) => [
					{ type: "text", text: JSON.stringify(value, null, 2) },
				],
			},
			isConcurrencySafe: () => true,
			async execute(args, exec) {
				const selectors = {
					python: "--python",
					typescript: "--typescript",
					javascript: "--javascript",
					"docker-compose": "--docker-compose",
				};
				const encoded = Buffer.from(args.content, "utf8").toString("base64");
				const formatterArgs = (args.formatter_args ?? [])
					.map((argument) => JSON.stringify(argument))
					.join(" ");
				const rawInput = `${selectors[args.language]} --file ${JSON.stringify(args.file_path)} --content-base64 ${encoded}${formatterArgs ? ` -- ${formatterArgs}` : ""}`;
				const result = await runFormatterCommand(
					rawInput,
					exec.agent?.session.header.cwd ?? process.cwd(),
					exec.signal,
				);
				if (result.kind !== "success" || result.formattedContent === undefined)
					throw new Error(result.text);
				return {
					changed: result.formattedContent !== args.content,
					formatted_content: result.formattedContent,
					formatter:
						args.language === "python"
							? "ruff"
							: args.language === "docker-compose"
								? "prettier"
								: "biome",
				};
			},
		}),
	);
	ctx.tools.guard(guardPendingWrite);
}
