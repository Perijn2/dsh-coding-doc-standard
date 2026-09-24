# Shell Documentation Rules

Author: Perijn Huijser

Load this reference for POSIX Shell or Bash after applying `SKILL.md`.

## Scope and preamble

This profile applies only to `.sh` and `.bash` files. Keep an optional shebang
as the first line: it selects the interpreter and is not documentation. Put the
file header in consecutive `#` comment lines immediately after it, before shell
code. Do not assume that an extension identifies a dialect; the documented
interpreter must agree with the shebang and project evidence.

Zsh, Fish, PowerShell, extensionless scripts, generated-file markers, and
ShellCheck directives need separate project policy. Do not move a directive or
other required preamble merely to fit this profile.

## Implement the shared file header with shell comments

`SKILL.md` defines the required header fields and the substance of `Usage:`.
In a shell script, express those fields as a readable `#` comment block:

```sh
#!/usr/bin/env bash
# Author: Established Author
# Summary: Synchronizes the verified source directory to its configured target.
#
# Usage:
#   Run ./sync.sh <source> <target> after setting the documented credentials.
#   The script validates both paths, copies the source, and reports completion on
#   stdout. It returns a nonzero status when validation or copying fails.
#
# Notes:
#   The target is replaced only when the implementation's documented mode allows
#   it.
```

The example demonstrates comment layout, not a contract to copy. Replace every
claim with facts established for the target script. Use `# Usage:` followed by
indented prose, lists, or examples as needed; do not recreate a block-comment
syntax that the shell does not have. A blank `#` line separates the Summary,
Usage, and optional Notes groups.

For a sourceable library, describe sourcing rather than execution. For example:

```sh
# Author: Established Author
# Summary: Provides the verified archive helper functions for caller scripts.
#
# Usage:
#   Source this file with . "${PROJECT_ROOT}/lib/archive.sh" before calling its
#   documented helper functions. Callers inspect each helper's exit status and
#   perform any cleanup required by the established interface.
```

## Document shell interfaces where callers use them

Shell does not have a universal `public` keyword or documentation-comment
grammar. Use project evidence to identify interfaces: a script's command-line
contract, documented environment variables, functions deliberately called after
sourcing, and configuration files or commands it explicitly consumes. A
function or variable is not public merely because it exists.

Use consecutive `#` lines immediately above a public function or beside the
CLI parsing section. Translate the shared public-unit sections into plain shell
labels only when their contents are known. Prefer shell-specific names such as
`Arguments:`, `Environment:`, `Output:`, and `Exit status:` when they make the
contract clearer; these implement Parameters, Returns, and Errors rather than
adding a competing documentation model.

```sh
# Creates the requested archive and writes its path to standard output.
#
# Arguments:
#   $1: Source directory accepted by this script's archive workflow.
#   $2: Destination directory for the resulting archive.
#
# Output:
#   Writes the resulting archive path to stdout.
#
# Exit status:
#   Returns nonzero when the established validation or archive command fails.
create_archive() {
    # Implementation established by the target project.
    :
}
```

Document options and positional parameters at the command-line interface when
that is where users encounter them. Document exported environment variables
near their declaration or the parsing section, including direction and effect:

```sh
# Environment:
#   ARCHIVE_FORMAT: Selects a supported output format when set by the caller.
#   ARCHIVE_ROOT: Overrides the verified default destination when set.
```

Only document stdout, stderr, exit statuses, files changed, traps, temporary
resources, signal behavior, and cleanup when the implementation establishes
those facts. State whether output is for people or machine consumption when it
is known. Private helpers need no routine documentation; document them when a
non-obvious safety, lifecycle, quoting, or cleanup constraint matters.

## Shell-specific writing conventions

- Keep a function's comment directly adjacent to its definition; do not let an
  assignment, conditional, or another comment attach it ambiguously.
- Quote shell syntax in prose and examples precisely: use `$1`, `"$name"`,
  `"${array[@]}"`, `stdout`, `stderr`, and numeric exit statuses when those are
  verified parts of the interface.
- Explain caller obligations that are easy to miss in shell, such as required
  environment, current directory, sourced state, exit-status checks, traps, and
  cleanup. Do not claim `set -e`, `pipefail`, Bash arrays, or any feature unless
  the selected interpreter and implementation use it.
- Keep implementation comments focused on why shell-specific quoting, expansion,
  globbing, word splitting, or signal handling is necessary. Do not narrate
  obvious command syntax.

## Tooling boundaries

Do not infer or mandate `shfmt`, ShellCheck, interpreter syntax checks, or a
shell dialect. Prove the interpreter, tool versions, configuration, and
verification commands from the target project before using them.
