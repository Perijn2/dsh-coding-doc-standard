# Test Plan — Language Pack Architecture

Every requirement in `docs/architecture/requirements/` maps to at least one test below.
Test ids are stable and referenced from feature `verification.md` entries as work lands.
Existing suites (`npm test`, 135 cases) keep passing throughout the migration; new suites
are listed per phase.

## 1. Pack contract (REQ-002, REQ-003, REQ-004)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| PK-01 | unit | REQ-002 | A valid `pack.json` with id, label, language metadata, and one profile loads into the registry. |
| PK-02 | unit | REQ-002 | A manifest missing any required field is refused at load with the field named. |
| PK-03 | unit | REQ-002 | Two packs with the same id cause the second load to fail with a duplicate-id refusal. |
| PK-04 | unit | REQ-003 | A malformed manifest (invalid JSON, bad id pattern) excludes the pack and logs a warning naming pack and reason. |
| PK-05 | unit | REQ-003 | A pack directory whose profiles directory is empty is excluded with a warning; other packs still register. |
| PK-06 | integration | REQ-004 | A pack declaring no executable entry has no module loaded from its directory beyond declared provider packages (assert via module loader spy). |
| PK-07 | integration | REQ-003 | One intentionally broken pack alongside two valid packs: the gate still denies an undocumented write in a valid-pack language. |

## 2. Universal documentation contract (REQ-005 … REQ-009)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| DC-01 | unit | REQ-038, REQ-008 | A decoded document without Author or Summary yields one finding per missing field, naming each field's primary spelling; a missing Description yields none. |
| DC-02 | unit | REQ-038, REQ-005 | Optional fields (Description, Usage, Changelog, Notes) absent produce no findings. |
| DC-03 | unit | REQ-006 | Summaries of 1, 2, and 4 sentences all pass; brevity is never a sentence-count failure. |
| DC-04 | unit | REQ-038 | Usage present and referencing a discovered unit name passes. |
| DC-05 | unit | REQ-038 | Usage present but referencing no unit yields no finding: the Usage reference rule is retired. |
| DC-06 | unit | REQ-008 | Empty-string header fields are treated as absent and named in findings. |
| DC-07 | unit | REQ-009 | A unit doc missing Summary yields a finding; missing Parameters when the unit declares parameters yields a finding. |
| DC-08 | unit | REQ-009 | Returns/Errors findings appear only when meaningful (declared return type / thrown errors), per profile capability flags. |
| DC-09 | integration | REQ-005 … REQ-009 | The same decoded document fixture run through the Lua codec and a synthetic second-language codec yields byte-identical findings. |

## 3. Codec and preamble (REQ-010 … REQ-013)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| CD-01 | unit | REQ-010 | The Lua codec decodes `--- Author: X` style headers into universal field names. |
| CD-02 | unit | REQ-011 | A shebang-leading file with a matching `preamble.shebang` decodes its header correctly. |
| CD-03 | unit | REQ-011 | A Go build-tag preamble and a Haskell pragma preamble are skipped before header decoding. |
| CD-04 | unit | REQ-012 | Non-preamble content before the header yields the missing-header finding. |
| CD-05 | unit | REQ-013 | `fields.author = "Author:"` decodes `Author: X`; `fields.author = "@author"` decodes `@author X` — same universal output. |
| CD-06 | unit | REQ-013 | Undeclared spellings do not decode and surface as missing-field findings. |
| CD-07 | integration | REQ-010 … REQ-013 | The Lua pilot pack enforces a documented file to pass and an undocumented file to be denied end to end through the gate. |

## 4. Unit discovery providers (REQ-014 … REQ-017)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| UD-01 | unit | REQ-014 | A profile declaring `tree-sitter` discovers functions via its query; kinds and names match the grammar's node types. |
| UD-02 | unit | REQ-014 | A profile declaring `regex` discovers units from declared patterns against a fixture. |
| UD-03 | unit | REQ-014 | A profile declaring `external-command` receives candidate JSON on stdin and its violations surface in the aggregated report. |
| UD-04 | unit | REQ-014, REQ-017 | A profile declaring `npm` loads the pinned package's declared entry and its output conforms to the `discovered-unit` contract. |
| UD-05 | unit | REQ-016 | A provider whose dependency is missing yields a visible skip notice; the write is allowed (fail-open) and no other language is affected. |
| UD-06 | unit | REQ-017 | A manifest with a range or latest-tag npm dependency is refused at pack load with the exact-pin requirement named. |
| UD-07 | integration | REQ-014 … REQ-016 | Two profiles with different providers enforce through the same gate in one session. |

## 5. Version profile selection (REQ-018 … REQ-021)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| VP-01 | unit | REQ-018 | Every loaded profile carries a non-empty `language_versions` range; a manifest without one is refused. |
| VP-02 | unit | REQ-019 | Detection hints (`go.mod`, `.python-version`, `package.json` engines fixture) select the matching profile. |
| VP-03 | unit | REQ-019 | Detection logs the resolved profile id and the hint that matched. |
| VP-04 | unit | REQ-020 | A user pin overrides detection for that language only; other languages still resolve by detection. |
| VP-05 | unit | REQ-021 | No detection hint and no pin selects the pack `default_profile`. |
| VP-06 | unit | REQ-019 | A detected version outside every profile range falls back to the default profile. |
| VP-07 | integration | REQ-018 … REQ-021 | One pack with two profiles enforces two fixture workspaces with different detected versions through different profiles in one session. |

