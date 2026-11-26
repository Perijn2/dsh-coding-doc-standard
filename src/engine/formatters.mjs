/**
 * @module formatters
 * @author Perijn Huijser
 * Runs formatters through the adapter contract a profile declares; the engine knows protocols, never tools.
 *
 * @remarks
 * Usage:
 *   Core principle: The engine implements invocation protocols; every formatter choice and mapping belongs to a pack.
 *   Setup: A profile declares an adapter (stdin-binary, npm-function, external-command) plus its pinned dependency.
 *   Workflow: Resolve the dependency, run the protocol, and render findings from the pack-declared semantics.
 *   API guide: formatterDeclarationFor resolves coverage; runFormatterAdapter returns one finding string or null.
 *   Worked example: await runFormatterAdapter(candidate, formatterDeclarationFor("a.py"))
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import {
	basename,
	delimiter,
	dirname,
	extname,
	join,
	resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getRegistry } from "./registry.mjs";

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * Resolves the dependency store root for pack-provisioned tools.
 *
 * @returns {string} The durable tools root.
 */
function toolsRoot() {
	return join(homedir(), ".dsh", "plugins", "coding-doc-standard", "tools");
}

/**
 * Matches one declared filename pattern (with `*` wildcards) against a basename.
 *
 * @param {string} base - Lowercased file basename.
 * @param {string} pattern - Declared pattern, for example "compose.*.yaml".
 * @returns {boolean} True when the basename matches.
 */
export function filenameMatches(base, pattern) {
	const expression = `^${String(pattern)
		.toLowerCase()
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replaceAll("*", ".*")}$`;
	return new RegExp(expression).test(base);
}

/**
 * Resolves the formatter declaration covering one candidate path.
 *
 * @param {string} path - Candidate file path.
 * @param {object} [registry] - Registry to search; defaults to the cached registry.
 * @returns {{pack: object, profile: object, formatter: object} | null} Declaration, or null when no pack declares one.
 */
export function formatterDeclarationFor(path, registry = getRegistry()) {
	const extension = extname(path).toLowerCase();
	const base = basename(path).toLowerCase();
	for (const pack of registry.packs.values()) {
		for (const profile of pack.profiles.values()) {
			const formatter = profile.formatter;
			if (!formatter) continue;
			const byExtension =
				Array.isArray(profile.extensions) &&
				profile.extensions.some((value) => value.toLowerCase() === extension);
			const byFilename =
				Array.isArray(profile.filenames) &&
				profile.filenames.some((value) => filenameMatches(base, value));
			if (byExtension || byFilename) return { pack, profile, formatter };
		}
	}
	return null;
}

/**
 * Resolves one declared dependency to an executable or module path.
 *
 * @param {object} dependency - The profile's formatter dependency declaration.
 * @param {object} pack - Owning pack record.
 * @param {string} cwd - Workspace root for project-sourced dependencies.
 * @returns {string | null} Resolved path, or null when unavailable.
 */
export function resolveDependency(dependency, pack, cwd) {
	const suffix = process.platform === "win32" ? ".exe" : "";
	switch (dependency.source) {
		case "legacy-engine-tools":
			return join(
				toolsRoot(),
				`${dependency.name}-${dependency.version}`,
				"bin",
				`${dependency.bin}${suffix}`,
			);
		case "plugin-node-modules":
			return join(
				packageRoot,
				"node_modules",
				".bin",
				`${dependency.bin}${process.platform === "win32" ? ".cmd" : ""}`,
			);
		case "pack-store":
			return join(
				toolsRoot(),
				"packs",
				pack.manifest.id,
				`${dependency.package}@${dependency.version}`,
				dependency.bin ?? "",
			);
		case "project":
			return dependency.bin ? resolve(cwd, dependency.bin) : null;
		default:
			return null;
	}
}

/**
 * Spawns one process and captures its streams.
 *
 * @param {string} command - Executable path.
 * @param {string[]} args - Argument list.
 * @param {string} content - Standard-input payload.
 * @param {string} cwd - Working directory.
 * @param {AbortSignal} [signal] - Cancellation that kills the child.
 * @returns {Promise<{code: number | null, stdout: string, stderr: string, error: Error | null}>} Run result.
 */
function execute(command, args, content, cwd, signal = undefined) {
	return new Promise((resolveRun) => {
		const child = spawn(command, args, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
			shell: process.platform === "win32",
			signal,
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
			resolveRun({ code: null, stdout, stderr, error }),
		);
		// Exit can precede the last stdout chunk; formatted bytes are complete
		// only once the child's inherited output streams have closed.
		child.once("close", (code) =>
			resolveRun({ code, stdout, stderr, error: null }),
		);
		// A child that exits before draining a large stdin payload fails the
		// pending write on the stream itself; without this listener that
		// unhandled 'error' event takes the whole host process down.
		child.stdin.on("error", () => {});
		child.stdin.end(content);
	});
}

