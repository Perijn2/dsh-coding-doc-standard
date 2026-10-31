---
slug: "codec"
title: "Codec"
system: the System
phase: P2
status: draft
---

# Codec

| id | pattern | priority | statement | adrs |
| --- | --- | --- | --- | --- |
| REQ-010 | ubiquitous | MUST | The System shall decode each language native documentation syntax into the universal contract through the language pack codec declaration. | ADR-0001 |
| REQ-011 | ubiquitous | MUST | The System shall skip the preamble a profile declares, including shebang lines, before decoding the documentation header. | ADR-0003 |
| REQ-012 | unwanted_behaviour | MUST | If the documentation header is not the first content after the declared preamble, then the System shall report the file as missing its documentation header. | ADR-0003 |
| REQ-013 | event_driven | MUST | When a codec declaration names a field spelling, the System shall decode text matching that spelling into the universal field name. | ADR-0003 |