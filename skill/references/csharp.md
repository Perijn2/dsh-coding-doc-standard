# C# Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It currently checks only a conservative
leading `///` documentation header for `.cs` files. It has no XML-documentation
semantic validation, public-member parser, formatter, or detailed verifier yet.

## Supported header shape

Start the file with consecutive `///` lines after an optional BOM and whitespace.
The header must contain the shared house fields `@author` and `Usage:`. Keep its
claims evidence-based; these labels are this package's structural policy, not a
claim that they are native C# XML documentation elements.

The first version does not skip directives, attributes, generated-file markers,
or other code before the header. A file with such a preamble fails when this
opt-in profile is enabled rather than attaching documentation to the wrong
construct.

## Native C# guidance

C# XML documentation uses `///` comments directly before types and members and
normally uses XML such as `<summary>`. Public-member coverage, XML tag
completeness, and compiler warning configuration need a Roslyn/compiler-backed
implementation before this package can enforce them.

## Current limits

Do not infer that this profile runs `dotnet format`, `dotnet build`, or XML
documentation generation. Those commands require a discovered project or
solution and project-specific policy.