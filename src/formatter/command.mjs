/**
 * @module managed-formatter-command
 * @author Perijn Huijser
 * Resolves and runs package-managed formatters for the DSH slash command.
 *
 * @remarks
 * Usage:
 *   Core principle: Resolve formatters from this package or its durable tool
 *   directory instead of relying on an agent's PATH.
 *   Setup: Provision tools and register runFormatterCommand through the host.
 *   Workflow: Parse a language and file, run its pinned formatter in the
 *   invoking workspace, and report the invocation and captured output.
 *   API guide: parseFormatterArguments validates command text;
 *   runFormatterCommand executes the selected formatter.
 *   Worked example: /code-formatter --python --file test.py --line-length 100
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tools = JSON.parse(
	readFileSync(join(packageRoot, "src", "policy", "tools.json"), "utf8"),
);
const profiles = {
	python: {
		label: `Ruff ${tools.ruff.version}`,
		flags: ["--python", "--ruff"],
	},
	biome: {
		label: `@biomejs/biome ${tools.biome.version}`,
		flags: ["--typescript", "--javascript", "--biome"],
	},
	prettier: {
		label: `Prettier ${tools.prettier.version}`,
		flags: ["--docker-compose", "--prettier"],
	},
};

/**
 * Splits CLI-style text while preserving whitespace inside matching quotes.
 *
 * @param rawInput - Text entered after `/code-formatter`.
 *
 * @returns {string[]} Parsed arguments with quote delimiters removed.
 *
 * @throws {Error} When a quote is not closed.
 */
export function splitCommandArguments(rawInput) {
	const parsed = [];
	let current = "";
	let quote = null;
	for (const character of rawInput) {
		if (quote) {
			if (character === quote) quote = null;
			else current += character;
		} else if (character === '"' || character === "'") quote = character;
		else if (/\s/u.test(character)) {
			if (current) parsed.push(current);
			current = "";
		} else current += character;
	}
	if (quote) throw new Error(`Unclosed ${quote} quote.`);
	if (current) parsed.push(current);
	return parsed;
}

/**
 * Parses the managed formatter command contract.
 *
 * @param rawInput - Text entered after `/code-formatter`.
 *
 * @returns {{profile: 'python' | 'biome' | 'prettier', file: string, formatterArgs: string[], content: string | null}} Validated request.
 *
 * @throws {Error} When the selector or file is missing or ambiguous.
 */
export function parseFormatterArguments(rawInput) {
	const args = splitCommandArguments(rawInput);
	let profile = null;
	let file = null;
	let contentBase64 = null;
	let contentUtf8 = null;
	const formatterArgs = [];
	let forwarding = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (forwarding) formatterArgs.push(argument);
		else if (argument === "--") forwarding = true;
		else if (argument === "--file") {
			file = args[index + 1] ?? null;
			index += 1;
		} else if (argument === "--content-base64") {
			contentBase64 = args[index + 1] ?? null;
			index += 1;
		} else if (argument === "--content-utf8") {
			contentUtf8 = args[index + 1] ?? null;
			index += 1;
		} else {
			const selected = Object.entries(profiles).find(([, value]) =>
				value.flags.includes(argument),
			)?.[0];
			if (!selected) formatterArgs.push(argument);
			else if (profile && profile !== selected)
				throw new Error("Choose exactly one formatter language selector.");
			else profile = selected;
		}
	}
	if (!profile)
		throw new Error(
			"Missing selector: use --python, --typescript, --javascript, or --docker-compose.",
		);
	if (!file) throw new Error("Missing target file: use --file <path>.");
	if (contentBase64 !== null && contentUtf8 !== null)
		throw new Error("Choose only one candidate content encoding.");
	let content = contentUtf8;
	if (contentBase64 !== null) {
		const decoded = Buffer.from(contentBase64, "base64");
		if (
			decoded.toString("base64").replace(/=+$/u, "") !==
			contentBase64.replace(/=+$/u, "")
		)
			throw new Error("Invalid --content-base64 value.");
		content = decoded.toString("utf8");
	}
	return { profile, file, formatterArgs, content };
}

function invocationFor(request) {
	if (request.profile === "python") {
		const program = join(
			homedir(),
			".dsh",
			"plugins",
			"coding-doc-standard",
			"tools",
			`ruff-${tools.ruff.version}`,
			"bin",
			process.platform === "win32" ? "ruff.exe" : "ruff",
		);
		return {
			program,
			command: program,
			args:
				request.content === null
					? ["format", ...request.formatterArgs, request.file]
					: [
							"format",
							...request.formatterArgs,
							"--stdin-filename",
							request.file,
							"-",
						],
			label: profiles.python.label,
		};
	}
	const biome = request.profile === "biome";
	const program = biome
		? join(packageRoot, "node_modules", "@biomejs", "biome", "bin", "biome")
		: join(packageRoot, "node_modules", "prettier", "bin", "prettier.cjs");
	const check = request.formatterArgs.includes("--check");
	const formatterArgs = biome
		? request.formatterArgs.filter((argument) => argument !== "--check")
		: request.formatterArgs;
	return {
		program,
		command: process.execPath,
		args:
			request.content === null
				? [
						program,
						...(biome ? ["format"] : []),
						...(check ? [] : ["--write"]),
						...formatterArgs,
						request.file,
					]
				: [
						program,
						...(biome ? ["format", "--stdin-file-path"] : ["--stdin-filepath"]),
						request.file,
						...(biome ? ["--vcs-enabled=false"] : []),
						...formatterArgs,
					],
		label: biome ? profiles.biome.label : profiles.prettier.label,
	};
}

