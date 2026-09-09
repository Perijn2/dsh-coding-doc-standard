# Docker Compose Documentation Rules

Author: Perijn Huijser

Use Docker Compose as a configuration-language profile, not as generic YAML.

## Root header

Start recognized Compose files with YAML comments containing `Author:`,
`Summary:`, and `Usage:`. Usage covers Core principle, Setup, Workflow, API guide,
and Worked example.

## Services

Place a `# Summary:` comment immediately above each service mapping. Add `Notes:`
comments when ports, mounts, dependencies, or lifecycle behavior need context.

## Validation

The write hook checks comment structure. Run `npm run verify` for Prettier,
yamllint, `docker compose config -q`, and optional security scanning. Keep
operational runbooks in project documentation rather than `x-...` fields.
