# Shell Profile Plan

Author: Perijn Huijser

## Evidence

[ShellCheck](https://github.com/koalaman/shellcheck/blob/master/README.md)
describes itself as a shell-script static analysis tool. Formatter selection must
be dialect-aware; `shfmt` is a candidate only after its supported dialects and
project invocation are confirmed.

## Candidate scope

- Candidate extensions: `.sh`, `.bash`, `.zsh`, and extensionless executable
  scripts only after a shebang-based classifier is designed.
- Native header: `#` comments after a shebang and any required shell directives.
- Public units: shell has no universal exported-API model. Define functions,
  sourced-library interfaces, command-line entry points, and environment
  contracts with explicit project/user rules before attempting enforcement.

## Implementation decisions to prove

1. Choose supported dialects first. POSIX shell, Bash, Zsh, Fish, and PowerShell
   are not interchangeable and must not share one parser by filename alone.
2. Decide whether only file headers are mechanically enforced in the first
   release; function/API docs require a dialect-aware parser and an explicit
   definition of publicness.
3. Verify formatter stdin behavior and `ShellCheck` options from each dialect's
   authoritative toolchain before enabling pre-write formatting.

## Repository changes

Add a content-aware shebang classifier before adding extensionless paths to the
guard. Add separate policy keys per approved dialect or an explicit aggregate
policy with documented semantics. Add safe command spawning without a shell,
project configuration discovery, and detailed verifier integration.

## Acceptance fixtures

Cover Bash and POSIX shebangs, extensionless scripts, shellcheck directives,
sourceable libraries, shell functions, unsupported dialect rejection, shfmt
pass/fail, and missing-tool behavior.
