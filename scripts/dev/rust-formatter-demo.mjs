/**
 * @module rust-formatter-demo
 * @author Perijn Huijser
 * Demonstrates that the Rust pack's project-toolchain formatter actually runs.
 *
 * @remarks
 * Usage:
 *   Core principle: One run shows the pack declaration, the live rustfmt, the
 *   formatted bytes, and the gate verdicts for the on and off states.
 *   Setup: Run from the repository root with Node. A Rust toolchain on PATH
 *   makes the demonstration real; without one the script reports the miss.
 *   Workflow: Print the rust formatter declaration, probe rustfmt, format an
 *   unformatted candidate, then run the pre-write gate and the write-through
 *   preview through the same pack declaration.
 *   Worked example: node scripts/dev/rust-formatter-demo.mjs
 */

import { spawnSync } from "node:child_process";
import {
	formatterDeclarationFor,
	formatWithDeclaredFormatter,
} from "../../src/engine/formatters.mjs";
import { getRegistry } from "../../src/engine/registry.mjs";
import * as run from "../../src/hook/run.mjs";
import { previewFormat } from "../../src/host/write-through.mjs";

const candidate = {
	path: "src/main.rs",
	content: 'fn main() {  println!("hi"); }\n',
};
const policy = {
	...run.loadPolicy(),
	enabled: true,
	formatOnWrite: true,
	formatRust: true,
	languages: { rust: true },
};

const registry = getRegistry();
const declaration = formatterDeclarationFor(candidate.path);
console.log("=== 1. pack declaration (no engine-side rust branch) ===");
console.log(
	"registry packs:",
	registry.packs.size,
	"excluded:",
	registry.excluded.length,
);
console.log(
	"rust pack:",
	declaration.pack.manifest.id,
	"packVersion:",
	declaration.pack.manifest.packVersion,
);
console.log(
	"formatter declaration:",
	JSON.stringify(declaration.formatter, null, 2),
);

console.log("\n=== 2. is the project rustfmt on PATH? ===");
const probe = spawnSync("rustfmt", ["--version"], {
	encoding: "utf8",
	shell: process.platform === "win32",
});
console.log(
	probe.status === 0
		? `rustfmt --version -> ${probe.stdout.trim()}`
		: `rustfmt NOT found (${probe.error?.code ?? `exit ${probe.status}`})`,
);

console.log(
	"\n=== 3. formatWithDeclaredFormatter on an unformatted candidate ===",
);
const formatted = await formatWithDeclaredFormatter(
	candidate,
	policy,
	process.cwd(),
);
console.log("status:", formatted.status, "changed:", formatted.changed);
console.log("input:         ", JSON.stringify(candidate.content));
console.log("formatted text:", JSON.stringify(formatted.text));

console.log("\n=== 4. pre-write gate verdicts (checkFormatting) ===");
const blocked = await run.checkFormatting(candidate, policy);
console.log(
	"unformatted candidate ->",
	blocked ? blocked.split("\n")[0] : "pass (null)",
);
const clean = await run.checkFormatting(
	{ path: candidate.path, content: formatted.text ?? candidate.content },
	policy,
);
console.log(
	"formatted candidate   ->",
	clean === null ? "pass (null)" : clean.split("\n")[0],
);
const off = await run.checkFormatting(candidate, {
	...policy,
	formatRust: false,
});
console.log("formatRust=false      ->", off === null ? "skipped (null)" : off);

console.log("\n=== 5. write-through preview (format_code path) ===");
const receipt = await previewFormat({
	filePath: candidate.path,
	content: candidate.content,
	language: "rust",
	run,
	policy,
	cwd: process.cwd(),
});
console.log(
	"receipt:",
	JSON.stringify({
		applied: receipt.applied,
		language: receipt.language,
		formatter: receipt.formatter,
		changed: receipt.changed,
		validation: receipt.validation,
	}),
);
console.log("formatted_content:", JSON.stringify(receipt.formatted_content));
