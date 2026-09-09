/**
 * @module coding-doc-standard-host
 * @author Perijn Huijser
 * Mounts hook enforcement and persistent settings for the coding documentation standard.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep bundle registration thin and delegate policy enforcement
 *   to the standard Claude Code hooks bridge.
 *   Setup: Load this package through its bundle patch in a DSH profile.
 *   Workflow: Resolve settings, create a durable policy file, then mount the
 *   hooks bridge with this package's hook configuration.
 *   API guide: Cordis invokes the exported `apply` lifecycle function.
 *   Worked example: The bundle patch inserts this package as coding-doc-standard.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "coding-doc-standard";
export const inject = ["shell"];

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
	const temporary = `${statePath}.tmp`;
	await mkdir(directory, { recursive: true });
	await writeFile(temporary, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
	await rename(temporary, statePath);
}

async function installSettings(ctx, policy) {
	try {
		const settings = await import("@deepseek-ai/dsh-settings");
		const schemaTools = await import("@deepseek-ai/schemastery");
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
			formatOnWrite: schemaTools.boolean().default(policy.formatOnWrite),
			formatPython: schemaTools.boolean().default(policy.formatPython),
			formatTypescriptJavascript: schemaTools
				.boolean()
				.default(policy.formatTypescriptJavascript),
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
						formatDockerCompose: value.formatDockerCompose,
						blockOnMissingFormatter: value.blockOnMissingFormatter,
						languages: {
							python: value.python,
							typescriptJavascript: value.typescriptJavascript,
							rust: value.rust,
							cCpp: value.cCpp,
							dockerCompose: value.dockerCompose,
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
 * Mounts settings and the hooks bridge using bundle-owned configuration.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - Cordis plugin context.
 * @returns {Promise<void>} Completion after settings and hook registration.
 */
export async function apply(ctx) {
	const bridge = await import("@deepseek-ai/dsh-hooks-claude-code");
	const effectivePolicy = await loadPolicy();
	await savePolicy(effectivePolicy);
	await installSettings(ctx, effectivePolicy);
	if (typeof bridge.apply !== "function")
		throw new Error("hooks bridge does not expose apply()");
	bridge.apply(ctx, {
		configPath: join(packageRoot, "src", "hook", "hooks.json"),
		pluginRoot: packageRoot,
	});
}