function renderedCommand(invocation) {
	const args = invocation.args.slice(
		invocation.command === process.execPath ? 1 : 0,
	);
	return [invocation.program, ...args]
		.map((value) => (/\s|["']/u.test(value) ? JSON.stringify(value) : value))
		.join(" ");
}

/**
 * Finds an existing working directory for a formatter run on one target.
 *
 * Biome infers a project root from its working directory, so a formatter
 * belongs beside the file it formats rather than wherever the caller
 * happens to sit. A candidate can also live in a directory that does not
 * exist yet, so the nearest existing ancestor is used instead of a
 * directory the process could not start in.
 *
 * @param {string} targetPath - Target file path, absolute or relative.
 * @param {string} fallbackCwd - Directory used when no ancestor exists.
 * @returns {string} Existing directory a formatter can run in.
 */
export function formatterWorkingDirectory(targetPath, fallbackCwd) {
	let dir = dirname(targetPath);
	for (;;) {
		if (existsSync(dir)) return dir;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return existsSync(fallbackCwd) ? fallbackCwd : process.cwd();
}

/**
 * Runs one package-managed formatter in a workspace.
 *
 * @param rawInput - Text entered after `/code-formatter`.
 * @param cwd - Workspace used to resolve the target file and config.
 * @param signal - UI-owned cancellation signal.
 *
 * @returns {Promise<{kind: 'success' | 'error', text: string}>} Detailed outcome.
 */
export async function runFormatterCommand(rawInput, cwd, signal) {
	let request;
	try {
		request = parseFormatterArguments(rawInput);
	} catch (error) {
		return {
			kind: "error",
			text: `${error.message}\nUsage: /code-formatter <language> --file <path> [--content-utf8 <text> | --content-base64 <base64>] [-- formatter flags]`,
		};
	}
	const invocation = invocationFor(request);
	// A standard-input format runs beside the target file so the formatter
	// resolves the same project root for the file and for itself; Biome
	// otherwise reports a nested root configuration when the invoking
	// workspace and the target file belong to different projects.
	const spawnCwd =
		request.content === null
			? cwd
			: formatterWorkingDirectory(resolve(cwd, request.file), cwd);
	const command = renderedCommand(invocation);
	if (!existsSync(invocation.program)) {
		return {
			kind: "error",
			text: [
				`${invocation.label} is unavailable.`,
				`Expected executable: ${invocation.program}`,
				`Workspace: ${cwd}`,
				"Remediation: run npm run provision-tools in coding-doc-standard.",
			].join("\n"),
		};
	}
	return new Promise((resolve) => {
		const child = spawn(invocation.command, invocation.args, {
			cwd: spawnCwd,
			stdio: [request.content === null ? "ignore" : "pipe", "pipe", "pipe"],
			windowsHide: true,
		});
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			// In pending-content mode stdout is the formatted file itself: a
			// cap there silently truncates large files, so it accumulates in
			// full. A file-mode run only needs the tail of the report.
			stdout =
				request.content === null
					? `${stdout}${chunk}`.slice(-8000)
					: stdout + chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr = `${stderr}${chunk}`.slice(-8000);
		});
		if (request.content !== null) {
			// A formatter that exits before draining a large pending file fails
			// the write on the stream itself; without this listener that
			// unhandled 'error' event takes the whole host process down.
			child.stdin.on("error", () => {});
			child.stdin.end(request.content);
		}
		const abort = () => child.kill();
		signal.addEventListener("abort", abort, { once: true });
		child.once("error", (error) => {
			signal.removeEventListener("abort", abort);
			resolve({
				kind: "error",
				text: `${invocation.label} could not start: ${error.message}\nCommand: ${command}\nWorkspace: ${cwd}`,
			});
		});
		child.once("close", (code, terminationSignal) => {
			signal.removeEventListener("abort", abort);
			const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
			const lines = [
				`${invocation.label} ${code === 0 ? "completed successfully" : "failed"}.`,
				`Command: ${command}`,
				`Workspace: ${cwd}`,
				`Exit: ${code ?? "none"}${terminationSignal ? ` (signal ${terminationSignal})` : ""}`,
			];
			if (output) lines.push("Output:", output);
			else if (code !== 0) lines.push("Output: formatter produced no output.");
			resolve({
				kind: code === 0 ? "success" : "error",
				text: lines.join("\n"),
				formattedContent:
					request.content !== null && code === 0 ? stdout : undefined,
			});
		});
	});
}
