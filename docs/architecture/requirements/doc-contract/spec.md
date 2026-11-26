---
slug: "doc-contract"
title: "Doc Contract"
system: the System
phase: P2
status: draft
---

# Doc Contract

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-005 | ubiquitous | MUST | The System shall enforce one language-independent documentation contract that requires an Author field, a brief Summary field, and a brief Description field, and accepts optional Usage, Changelog, and Notes fields. | ADR-0002 |
| REQ-006 | ubiquitous | MUST | The System shall accept any brief Summary text without enforcing a sentence count. | ADR-0002 |
| REQ-007 | event_driven | MUST | When the Usage field is present, the System shall require the Usage text to reference at least one unit discovered in the file. | ADR-0002 |
| REQ-008 | unwanted_behaviour | MUST | If a required header field is absent or empty, then the System shall deny the write and name the missing field. | ADR-0002 |
| REQ-009 | ubiquitous | MUST | The System shall enforce the same public-unit contract of a Summary plus Parameters, Returns, and Errors sections where each is meaningful for every supported language. | ADR-0002 |
| REQ-038 | ubiquitous | MUST | The System shall require only the Author and Summary fields in a file header and shall treat Description, Usage, Changelog, and Notes as optional content carrying no checking obligation, superseding the Description requirement of REQ-005 and the Usage reference rule of REQ-007. | ADR-0008 |