/**
 * Renders the unavailable-formatter message per policy.
 *
 * A project-sourced formatter (external-command) may carry its own
 * `unavailableHint`, because provisioning a project tool is not this
 * package's job; managed formatters keep the provision-tools hint.
 *
 * @param {object} formatter - Formatter declaration.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @returns {string | null} Blocking message, or null when misses are allowed.
 */
function unavailable(formatter, policy) {
	if (policy.blockOnMissingFormatter === false) return null;
	const hint =
		typeof formatter.unavailableHint === "string" &&
		formatter.unavailableHint !== ""
			? formatter.unavailableHint
			: "Run provision-tools for this pack.";
	return `[doc-standard] Required formatter is unavailable: ${formatter.label ?? formatter.dependency.package}. ${hint}`;
}

/**
 * Runs the stdin protocol once and returns the structured outcome.
 *
 * `finding` is the gate-facing message (null when clean); `formatted` carries
 * stdout for stdout-diff check modes, which is the text write-through tools
 * need; `unavailable` marks the policy-gated missing-binary degradation.
 *
 * @param {string} binary - Resolved executable path or command name.
 * @param {object} formatter - Formatter declaration.
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {string} workspace - Workspace root.
 * @param {AbortSignal} [signal] - Cancellation that kills the formatter.
 * @param {Record<string, unknown>} [policy] - Effective policy for the missing-binary path.
 * @returns {Promise<{finding: string | null, formatted: string | null, unavailable: boolean}>} Structured outcome.
 */
async function runStdinCapture(
	binary,
	formatter,
	candidate,
	workspace,
	signal,
	policy = {},
) {
	const target = resolve(workspace, candidate.path);
	const args = (formatter.args ?? []).map((argument) =>
		String(argument)
			.replaceAll("{path}", target)
			.replaceAll("{workspace}", workspace),
	);
	const result = await execute(
		binary,
		args,
		candidate.content,
		workspace,
		signal,
	);
	const label = formatter.label ?? formatter.dependency.package;
	const clean = formatter.cleanExit ?? [0];
	const output = (result.stderr || result.stdout).trim();
	// A project-provided binary that is not on PATH degrades to the
	// policy-gated unavailable notice instead of a hard validation failure,
	// so "use it if it exists" holds for external-command formatters.
	if (result.code === null && result.error?.code === "ENOENT")
		return {
			finding: unavailable(formatter, policy),
			formatted: null,
			unavailable: true,
		};
	if (result.code === null || !clean.includes(result.code)) {
		return {
			finding: [
				`[doc-standard] ${label} could not validate ${candidate.path}.`,
				`Executable: ${binary}`,
				`Workspace: ${workspace}`,
				`Arguments: ${args.map((argument) => JSON.stringify(argument)).join(" ")}`,
				`Exit: ${result.code ?? "not started"}`,
				output ? `Formatter output:\n${output}` : "Formatter output: none.",
				result.error ? `Start error: ${result.error.message}` : null,
			]
				.filter(Boolean)
				.join("\n"),
			formatted: null,
			unavailable: false,
		};
	}
	if ((formatter.checkMode ?? "exit-code") === "stdout-diff") {
		return {
			finding:
				result.stdout === candidate.content
					? null
					: [
							`[doc-standard] ${candidate.path} must match ${label} formatting.`,
							`Executable: ${binary}`,
							"Call write_formatted with the intended file_path and the complete pending content: it formats, checks, and writes in one call.",
						].join("\n"),
			formatted: result.stdout,
			unavailable: false,
		};
	}
	return { finding: null, formatted: null, unavailable: false };
}

/**
 * Runs the stdin-binary adapter for one candidate.
 *
 * @param {string} binary - Resolved executable path.
 * @param {object} formatter - Formatter declaration.
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {string} workspace - Workspace root.
 * @param {AbortSignal} [signal] - Cancellation that kills the formatter.
 * @param {Record<string, unknown>} [policy] - Effective policy for the missing-binary path.
 * @returns {Promise<string | null>} Finding text, or null when formatting passes.
 */
async function runStdinBinary(
	binary,
	formatter,
	candidate,
	workspace,
	signal,
	policy = {},
) {
	const captured = await runStdinCapture(
		binary,
		formatter,
		candidate,
		workspace,
		signal,
		policy,
	);
	return captured.finding;
}

