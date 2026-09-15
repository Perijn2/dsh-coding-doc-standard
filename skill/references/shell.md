# Shell Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It currently checks only a leading
house-style `#` documentation header for `.sh` and `.bash` files. It has no
public-function model, dialect validator, formatter, linter, or detailed
verifier yet.

## Supported header shape

Place consecutive `#` comment lines after an optional first-line shebang. The
header must contain `Author:`, `Summary:`, and `Usage:`. The shebang remains the
interpreter selector, so do not put the header before it.

Extensionless scripts, Zsh, Fish, PowerShell, ShellCheck directives, and other
preamble conventions are not supported by this first version. It fails when
enabled rather than assuming a shell dialect from arbitrary content.

## Native shell guidance

Shell comments are `#` comments; the language does not define a universal API
visibility or documentation-comment grammar. Treat this header as package policy
only, and ask the project owner how sourced libraries, functions, environment
variables, and command-line interfaces are documented.

## Current limits

Do not infer that this profile runs `shfmt`, ShellCheck, or interpreter syntax
checks. Dialect selection and project tool configuration must be proved before a
formatter or verifier is added.