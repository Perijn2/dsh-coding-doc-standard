# C# Profile Plan

Author: Perijn Huijser

## Evidence

Microsoft documents [XML documentation comments](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/)
as `///` comment fields for code blocks. Microsoft also documents
[`dotnet format`](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-format)
as a formatter that applies style preferences and analyzer recommendations to a
project or solution.

## Candidate scope

- Candidate extensions: `.cs`; decide separately whether generated `.g.cs` and
  designer files are exempt based on markers and project conventions.
- Native header: consecutive `///` XML comments or a documented file-header
  convention agreed by the target project.
- Public units: public/protected types and members, with C# accessibility,
  partial types, explicit interface implementations, and records considered by a
  Roslyn-backed parser or compiler analysis.

## Implementation decisions to prove

1. Determine whether XML docs are required only for public APIs or also for
   internal project file headers; Microsoft documents API comments, not this
   package's shared header shape.
2. Treat `dotnet format` as project-aware until stdin/check-only behavior,
   solution discovery, SDK versions, and analyzer configuration are proven.
3. Decide whether compiler documentation warnings (for example project-selected
   XML-doc warnings) are an opt-in detailed verifier; do not invent warning IDs.

## Repository changes

Add C# policy/settings fields, `.cs` routing and XML-header extraction, and a
Roslyn strategy before attempting public-member enforcement. Add detailed
verification that accepts a project or solution context instead of invoking a
solution-wide formatter for each path. Update toolchain docs only after the SDK
support policy is decided.

## Acceptance fixtures

Test a compliant XML header, missing `summary`, XML escaping, generated-file
exclusion, a documented public member, an undocumented public member, a project
with `dotnet format` available, and missing-SDK optional behavior.