/**
 * Runs the npm-function adapter for one candidate.
 *
 * The pinned package is imported from the pack store and its declared export is
 * called with (content, path, options); it returns formatted text or a result
 * object with { clean, formattedContent, diagnostics }.
 *
 * @param {object} formatter - Formatter declaration.
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {object} pack - Owning pack record.
 * @param {string} workspace - Workspace root.
 * @returns {Promise<string | null>} Finding text, or null when formatting passes.
 */
async function runNpmFunction(formatter, candidate, pack, workspace) {
	const dependency = formatter.dependency ?? {};
	const modulePath = resolveDependency(
		{ ...dependency, source: "pack-store" },
		pack,
		workspace,
	);
	if (!modulePath || !existsSync(modulePath)) return unavailable(formatter, {});
	const module = await import(pathToFileURL(modulePath).href);
	const entry = module[formatter.entry ?? "format"];
	if (typeof entry !== "function") {
		return `[doc-standard] Formatter dependency ${dependency.package} does not export ${formatter.entry ?? "format"}.`;
	}
	const result = await entry(candidate.content, candidate.path, { workspace });
	const formatted =
		typeof result === "string" ? result : result?.formattedContent;
	const clean = typeof result === "string" ? true : result?.clean !== false;
	if (!clean) {
		return `[doc-standard] ${candidate.path} must match ${formatter.label ?? dependency.package} formatting.${
			result?.diagnostics ? `\n${result.diagnostics}` : ""
		}`;
	}
	return formatted === candidate.content || formatted == null
		? null
		: `[doc-standard] ${candidate.path} must match ${formatter.label ?? dependency.package} formatting.`;
}

/**
 * Answers whether a project-declared command exists for the workspace.
 *
 * A bare name is searched on PATH (with PATHEXT on Windows); a name carrying
 * a path separator is resolved against the workspace. The explicit check
 * exists because a missing binary must degrade to the unavailable notice on
 * every platform: on Windows the shell reports a missing command as exit 1
 * with a locale-specific message, not as a spawn ENOENT.
 *
 * @param {string} command - Declared project binary.
 * @param {string} workspace - Workspace root for relative commands.
 * @returns {boolean} True when the command can be spawned.
 */
