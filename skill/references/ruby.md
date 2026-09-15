# Ruby Documentation Rules

Author: Perijn Huijser

## Experimental, opt-in profile

This profile is disabled by default. It checks only a conservative leading
house header for `.rb` files. It has no YARD semantic validation, public-method
parser, formatter, or detailed verifier yet.

## Supported header shape

Place consecutive `#` comment lines after an optional first-line shebang. The
header must contain `Author:`, `Summary:`, and `Usage:`. These are this
package's house fields, not a claim that they are native YARD tags.

Ruby magic comments (`coding`, `frozen_string_literal`, and `typed`),
extensionless Gemfile/Rakefile files, `.ru`, `.rake`, framework DSL files,
`__END__`, generated-file markers, and other directives are unsupported in this
version. The profile fails when enabled instead of attaching a header past an
ambiguous preamble.

## Native Ruby guidance

YARD is a Ruby documentation system, but visibility and public API are not
safe to infer with regular expressions: classes can reopen, methods can be
singleton methods, and DSLs can define callable interfaces dynamically.

## Current limits

Do not infer that this profile runs Bundler, RuboCop, StandardRB, YARD, or Ruby
tests. Project roots, tool versions, and documentation-coverage policy must be
proved for the target project first.