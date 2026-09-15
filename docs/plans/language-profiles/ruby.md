# Ruby Profile Plan

Author: Perijn Huijser

## Evidence

[YARD](https://yardoc.org/) is a Ruby documentation generation tool for
consistent API documentation. [RuboCop's documentation](https://docs.rubocop.org/rubocop/latest/development.html)
shows its ecosystem uses YARD documentation and validates example syntax in its
own documentation workflow.

## Candidate scope

- Candidate extensions: `.rb`; decide whether Rakefiles, Gemfiles, and DSL
  files are in scope separately because they do not use normal extensions.
- Native header: consecutive `#` comments with the shared fields before code,
  respecting Ruby magic comments and shebang placement.
- Public units: public methods, classes, modules, constants, singleton methods,
  and visibility changes. Require a Ruby parser/AST plus visibility tracking;
  `def` alone is not a public-API decision.

## Implementation decisions to prove

1. Decide whether YARD tags are mandatory or advisory for the profile and
   document the required tag set from target projects.
2. Treat RuboCop as project-aware until configuration inheritance, Bundler
   execution, and formatter/check-only behavior are demonstrated.
3. Define a safe preamble parser for shebang, frozen-string-literal, encoding,
   and typed-Ruby magic comments before enforcing a file header.

## Repository changes

Add Ruby policy/settings/routing, leading-comment extraction that preserves
magic comments, parser-backed public-item enforcement, and a Bundler-aware
detailed verifier. Add a formatter toggle only when stdin/check behavior is
proven.

## Acceptance fixtures

Test shebang and magic comments, module/class docs, visibility changes,
`private` methods, YARD examples, a Gemfile decision, and Bundler/RuboCop
missing-tool behavior.
