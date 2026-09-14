# Docker Compose Documentation Rules

Author: Perijn Huijser

Load this reference only for recognized Docker Compose files after applying
`SKILL.md`. Treat Compose as a configuration-language profile, not generic YAML.
Do not use `x-...` extension fields as a prose-documentation workaround.

## Root header

Start a recognized Compose file with YAML comments containing `Author:`,
`Summary:`, and `Usage:`. Under Usage, include **Core principle**, **Setup**,
**Workflow**, **API guide**, and **Worked example** in that order. Keep every
claim operationally true: document the real startup command, required
configuration, service lifecycle, and caller-visible ports or endpoints only
when they are established by the Compose file and its documented environment.

The write guard requires every root label above. It also requires a top-level
`services:` mapping; it does not determine whether image tags, environment
values, or operational prose are correct.

## Service comments

Put `# Summary:` immediately above each service mapping. Add nearby `# Notes:`
comments only for verified context such as required ports, mounts, dependencies,
health behavior, or lifecycle constraints. Keep runbooks and lengthy operational
procedures in project documentation rather than encoding prose as configuration.

## Documentation-shape example

This is a shape illustration. Replace service names, images, commands, ports,
and workflows with facts from the target Compose project before writing.

```yaml
# Author: Perijn Huijser
# Summary: Runs one local application service for development.
#
# Usage:
#   Core principle: Keep the local service definition close to its runtime needs.
#   Setup: Provide the environment values required by the service image.
#   Workflow: Start the service, use its declared endpoint, then stop the stack.
#   API guide: The app service exposes the configured development endpoint.
#   Worked example: docker compose up app
services:
  # Summary: Runs the application process for local development.
  # Notes: The published port is an example; use the project's verified mapping.
  app:
    image: example/app
    ports:
      - "8080:8080"
```

## Layout and review

Use one comment line per prose line and one blank comment line between the root
Summary and Usage. Keep each service Summary adjacent to its service key; do not
let unrelated comments satisfy a nearby service. A missing root header or
service Summary is a blocker. Unsupported factual claims, missing required
operator context, and misuse of `x-...` fields are also blockers; purely visual
comment-spacing defects are minor.

## Formatter and verifier

The pre-write guard uses the package-owned **Prettier 3.9.6** executable for
recognized Compose filenames and fails closed when that dependency is absent.
From this package checkout after `npm install`, format a Compose file with:

```text
npx prettier --write compose.yaml
npx prettier --check compose.yaml
```

Detailed verification requires all three project tools and must name the Compose
file explicitly:

```text
node scripts/verify.mjs compose.yaml
```

That command runs `prettier --check`, `yamllint`, and
`docker compose -f compose.yaml config -q`. A bare `npm run verify` validates
this package's bundle assets; it does not validate an arbitrary Compose file.
