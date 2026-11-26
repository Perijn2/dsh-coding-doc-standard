---
slug: "doc-syntax"
title: "Doc Syntax"
system: the System
phase: P2
status: draft
---

# Doc Syntax

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-032 | ubiquitous | MUST | The System shall decode the documentation header of every installed-pack language solely from the syntax tokens and field spellings that the matching profile declares. | ADR-0008 |
| REQ-033 | ubiquitous | MUST | The System shall extract the documentation header from line-prefixed comments, delimited comment blocks, and docstring quotes according to the header syntax the profile declares. | ADR-0008 |
| REQ-034 | ubiquitous | MUST | The System shall accept an ordered list of accepted spellings for each documentation field and shall name the first accepted spelling when it reports a missing field. | ADR-0008 |
| REQ-035 | ubiquitous | MUST | The System shall decode no content for a header line that begins with the declared tag sigil yet matches no field spelling, and shall append unlabeled header prose to the field the profile designates. | ADR-0008 |
| REQ-036 | ubiquitous | MUST | The System shall check each installed pack's golden example file against that pack's own documentation checks, and a golden example that fails shall fail the test suite. | ADR-0008 |
| REQ-037 | state_driven | MUST | While a pack governs only the documentation header of its language, the System shall keep unit-documentation checks in their existing pass and shall suppress only the duplicated header labels from it. | ADR-0008 |