/**
 * @module cpp-public-unit-adapter
 * @author Perijn Huijser
 * Uses Doxygen's parser to check native documentation on public C and C++ units.
 *
 * Usage:
 *   Core principle: Ask Doxygen to establish declarations and documentation.
 *   Setup: Configure this file as the C/C++ public-unit adapter command.
 *   Workflow: Read one JSON candidate, run Doxygen in an isolated temporary
 *   directory, and emit normalized violations without changing project files.
 *   API guide: The stdin protocol is the adapter entry point; stdout contains
 *   the violations array and stderr contains tool failures.
 *   Worked example: Pipe a JSON candidate to this script.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

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

async function diagnostics(xmlDirectory) {
	const violations = [];
	for (const name of await readdir(xmlDirectory)) {
		if (!name.endsWith(".xml") || name === "index.xml") continue;
		const xml = await readFile(join(xmlDirectory, name), "utf8");
		for (const match of xml.matchAll(
			/<memberdef\b[^>]*>([\s\S]*?)<\/memberdef>/g,
		)) {
			const member = match[0];
			const description = [
				member.match(/<briefdescription>([\s\S]*?)<\/briefdescription>/)?.[1],
				member.match(
					/<detaileddescription>([\s\S]*?)<\/detaileddescription>/,
				)?.[1],
			]
				.filter(Boolean)
				.join("")
				.replace(/<[^>]+>/g, "")
				.trim();
			if (description) continue;
			const line = Number(
				member.match(/<location\b[^>]*\bline="(\d+)"/)?.[1] ?? 1,
			);
			const unitName = member.match(/<name>([^<]+)<\/name>/)?.[1];
			violations.push({
				line,
				kind: "C/C++ public unit",
				name: unitName,
				message: "Missing native Doxygen documentation.",
			});
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
	const directory = await mkdtemp(join(tmpdir(), "coding-doc-cpp-"));
	try {
		const file = join(
			directory,
			basename(candidate.path) ||
				`candidate${extname(candidate.path) || ".cpp"}`,
		);
		const output = join(directory, "build");
		const config = join(directory, "Doxyfile");
		await writeFile(file, candidate.content, "utf8");
		await writeFile(
			config,
			[
				`INPUT = ${file}`,
				`OUTPUT_DIRECTORY = ${output}`,
				"QUIET = YES",
				"EXTRACT_ALL = YES",
				"WARN_IF_UNDOCUMENTED = YES",
				"WARN_IF_DOC_ERROR = YES",
				"WARN_NO_PARAMDOC = YES",
				"WARN_AS_ERROR = NO",
				"GENERATE_HTML = NO",
				"GENERATE_LATEX = NO",
				"GENERATE_XML = YES",
			].join("\n"),
			"utf8",
		);
		const result = await run(
			process.platform === "win32" ? "doxygen.exe" : "doxygen",
			[config],
			directory,
		);
		if (result.error) throw result.error;
		const violations = await diagnostics(join(output, "xml"));
		if (result.code !== 0 && !violations.length)
			throw new Error(
				(
					result.stderr ||
					result.stdout ||
					`doxygen exited ${result.code}`
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
