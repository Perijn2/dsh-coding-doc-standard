---
slug: "version-profiles"
title: "Version Profiles"
system: the System
phase: P2
status: draft
---

# Version Profiles

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-018 | ubiquitous | MUST | The System shall associate every profile with a language version range. | ADR-0005 |
| REQ-019 | event_driven | MUST | When a file of a language is validated, the System shall select the profile whose version range contains the detected project language version. | ADR-0005 |
| REQ-020 | event_driven | MUST | When the user pins a profile for a language in settings, the System shall use the pinned profile over the detected profile. | ADR-0005 |
| REQ-021 | unwanted_behaviour | MUST | If no profile matches the detected language version, then the System shall select the pack default profile. | ADR-0005 |