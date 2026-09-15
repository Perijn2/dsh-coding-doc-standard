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

export const name = "coding-doc-standard";
export const inject = ["commands", "tools"];

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const defaultsPath = join(packageRoot, "src", "policy", "defaults.json");
const statePath = join(homedir(), ".dsh", "plugins", name, "policy.json");

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
		return {
			...defaults,
			...override,
			languages: { ...defaults.languages, ...override.languages },
		};
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
					await savePolicy({
						...policy,
						enabled: value.enabled,
						formatOnWrite: value.formatOnWrite,
						formatPython: value.formatPython,
						formatTypescriptJavascript: value.formatTypescriptJavascript,
						formatRust: value.formatRust,
						formatDockerCompose: value.formatDockerCompose,
						blockOnMissingFormatter: value.blockOnMissingFormatter,
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
			hint: "[paths…] [--optional] [--doxygen Doxyfile]",
		},
		handler: (invocation) =>
			runVerification(
				parseVerifyArguments(invocation.rawInput),
				invocation.agent.session.header.cwd ?? process.cwd(),
				invocation.signal,
			),
	});
	ctx.tools.guard(guardPendingWrite);
}
