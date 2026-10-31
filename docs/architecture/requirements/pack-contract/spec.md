---
slug: "pack-contract"
title: "Pack Contract"
system: the System
phase: P2
status: draft
---

# Pack Contract

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-002 | ubiquitous | MUST | The System shall load every installed language pack from a manifest declaring a unique pack id, a human label, language metadata, and at least one profile. | ADR-0001 |
| REQ-003 | unwanted_behaviour | MUST | If a pack manifest is missing, malformed, or fails validation, then the System shall exclude that pack from enforcement and log a warning naming the pack and the reason. | ADR-0001 |
| REQ-004 | ubiquitous | MUST | The System shall execute no code from a language pack beyond the dependency providers its profiles declare. | ADR-0001 |