function projectCommandExists(command, workspace) {
	if (command.includes("/") || command.includes("\\"))
		return existsSync(resolve(workspace, command));
	const extensions =
		process.platform === "win32" && extname(command) === ""
			? String(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
			: [""];
	return String(process.env.PATH ?? "")
		.split(delimiter)
		.some((directory) =>
			extensions.some((extension) =>
				existsSync(join(directory, command + extension)),
			),
		);
}

/**
 * Runs the external-command adapter for one candidate.
 *
 * The profile declares a project-provided binary (for example the Rust
 * pack's `rustfmt`); the engine applies the same stdin protocol as
 * stdin-binary, spawning the command in the workspace so PATH and project
 * config resolve the way the project's own tooling would. A binary that
 * does not exist degrades to the policy-gated unavailable notice.
 *
 * @param {object} formatter - Formatter declaration.
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {string} workspace - Workspace root.
 * @param {AbortSignal} [signal] - Cancellation that kills the formatter.
 * @param {Record<string, unknown>} [policy] - Effective policy for the missing-binary path.
 * @returns {Promise<string | null>} Finding text, or null when formatting passes.
 */
async function runExternalCommand(
	formatter,
	candidate,
	workspace,
	signal,
	policy = {},
) {
	const command = formatter.dependency?.bin;
	if (!command || !projectCommandExists(command, workspace))
		return unavailable(formatter, policy);
	return runStdinBinary(
		command,
		formatter,
		candidate,
		workspace,
		signal,
		policy,
	);
}

/**
 * Runs one candidate through its pack-declared formatter adapter.
 *
 * A profile with no formatter declaration produces no check (REQ-029); an
 * unavailable dependency blocks or warns per blockOnMissingFormatter.
 *
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @param {string} cwd - Workspace root.
 * @param {{signal?: AbortSignal, registry?: object}} [options] - Cancellation and an explicit pack registry for tests.
 * @returns {Promise<string | null>} Finding text, or null when formatting passes or does not apply.
 */
export async function runFormatterAdapter(
	candidate,
	policy = {},
	cwd = process.cwd(),
	options = {},
) {
	const declaration = formatterDeclarationFor(candidate.path, options.registry);
	if (!declaration) return null;
	const { pack, profile, formatter } = declaration;
	const settingsKey = formatter.settingsKey;
	if (settingsKey && policy[settingsKey] === false) return null;
	const workspace = typeof cwd === "string" && cwd !== "" ? cwd : process.cwd();
	const executable = resolveDependency(
		formatter.dependency ?? {},
		pack,
		workspace,
	);
	switch (formatter.adapter) {
		case "stdin-binary": {
			if (!executable || !existsSync(executable))
				return unavailable(formatter, policy);
			return runStdinBinary(
				executable,
				formatter,
				candidate,
				workspace,
				options.signal,
				policy,
			);
		}
		case "npm-function":
			return runNpmFunction(formatter, candidate, pack, workspace);
		case "external-command":
			return runExternalCommand(
				formatter,
				candidate,
				workspace,
				options.signal,
				policy,
			);
		default:
			return `[doc-standard] Profile '${profile.id}' declares unknown formatter adapter '${formatter.adapter}'.`;
	}
}

/**
 * Formats one candidate through its pack-declared formatter and returns the text.
 *
 * Write-through tools need the formatted bytes, not a pass/fail verdict, so
 * this runs the same adapters as runFormatterAdapter but captures stdout.
 * Only stdout-diff stdin adapters emit formatted text; exit-code and
 * npm-function declarations report "unsupported". A missing project binary
 * reports "unavailable" with `blocked` set per blockOnMissingFormatter.
 *
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @param {string} cwd - Workspace root.
 * @param {{signal?: AbortSignal, registry?: object}} [options] - Cancellation and an explicit pack registry for tests.
 * @returns {Promise<object>} Structured outcome: "formatted" with text, "none", "disabled", "unavailable", "error", or "unsupported".
 */
export async function formatWithDeclaredFormatter(
	candidate,
	policy = {},
	cwd = process.cwd(),
	options = {},
) {
	const declaration = formatterDeclarationFor(candidate.path, options.registry);
	if (!declaration) return { status: "none" };
	const { pack, formatter } = declaration;
	const label = formatter.label ?? formatter.dependency?.package ?? "formatter";
	const settingsKey = formatter.settingsKey;
	if (settingsKey && policy[settingsKey] === false)
		return { status: "disabled" };
	if (formatter.adapter === "npm-function")
		return {
			status: "unsupported",
			message: `[doc-standard] ${label} uses the npm-function adapter, which reports pass/fail only and cannot return formatted text.`,
		};
	const workspace = typeof cwd === "string" && cwd !== "" ? cwd : process.cwd();
	let command = null;
	if (formatter.adapter === "external-command") {
		command = formatter.dependency?.bin ?? null;
		if (command && !projectCommandExists(command, workspace)) command = null;
	} else if (formatter.adapter === "stdin-binary") {
		const resolved = resolveDependency(
			formatter.dependency ?? {},
			pack,
			workspace,
		);
		if (resolved && existsSync(resolved)) command = resolved;
	} else {
		return {
			status: "unsupported",
			message: `[doc-standard] Adapter '${formatter.adapter}' cannot return formatted text.`,
		};
	}
	if (!command) {
		const message = unavailable(formatter, policy);
		return {
			status: "unavailable",
			blocked: message !== null,
			message: message ?? undefined,
		};
	}
	const captured = await runStdinCapture(
		command,
		formatter,
		candidate,
		workspace,
		options.signal,
		policy,
	);
	if (captured.unavailable)
		return {
			status: "unavailable",
			blocked: policy.blockOnMissingFormatter !== false,
			message: captured.finding ?? undefined,
		};
	// A stdout-diff adapter always has the formatted text on stdout; its
	// "must match" finding only means the candidate differed, so the text is
	// still returned for the write-through tools.
	if (captured.formatted != null)
		return {
			status: "formatted",
			text: captured.formatted,
			changed: captured.formatted !== candidate.content,
			label,
		};
	if (captured.finding) return { status: "error", message: captured.finding };
	return {
		status: "unsupported",
		message: `[doc-standard] ${label} uses checkMode '${formatter.checkMode ?? "exit-code"}', which reports pass/fail only and cannot return formatted text.`,
	};
}

/**
 * Checks formatting when the master switch enables it, through pack declarations.
 *
 * @param {{path: string, content: string}} candidate - Pending candidate.
 * @param {Record<string, unknown>} policy - Effective policy.
 * @param {string} cwd - Workspace root.
 * @param {{signal?: AbortSignal}} [options] - Cancellation that kills the formatter.
 * @returns {Promise<string | null>} Finding text, or null when formatting passes or is disabled.
 */
export async function checkFormatting(
	candidate,
	policy = {},
	cwd = process.cwd(),
	options = {},
) {
	if (!policy.formatOnWrite) return null;
	return runFormatterAdapter(candidate, policy, cwd, options);
}
