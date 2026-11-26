---
slug: "unit-discovery"
title: "Unit Discovery"
system: the System
phase: P2
status: draft
---

# Unit Discovery

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-014 | ubiquitous | MUST | The System shall discover units through the dependency provider that the matching profile declares. | ADR-0004 |
| REQ-015 | ubiquitous | MUST | The System shall provide tree-sitter, regex, npm, and external-command as unit-discovery providers. | ADR-0004 |
| REQ-016 | unwanted_behaviour | MUST | If a declared dependency provider or its pinned package is unavailable, then the System shall skip enforcement for that profile and report a visible notice. | ADR-0004 |
| REQ-017 | ubiquitous | MUST | The System shall pin every npm package dependency to one exact version. | ADR-0004 |