## 6. Settings surface (REQ-022 … REQ-024)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| SS-01 | integration | REQ-022 | The settings schema renders one group per installed pack and one toggle per profile, generated from the registry. |
| SS-02 | integration | REQ-023 | Each profile toggle's description carries the profile's language version range. |
| SS-03 | integration | REQ-024 | Policy referencing a profile id with no installed pack renders a not-installed entry. |
| SS-04 | integration | REQ-022 | Installing and removing a pack changes the rendered groups with no settings source-code change. |
| SS-05 | integration | REQ-022 | A stored user section written for a since-removed pack resolves without error; unknown fields are ignored. |

## 6. Formatter adapters (REQ-028 … REQ-031)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| FA-01 | unit | REQ-030 | The `stdin-binary` adapter spawns the resolved binary, pipes the candidate on stdin, expands `{path}` and `{workspace}` placeholders, and treats the profile-declared exit codes as already-formatted. |
| FA-02 | unit | REQ-030 | The `npm-function` adapter imports the pinned package from the dependency store, calls the declared export, and treats returned text as the formatted candidate. |
| FA-03 | unit | REQ-030 | The `external-command` adapter locates the project-provided binary the profile declares and applies the same stdin protocol. |
| FA-04 | unit | REQ-028 | An engine source audit finds no formatter tool names outside adapter test fixtures. |
| FA-05 | unit | REQ-029 | A profile declaring no formatter receives no formatting pass; its findings come only from other passes. |
| FA-06 | integration | REQ-031 | With no packs installed, the tools store is empty and `provision-tools` provisions nothing. |
| FA-07 | integration | REQ-028, REQ-031 | Two packs declaring two different formatters on two different adapters both enforce through the same gate. |
| FA-08 | unit | REQ-028 | A profile declaring an unknown adapter name is refused at pack load, naming the adapter. |

## 7. Write gate (REQ-025 … REQ-027)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| WG-01 | integration | REQ-025 | A candidate violating formatting, header, and unit contracts yields one denial listing all findings. |
| WG-02 | integration | REQ-026 | A check that times out allows the write with a visible notice under fail-open (default). |
| WG-03 | integration | REQ-026 | With fail-closed configured, an incomplete check denies with the not-fully-checked trailer. |
| WG-04 | integration | REQ-027 | A pack whose provider throws is contained: remaining packs' findings still appear in the same report. |
| WG-05 | integration | REQ-025 … REQ-027 | The documentation write path spawns no interpreter process (no `py`/`python3` child) for packed languages. |
| WG-06 | regression | REQ-025 … REQ-027 | The existing 135-case suite keeps passing through each migration phase. |

## 7a. Pack-governed doc syntax (REQ-032 … REQ-038)

| Test id | Level | Requirement(s) | Description and assertion |
| --- | --- | --- | --- |
| DS-01 | unit | REQ-032 | A pack whose profile declares the header tokens decodes the header with no engine language branch consulted (pack syntax is the sole source). |
| DS-02 | unit | REQ-033 | A `line` profile (`---`, `#`) and a `block` profile (`/** … */`) each extract their leading header; the wrong syntax yields no header. |
| DS-03 | unit | REQ-033 | A `docstring` profile extracts the module docstring as its header. |
| DS-04 | unit | REQ-034 | A field with a spelling list resolves on any accepted spelling and reports the first spelling when missing. |
| DS-05 | unit | REQ-035 | A header line beginning with the declared tag sigil that matches no field is decoded as no content; unlabeled prose appends to the designated field. |
| DS-06 | integration | REQ-036 | Every installed pack's golden `example` file passes that pack's own header check; a broken example fails the suite. |
| DS-07 | integration | REQ-037 | For a header-only pack, the checker pass still reports unit findings but no longer reports the pack-owned header labels (no duplicate). |
| DS-08 | integration | REQ-038 | A conformant file whose header omits Usage writes cleanly; one missing the author is denied naming the pack's author spelling. |

## 7b. Checker removal via pack providers (REQ-039 … REQ-042)

| Case | Requirement | Given | When | Then |
| --- | --- | --- | --- | --- |
| CR-01 | REQ-039 | A pack exists for every formerly checker-covered family | Any covered-path write is validated | No `documentation` pass runs and `src/hook/checker.py` is absent |
| CR-02 | REQ-040 | A gated write targets a covered path | The gate completes its decision | No interpreter child was spawned for documentation checking |
| CR-03 | REQ-041 | A Python file defines public and underscore-prefixed functions | The Python pack discovers units | Only non-underscore units are enforced; each needs a docstring with a summary |
| CR-04 | REQ-041 | A Compose file lists a service with and one without a preceding summary comment | The Compose pack discovers units | Only the uncommented service is reported |
| CR-05 | REQ-042 | A Python docstring omits a Parameters section for a two-argument function | The pack unit check runs | Presence and summary are judged; name cross-matching is not reported |
| CR-06 | REQ-039 | Each family pack's golden `skill/example.*` | The golden self-test decodes and checks it | Zero findings for every installed pack |
| CR-07 | REQ-039 | A header-less file of each formerly covered family | The pack path validates it | Denied with the family's declared first spellings |

## 8. Contracts as tests

Every rendered contract in `docs/architecture/contracts/` gets a schema-validation test:
pack fixtures validate against `pack-manifest`; profile fixtures against `language-profile`;
provider outputs against `discovered-unit`; codec outputs against `decoded-documentation`;
the gate's decisions against `gate-decision`. Contract fixtures live beside the suites in
`tests/contracts/`.

## Phase mapping

- Phase 1: PK-01…07, DC-01…09, CD-01…07, UD-01…07 (tree-sitter and regex only), VP-01…07, SS-01…05, WG-01…06.
- Phase 2: formatter declaration tests (formatting routing per profile), skill composition tests.
- Phase 3: per-language port parity tests — each ported pack must reproduce the pre-port checker's verdicts on its existing fixtures before checker.py is removed.
