---
slug: "checker-removal"
title: "Checker Removal"
system: the System
phase: P2
status: draft
---

# Checker Removal

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-039 | event_driven | MUST | When a write targets a path covered by a pack, the System shall make every header and unit-documentation verdict through that pack's declared codec and unit providers, so that checker.py and its regex label tables are no longer consulted for any family. | ADR-0009 |
| REQ-040 | ubiquitous | MUST | The System shall spawn no interpreter process to decide documentation for a covered path; unit discovery for covered families shall run in-process through the declared grammar providers. | ADR-0009 |
| REQ-041 | ubiquitous | MUST | The System shall record the Python signature-to-Parameters/Returns name matching and the exact C/C++ at-file basename rule as deliberate relaxations removed with checker.py and shall not rebuild them in the engine. | ADR-0009 |
| REQ-042 | event_driven | MUST | When enforcing the Python or Compose pack, the System shall discover units through tree-sitter queries over the Python and YAML grammars that skip underscore-prefixed names and require each service's preceding summary comment, matching the retired checker's conventions. | ADR-0009 |