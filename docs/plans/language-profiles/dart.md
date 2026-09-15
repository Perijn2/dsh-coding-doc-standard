# Dart Profile Plan

Author: Perijn Huijser

## Evidence

Dart's [Effective Dart documentation guidance](https://dart.dev/effective-dart/documentation)
defines `///` as the doc-comment syntax consumed by `dart doc`. The official
[`dart format`](https://dart.dev/tools/dart-format) and
[`dart analyze`](https://dart.dev/tools/dart-analyze) command documentation
covers formatting and static analysis.

## Candidate scope

- Candidate extension: `.dart`; decide whether generated `.g.dart` and Flutter
  tool output are exempt using project markers.
- Native header: `///` docs before library or declaration; determine whether a
  package-wide header belongs in library files only.
- Public units: public libraries, classes, mixins, extensions, enums, methods,
  functions, fields, and constructors, interpreted through a Dart analyzer API
  if automated public-unit enforcement is required.

## Implementation decisions to prove

1. Verify whether `dart format` offers a stable non-mutating pending-content
   comparison path; otherwise use it in detailed verification only.
2. Define project-root discovery through `pubspec.yaml`, including Flutter
   projects and generated outputs.
3. Decide whether `dart doc` must run as documentation verification or whether
   analyzer/formatter checks are the first milestone.

## Repository changes

Add Dart defaults/settings/router/header extraction and analyzer-backed API
coverage. Add `dart format` / `dart analyze` detailed commands after project
root handling is tested. Add formatter provisioning only if SDK management and
host support are explicitly in scope.

## Acceptance fixtures

Include doc comments on public/private declarations, library directives,
generated-file markers, a Dart package root, a Flutter package decision, format
pass/fail, and missing-SDK optional behavior.
