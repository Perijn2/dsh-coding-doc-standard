---
name: coding-doc-standard-docker-compose
description: >-
  Native YAML-comment syntax for the coding documentation standard: the root
  header and per-service summaries for Compose files. Load together with
  coding-doc-standard for any task touching compose.yaml, compose.yml,
  docker-compose.yaml, or docker-compose.yml.
---

# Docker Compose Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Compose. The file `example.yaml` next to this skill is the
golden reference — a complete working stack documented to the standard;
copy its shape when unsure. Treat Compose as a configuration language, not
generic YAML: never use `x-...` extension fields as a prose workaround.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Compose is configuration, not a programming language; programming-language
class/function/constant casing rules do not apply to service keys. Preserve
existing project conventions and leave service names unchanged. The formatter
never renames services or other keys. For example, an existing `app` service
remains `app`, including references in commands and dependencies; documentation
work must not turn it into `App` or `APP`. The language casing survey in
[Declaration naming](../../../docs/naming.md) does not prescribe a Compose
service-name style.

## File header — leading comments

```yaml
# Author: Perijn Huijser
# Summary: Run one local application service for development.
#
# Description:
#   Expand the summary briefly, then work the real workflow through the
#   stack: what the operator must provide before startup, which endpoints
#   are caller-visible, what happens when a dependency is unreachable.
#
# Changelog:
#   2026-08: Dropped the redis dependency.
services:
  # Summary: Run the application process for local development.
  app:
    image: example/app
```

- The header comes before the first root label and keeps the standard field
  order.
- Services are the stack's public API: each gets a `# Summary:` comment
  directly above its mapping, plus `# Notes:` lines only for verified facts
  such as required environment values, mounts, or lifecycle constraints.
- One blank comment line between sections; keep a service's comments adjacent
  to its key.

## Examples

The quickstart in the root Description is a command block: show the real
`docker compose` invocations and what the caller checks afterwards, one
comment line each.

```yaml
# Description:
#   Quickstart:
#     docker compose up -d app        # start the service
#     curl http://localhost:8080/health  # expect: {"status":"ok"}
#     docker compose stop app         # remove the container
```

## Other public kinds

Top-level `configs:`, `secrets:`, and `volumes:` entries are part of the
stack's surface too: each gets a `# Summary:` comment above its mapping
stating what it provides, where it comes from, and which services consume it.
Environment values the operator must set are listed in the root Description
with their effect and what breaks when they are wrong.
