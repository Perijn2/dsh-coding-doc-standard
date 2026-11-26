---
name: coding-doc-standard-ruby
description: >-
  Native comment syntax for the coding documentation standard: leading #
  blocks for file headers, classes, and methods. Load together with
  coding-doc-standard for any task touching .rb files.
---

# Ruby Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Ruby. The file `example.rb` next to this skill is the
golden reference — a complete, working file documented to the standard;
copy its shape when unsure.

## Declaration naming

This profile has no declaration naming check or naming block configured.
Preserve existing project conventions; the formatter never renames declarations.
[Ruby's official introduction](https://www.ruby-lang.org/en/documentation/ruby-from-other-languages/)
and [class/module syntax reference](https://docs.ruby-lang.org/en/master/syntax/modules_and_classes_rdoc.html)
distinguish syntax from style: constants, including class/module names, begin
uppercase; `@status`, `@@status`, and `$status` denote instance, class, and global
variables. Methods may even begin uppercase. Predicate `?` and dangerous-method
`!` suffixes are conventions, not proof of behavior. These sources do not impose
a universal snake_case/UpperCamelCase/ALL_CAPS scheme: casing beyond syntax is
a project-specific choice, so do not treat `StatusBuffer` or `MAX_RETRIES` as
mandatory spellings. See the source survey in
[Declaration naming](../../../docs/naming.md).

## File header — leading `#` block

```rb
# Author: Perijn Huijser
# Summary: Retry a flaky call with a bounded backoff.
#
# Description:
#     Expand the summary briefly, then work an example through the
#     file: how a caller builds the client, what a call returns under
#     each condition, what to do when the budget runs out.
#
# Changelog:
#     2026-08: Added a no-retry budget for callers that only log.
```

The header block sits directly after the shebang, if any; a blank line
ends it.

## Unit documents

Attach a `#` block directly above every class and every method, including
`initialize` and `self.` methods; the first line is the imperative
summary. Name the arguments, what the method returns on each distinct
path, and which exceptions it raises — those are Ruby’s parameters,
returns, and errors.

```rb
# Normalize a status label to lowercase. Returns nil when value is not
# a String. Raises TypeError when strict is true and the label is
# unknown.
def normalize_label(value, strict = false)
  # ...
end
```

- Constants that control behavior carry their own `#` line stating what
  they control and their unit.
- `private` changes nothing here: a private method that does non-obvious
  work still gets a block.

## Examples

State the example in plain `#` comment prose; comment the result after
each call.

```rb
# Turn a title into a URL slug.
#
#     slug("Hello, World!")  # => "hello-world"
def slug(title)
  title.downcase.gsub(/[^a-z0-9]+/, "-")
end
```
