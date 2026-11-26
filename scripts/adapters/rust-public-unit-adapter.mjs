/**
 * @module rust-public-unit-adapter
 * @author Perijn Huijser
 * Runs rustdoc's missing_docs lint for a pending Rust candidate.
 *
 * Usage:
 *   Core principle: Ask rustdoc to establish the public item surface and report
 *   missing native rustdoc without writing the candidate into the project.
 *   Setup: Configure this file as the Rust public-unit adapter command.
 *   Workflow: Read one JSON candidate, compile it in an isolated temporary
 *   directory, and emit normalized violations as one JSON object.
 *   API guide: The stdin protocol is the adapter entry point; stdout contains
 *   the documented violations array and stderr contains tool failures.
 *   Worked example: Pipe a JSON candidate to this script.
 */

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

function run(command, args, cwd) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.once("error", (error) =>
			resolve({ code: null, stdout, stderr, error }),
		);
		child.once("exit", (code) => resolve({ code, stdout, stderr }));
	});
}

function diagnostics(output) {
	const violations = [];
	for (const line of output.split(/\r?\n/)) {
		if (!line.trim()) continue;
		try {
			const item = JSON.parse(line);
			const message = item.message?.message ?? item.message;
			if (typeof message !== "string") continue;
			if (!/missing documentation/i.test(message)) continue;
			const spans = item.message.spans ?? [];
			const primary = spans.find((span) => span.is_primary) ?? spans[0];
			violations.push({
				line: primary?.line ?? 1,
				kind: "Rust public unit",
				message: "Missing native rustdoc documentation.",
			});
		} catch {
			// Non-JSON tool output is handled as a failed invocation when needed.
		}
	}
	return violations;
}

async function main() {
	let input = "";
	process.stdin.setEncoding("utf8");
	for await (const chunk of process.stdin) input += chunk;
	const candidate = JSON.parse(input);
	if (
		!candidate ||
		typeof candidate.path !== "string" ||
		typeof candidate.content !== "string"
	)
		throw new Error("input must contain string path and content");
	const directory = await mkdtemp(join(tmpdir(), "coding-doc-rust-"));
	try {
		const file = join(directory, basename(candidate.path) || "candidate.rs");
		const output = join(directory, "target");
		await writeFile(file, candidate.content, "utf8");
		const result = await run(
			process.platform === "win32" ? "rustdoc.exe" : "rustdoc",
			[
				"--crate-type",
				"lib",
				"--edition",
				"2021",
				"--error-format",
				"json",
				"--deny",
				"missing_docs",
				file,
				"-o",
				output,
			],
			directory,
		);
		if (result.error) throw result.error;
		const violations = diagnostics(result.stderr + result.stdout);
		if (result.code !== 0 && !violations.length)
			throw new Error(
				(
					result.stderr ||
					result.stdout ||
					`rustdoc exited ${result.code}`
				).trim(),
			);
		process.stdout.write(JSON.stringify({ violations }));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

main().catch((error) => {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
});
