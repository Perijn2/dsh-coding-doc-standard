---
name: coding-doc-standard
description: Enforces documentation and formatting requirements for Python, TypeScript, JavaScript, Rust, C/C++, and Docker Compose.
---

# Coding Documentation Standard

Author: Perijn Huijser

## Core rule

Never invent documentation. Ask the user when an author, behavior, API contract,
or operational detail cannot be established from implemented code or configuration.

## Profiles

- Load `references/python.md` for Python.
- Load `references/typescript-javascript.md` for TypeScript or JavaScript.
- Load `references/rust.md` for Rust.
- Load `references/c-cpp.md` for C or C++.
- Load `references/docker-compose.md` for Compose files.

## Shared contract

Every supported source file begins with Author, Summary, and Usage. Public units
need accurate documentation. Compose files use a root YAML comment header and
service-adjacent Summary comments. Do not use `x-...` fields for prose docs.
