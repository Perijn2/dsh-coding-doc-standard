---
slug: "write-gate"
title: "Write Gate"
system: the System
phase: P2
status: draft
---

# Write Gate

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-025 | ubiquitous | MUST | The System shall aggregate every applicable finding for one pending write into one denial message. | ADR-0007 |
| REQ-026 | unwanted_behaviour | MUST | If a check cannot complete, then the System shall allow the write with a visible notice unless fail-closed is configured. | ADR-0007 |
| REQ-027 | event_driven | MUST | When one language pack fails internally, the System shall continue enforcing the remaining installed packs. | ADR-0007 |