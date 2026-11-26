/**
 * @module naming-pack-tests
 * Exercise shipped naming profiles and the pending-write gate.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
	getRegistry,
	packCoverageFor,
	validateWithPacks,
} from "../src/engine/index.mjs";
import { checkNaming } from "../src/engine/naming.mjs";
import { validateCandidate } from "../src/hook/run.mjs";

const cases = {
	python: [
		"class GoodType:\n    pass\ndef good_function():\n    pass\n",
		"class bad_type:\n    pass\ndef BadFunction():\n    pass\n",
	],
	rust: [
		"struct GoodType;\nfn good_function() {}\nconst GOOD_VALUE: u8 = 1;",
		"struct bad_type;\nfn BadFunction() {}\nconst bad_value: u8 = 1;",
	],
	go: [
		"package sample\ntype GoodType struct {}\nfunc goodFunction() {}",
		"package sample\ntype bad_type struct {}\nfunc bad_function() {}",
	],
	java: [
		"class GoodType { void goodFunction() {} }",
		"class bad_type { void BadFunction() {} }",
	],
	kotlin: [
		"class GoodType\nfun goodFunction() {}",
		"class bad_type\nfun bad_function() {}",
	],
	csharp: [
		"class GoodType { void GoodFunction() {} }",
		"class bad_type { void bad_function() {} }",
	],
	scala: [
		"class GoodType { def goodFunction(): Int = 1 }",
		"class bad_type { def BadFunction(): Int = 1 }",
	],
	swift: [
		"struct GoodType {}\nfunc goodFunction() {}",
		"struct bad_type {}\nfunc BadFunction() {}",
	],
	dart: [
		"class GoodType { void goodFunction() {} }",
		"class bad_type { void BadFunction() {} }",
	],
	php: [
		"<?php class GoodType { function goodFunction() {} }",
		"<?php class bad_type { function BadFunction() {} }",
	],
};

for (const [language, [good, bad]] of Object.entries(cases)) {
	test(`${language} ships working declaration naming queries`, async () => {
		const profile = getRegistry().packs.get(language).profiles.get("modern");
		assert.ok(profile.naming, `${language} must declare its guide`);
		assert.match(profile.naming.source, /^https:\/\//);
		assert.deepEqual(await checkNaming(good, profile), []);
		const findings = await checkNaming(bad, profile);
		assert.ok(
			findings.length >= 2,
			`${language}: expected type and function findings`,
		);
		assert.ok(
			findings.every(({ message }) => message.includes(profile.naming.source)),
		);
	});
}

const declarations = {
	rust: [
		"mod BadModule {}\nstruct GoodType { BadField: u8 }\nimpl GoodType { fn BadMethod() {} const bad_value: u8 = 1; }\nenum Mode { bad_variant }\nstatic bad_static: u8 = 1;",
		[
			"BadModule",
			"BadField",
			"BadMethod",
			"bad_value",
			"bad_variant",
			"bad_static",
		],
	],
	go: [
		"package sample\nconst Bad_name, Other_bad = 1, 2",
		["Bad_name", "Other_bad"],
	],
	java: [
		"class GoodType { static final int bad_value=1, other_value=2; }\nenum Mode { bad_case }",
		["bad_value", "other_value", "bad_case"],
	],
	kotlin: ["const val bad_value=1", ["bad_value"]],
	csharp: [
		"class GoodType { const int bad_value=1, other_value=2; void GoodMethod() { const int local_value=1; } }\nenum Mode { bad_case }",
		["bad_value", "other_value", "local_value", "bad_case"],
	],
	swift: [
		"enum Mode { case BadCase, OtherCase(Int) }",
		["BadCase", "OtherCase"],
	],
	dart: ["enum Mode { BadCase, OtherCase }", ["BadCase", "OtherCase"]],
	php: [
		"<?php class GoodType { const bad_value=1, other_value=2; }",
		["bad_value", "other_value"],
	],
};
for (const [language, [content, names]] of Object.entries(declarations)) {
	test(`${language} checks every selected enum, constant or grouped declaration`, async () => {
		const profile = getRegistry().packs.get(language).profiles.get("modern");
		const findings = await checkNaming(content, profile);
		for (const name of names)
			assert.ok(
				findings.some(({ message }) => message.includes(`'${name}'`)),
				`${language} missed ${name}`,
			);
	});
}

const exceptions = {
	python:
		"class GoodType:\n    @override\n    def RequiredName(self): pass\n    @typing.override\n    def AnotherName(self): pass",
	rust: "struct GoodType;\nimpl External for GoodType { fn RequiredName() {} const required_value: u8=1; }",
	java: "class GoodType { @Override void RequiredName() {} final int ordinaryValue=1; }",
	kotlin:
		"fun FactoryFunction() {}\n@Test fun test_name() {}\nfun `test name`() {}\nval ordinaryValue=1\nenum class Mode { GOOD_MODE, GoodMode }",
	csharp:
		"class GoodType { public override void required_name() {} void IExternal.required_name() {} void @GoodMethod() {} }",
	scala:
		"class marker extends scala.annotation.StaticAnnotation\nclass GoodType { def +(other: Int): Int = 1 }",
	swift:
		"func goodFunction() -> Bool { true }\nprefix func ! (value: Bool) -> Bool { value }\nclass GoodType { override func RequiredName() {} }",
	dart: "class GoodType { @override external void Required_name(); }",
	php: "<?php class GoodType { function __construct() {} } enum Mode { case GoodCase; } function free_function() {}",
};
for (const [language, content] of Object.entries(exceptions)) {
	test(`${language} preserves explicit foreign names and guide exceptions`, async () => {
		const profile = getRegistry().packs.get(language).profiles.get("modern");
		assert.deepEqual(await checkNaming(content, profile), []);
	});
}

test("every language skill embeds its naming policy and selected guide", () => {
	for (const pack of getRegistry().packs.values()) {
		const skill = readFileSync(
			join(pack.directory, "skill", "SKILL.md"),
			"utf8",
		);
		const section = skill
			.split(/^## Declaration naming\r?\n/m)[1]
			?.split(/^## /m)[0];
		assert.ok(section, `${pack.manifest.id}: missing embedded naming guidance`);
		for (const profile of pack.profiles.values()) {
			if (profile.naming) {
				assert.ok(
					section.includes(profile.naming.source),
					`${pack.manifest.id}: missing selected guide`,
				);
				for (const rule of profile.naming.rules)
					assert.ok(
						section.includes(rule.style),
						`${pack.manifest.id}: missing ${rule.style}`,
					);
			} else {
				assert.match(
					section,
					/no declaration naming check or naming block configured/i,
					`${pack.manifest.id}: state naming is not enforced`,
				);
			}
		}
	}
});

test("every named profile accepts its golden example", async () => {
	for (const pack of getRegistry().packs.values()) {
		const profile = pack.profiles.get("modern");
		if (!profile.naming) continue;
		const directory = join(pack.directory, "skill");
		const example = readdirSync(directory).find((name) =>
			name.startsWith("example."),
		);
		assert.ok(example, pack.manifest.id);
		assert.deepEqual(
			await checkNaming(
				readFileSync(join(directory, example), "utf8"),
				profile,
			),
			[],
			pack.manifest.id,
		);
	}
});

test("pack validation reports naming even when documentation is valid", async () => {
	const candidate = {
		path: "sample.rs",
		content: "//! Summary: Hold a value.\nconst bad_value: u8 = 1;\n",
	};
	const findings = await validateWithPacks(
		candidate,
		packCoverageFor(candidate.path),
	);
	assert.ok(
		findings.some((line) => /bad_value.*SCREAMING_SNAKE_CASE/.test(line)),
	);
});

test("pending write blocks naming violations without changing candidate", async () => {
	const candidate = {
		path: "sample.rs",
		content: "//! Summary: Hold a value.\nconst bad_value: u8 = 1;\n",
	};
	const original = candidate.content;
	const result = await validateCandidate(candidate, { formatRust: false });
	assert.equal(result.status, "violations");
	assert.ok(
		result.findings.some(({ text }) =>
			/bad_value.*SCREAMING_SNAKE_CASE/.test(text),
		),
	);
	assert.equal(candidate.content, original);
	const disabled = await validateCandidate(candidate, {
		formatRust: false,
		languages: { rust: false },
	});
	assert.ok(
		!disabled.findings.some(({ text }) =>
			text.includes("SCREAMING_SNAKE_CASE"),
		),
	);
});
