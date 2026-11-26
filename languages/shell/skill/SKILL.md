---
name: coding-doc-standard-shell
description: >-
  Native comment syntax for the coding documentation standard: leading #
  blocks for script headers and shell functions. Load together with
  coding-doc-standard for any task touching .sh or .bash files.
---

# Shell Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in shell. The file `example.sh` next to this skill is the
golden reference — a complete, working script documented to the standard;
copy its shape when unsure.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Preserve existing project conventions; the formatter never renames declarations.
The [POSIX shell language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html)
uses portable names consisting of letters, digits, and underscores, not starting
with a digit; `read_status` is a portable function name. This is syntax, not a
universal casing policy. [Google's Bash guide](https://google.github.io/styleguide/shellguide.html#s7-naming-conventions)
recommends snake_case functions/variables and UPPER_CASE constants/exported
variables, but that is a project guide, not a shell-wide requirement. Its
`package::function` form is not portable POSIX function naming. Choose casing
with the project and target shell; shell has no native type or enum declarations.
See the source survey in [Declaration naming](../../../docs/naming.md).

## File header — leading `#` block

```sh
#!/usr/bin/env bash
# Author: Perijn Huijser
# Summary: Fetch a report and retry it within a bounded budget.
#
# Description:
#     Expand the summary briefly, then work an example through the
#     script: how a caller invokes it, what it prints, what its exit
#     codes mean.
#
# Changelog:
#     2026-08: Added a quiet mode for cron runs.
```

The header block sits directly after the shebang; a blank line ends it.

## Function documents

Attach a `#` block directly above every function; the first line is the
imperative summary. Say in the prose what the function reads (arguments,
variables, stdin), what it writes (stdout, files), and what its exit
status means — those are shell’s parameters, returns, and errors.

```sh
# Wait the configured interval unless this is the final attempt.
# Reads ATTEMPT_INTERVAL_SECONDS; prints nothing; always succeeds.
wait_between_attempts() {
	[ "$attempt" -lt "$attempts" ] && sleep "$ATTEMPT_INTERVAL_SECONDS"
	return 0
}
```

- Configuration variables at the top of the script carry their own `#`
  line stating what they control and their unit.
- A one-line comment above a helper is enough when there is nothing more
  to warn about; never leave a function with no comment at all.

## Examples

State the example in plain `#` comment prose after an `Example:` line;
comment the result after each call.

```sh
# Turn a title into a URL slug; prints "untitled" when nothing usable
# remains.
#
# Example:
#     slug "Hello, World!"   # hello-world
slug() {
	tr '[:upper:]' '[:lower:]' <<<"$1" | tr -cs '[:alnum:]' '-'
}
```
