#!/usr/bin/env node
/**
 * @module harness-installer
 * @author Perijn Huijser
 * Provisions the pinned toolchain and the machine-wide skill without owning package links.
 *
 * @remarks
 * Usage:
 *   Core principle: `dsh plugin --profile <name> add .` owns Cordis registration,
 *   the dependency spec, the lockfile, and the installed package link, so this
 *   script never writes any of them.
 *   Setup: Run `dsh plugin --profile web add .` from this package directory first.
 *   Workflow: Validate bundle metadata, provision pinned tools, copy the skill,
 *   then report whether the bundle is actually listed by a profile.
 *   API guide: Run with --dry-run to preview every filesystem mutation.
 *   Worked example: node scripts/install.mjs --dry-run
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { provisionTools } from "./provision-tools.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dryRun = process.argv.includes("--dry-run");
const packageJson = JSON.parse(
	readFileSync(join(packageRoot, "package.json"), "utf8"),
);
const patch = packageJson.dsh?.bundle?.patch;
if (patch !== "./bundle.patch.yml" || !existsSync(join(packageRoot, patch))) {
	throw new Error("package must declare an existing dsh.bundle.patch");
}

await provisionTools({ dryRun });

const skillTarget = join(homedir(), ".dsh", "skills", packageJson.name);
console.log(`${dryRun ? "would copy" : "copying"} skill ${skillTarget}`);
if (!dryRun) {
	rmSync(skillTarget, { recursive: true, force: true });
	mkdirSync(dirname(skillTarget), { recursive: true });
	cpSync(join(packageRoot, "skill"), skillTarget, { recursive: true });
}

// The loader composes layers only from each profile's `dsh.profile.bundles` list,
// so an installed-but-unlisted bundle never loads. Report that instead of fixing it.
const profilesRoot = join(homedir(), ".dsh", "profiles");
const listed = [];
if (existsSync(profilesRoot)) {
	for (const entry of [
		{ name: "web", dir: join(profilesRoot, "web") },
		{ name: "headless", dir: join(profilesRoot, "headless") },
	]) {
		const manifestPath = join(entry.dir, "package.json");
		if (!existsSync(manifestPath)) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		if (manifest.dsh?.profile?.bundles?.includes(packageJson.name)) {
			listed.push(entry.name);
		}
	}
}

if (listed.length > 0) {
	console.log(
		`Bundle is listed by profile(s): ${listed.join(", ")}. Registration is owned by dsh plugin; nothing here was written.`,
	);
} else {
	console.warn(
		`${packageJson.name} is not listed in any profile's dsh.profile.bundles, so it will not load. Register it with: dsh plugin --profile web add ${packageRoot}`,
	);
}
