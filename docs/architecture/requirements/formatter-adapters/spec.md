---
slug: "formatter-adapters"
title: "Formatter Adapters"
system: the System
phase: P2
status: draft
---

# Formatter Adapters

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-028 | ubiquitous | MUST | The System shall implement no formatter-specific knowledge and invoke every formatter only through the adapter contract that its profile declares. |  |
| REQ-029 | unwanted_behaviour | MUST | If a profile declares no formatter, then the System shall run no formatting check on that profile's files. |  |
| REQ-030 | ubiquitous | MUST | The System shall provide stdin-binary, npm-function, and external-command as formatter adapter contracts. |  |
| REQ-031 | ubiquitous | MUST | The System shall ship no default formatter and provision no tool that no installed pack declares. |  |