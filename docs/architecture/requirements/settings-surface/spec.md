---
slug: "settings-surface"
title: "Settings Surface"
system: the System
phase: P2
status: draft
---

# Settings Surface

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-022 | ubiquitous | MUST | The System shall render the settings menu from the installed pack registry with one group per pack and one toggle per profile. | ADR-0006 |
| REQ-023 | ubiquitous | MUST | The System shall display each profile language version range in the settings menu. | ADR-0006 |
| REQ-024 | event_driven | MUST | When a policy references a profile id whose pack is not installed, the System shall render the entry as not installed. | ADR-0006 |