# Docker Compose Documentation Rules

Author: Perijn Huijser

Load this reference only for recognized Docker Compose files after applying
`SKILL.md`. Treat Compose as a configuration-language profile, not generic YAML.
Do not use `x-...` extension fields as a prose-documentation workaround.

## Root header

Start a recognized Compose file with YAML comments containing `Author:`,
`Summary:`, and `Usage:`. Usage is an operational guide tailored to this stack,
not a mandatory subsection template. Include only useful, verified guidance
about configuration, startup and shutdown, service dependencies, caller-visible
interfaces, limitations, failure handling, and complete command workflows when
the Compose file establishes them. Keep every claim operationally true.

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
#   Core principle: Keep the application service and its caller-visible runtime
#   contract together, while leaving secrets and environment-specific values to
#   the operator.
#
#   Setup: Provide APP_ENV before starting the stack. The example publishes the
#   service's configured port and does not define a database dependency.
#
#   Workflow: Start app for local development, inspect the published endpoint,
#   then stop the service to remove its container. Recreate the service after
#   changing the image or environment configuration.
#
#   API guide: The app service is the stack entry point; its published port is
#   the only caller-visible interface established by this file.
#
#   Worked example: export APP_ENV=development; docker compose up -d app;
#   curl http://localhost:8080/health; docker compose stop app
services:
  # Summary: Runs the application process for local development.
  # Notes: APP_ENV is passed to the container; the port mapping is the
  # caller-visible endpoint established by this Compose file.
  app:
    image: example/app
    environment:
      APP_ENV: ${APP_ENV}
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
node scripts/verify/verify.mjs compose.yaml
```

That command runs `prettier --check`, `yamllint`, and
`docker compose -f compose.yaml config -q`. A bare `npm run verify` validates
this package's bundle assets; it does not validate an arbitrary Compose file.
