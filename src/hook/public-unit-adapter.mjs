/**
 * @module public-unit-adapter
 * @author Perijn Huijser
 * Invokes configured project-owned public documentation adapters safely.
 *
 * Usage:
 *   Core principle: Supply pending candidate text to a project adapter without
 *   writing it to the workspace, then normalize its structured violations.
 *   Setup: Enable publicUnitDocs.<language> and configure
 *   publicUnitAdapters.<language> in the durable policy.
 *   Workflow: Identify the candidate language, run its adapter with JSON stdin,
 *   and return fail-closed diagnostics for adapter or documentation failures.
 */

import { spawn } from "node:child_process";
import { extname } from "node:path";

const LANGUAGE_BY_EXTENSION = {
	".rs": "rust",
	".c": "cCpp",
	".h": "cCpp",
	".cc": "cCpp",
	".cpp": "cCpp",
	".hpp": "cCpp",
	".go": "go",
	".cs": "csharp",
	".java": "java",
	".kt": "kotlin",
	".sh": "shell",
	".bash": "shell",
	".php": "php",
	".rb": "ruby",
	".swift": "swift",
	".dart": "dart",
	".hs": "haskell",
	".lua": "lua",
	".scala": "scala",
};

function languageFor(path) {
	return LANGUAGE_BY_EXTENSION[extname(path).toLowerCase()] ?? null;
}

function configurationError(language, message) {
	return `[doc-standard] Public-unit adapter for ${language} ${message}`;
}

function normalizeViolations(path, payload) {
	if (!payload || !Array.isArray(payload.violations))
		throw new Error("must return JSON object with a violations array");
	return payload.violations.map((violation) => {
		if (!violation || typeof violation.message !== "string")
			throw new Error("returned a violation without a message");
		const line =
			Number.isSafeInteger(violation.line) && violation.line > 0
				? violation.line
				: 1;
		const unit = [violation.kind, violation.name]
			.filter((value) => typeof value === "string" && value)
			.join(" ");
		const suffix = unit ? ` (${unit})` : "";
		return `${path}:${line} [doc-standard] ${violation.message}${suffix}`;
	});
}

/**
 * Runs the configured project adapter for an enabled candidate language.
 *
 * @param {{path: string, content: string, cwd?: string}} candidate - Pending candidate.
 * @param {Record<string, unknown>} policy - Effective policy configuration.
 * @returns {Promise<string[]>} Normalized blocking diagnostics.
 */
export async function checkProjectPublicUnits(candidate, policy) {
	const language = languageFor(candidate.path);
	if (!language || !policy.publicUnitDocs?.[language]) return [];
	const adapter = policy.publicUnitAdapters?.[language];
	if (!adapter) return [];
	if (typeof adapter.command !== "string" || !adapter.command)
		return [configurationError(language, "has no command configured.")];
	if (adapter.args !== undefined && !Array.isArray(adapter.args))
		return [configurationError(language, "has invalid args configuration.")];
	const timeout = Number.isSafeInteger(adapter.timeoutMs)
		? adapter.timeoutMs
		: 10_000;
	if (timeout <= 0 || timeout > 60_000)
		return [configurationError(language, "has an invalid timeoutMs value.")];
	const input = JSON.stringify({
		path: candidate.path,
		content: candidate.content,
		cwd: candidate.cwd ?? process.cwd(),
	});
	return await new Promise((resolve) => {
		const child = spawn(adapter.command, adapter.args ?? [], {
			cwd: adapter.cwd ?? candidate.cwd ?? process.cwd(),
			stdio: ["pipe", "pipe", "pipe"],
			shell: false,
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeout);
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.once("error", (error) => {
			clearTimeout(timer);
			resolve([
				configurationError(language, `is unavailable: ${error.message}`),
			]);
		});
		child.once("exit", (code) => {
			clearTimeout(timer);
			if (timedOut)
				return resolve([
					configurationError(language, `timed out after ${timeout}ms.`),
				]);
			if (code !== 0)
				return resolve([
					configurationError(
						language,
						`failed: ${(stderr || stdout || `exit ${code}`).trim()}`,
					),
				]);
			try {
				resolve(normalizeViolations(candidate.path, JSON.parse(stdout)));
			} catch (error) {
				resolve([
					configurationError(
						language,
						`returned invalid output: ${error.message}`,
					),
				]);
			}
		});
		child.stdin.end(input);
	});
}
