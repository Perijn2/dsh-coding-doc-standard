---
name: coding-doc-standard-python
description: >-
  Native Python syntax for the coding documentation standard: docstring
  skeleton for module headers and public units. Load together with
  coding-doc-standard for any task touching .py or .pyi files.
---

# Python Syntax

Author: Perijn Huijser

The rules live in `coding-doc-standard`; this pack shows only how to write
that skeleton in Python. The file `example.py` next to this skill is the
golden reference — a complete, working module documented to the standard;
copy its shape when unsure.

## Declaration naming

Use [PEP 8 naming conventions](https://peps.python.org/pep-0008/#naming-conventions)
for new declarations; [Enum HOWTO](https://docs.python.org/3/howto/enum.html)
strongly recommends uppercase enum members. These are guide conventions, not
Python syntax requirements or a claim that the whole guide is enforced.

| Kind | Guide convention and example | Actual check/block coverage |
| --- | --- | --- |
| Classes | CapWords (`UpperCamelCase`): `HTTPServerError` | Class declarations |
| Functions and methods | `snake_case`: `read_label` | Function/method declarations, except explicit `@override` or attribute decorators ending in `.override` (including `@typing.override`) |
| Constants and enum members | UPPER_CASE: `MAX_RETRIES`, `READY` | Unchecked; assignments are not inferred to be semantic constants |
| Variables, parameters, modules | snake_case: `request_label` | Unchecked |

PEP 8 permits existing mixedCase APIs and function-style names for callable-style
classes; the checker cannot infer those exceptions or inherited names without
an explicit override marker. Preserve documented dunder names. Casing checks
ignore leading/trailing underscores, but do not authorize reserved names, check
acronym spelling, or inspect references, strings, or comments. Check/block only
reports or rejects naming violations; it never renames declarations.

## File header — module docstring, first statement

```python
"""
Author: Perijn Huijser
Summary: Read request labels and map them to pipeline stages.

Description:
    Expand the summary briefly, then work an example through the module:
    how a caller constructs the inputs, what comes back under each
    condition, what to do when the map misses.

Changelog:
    2026-08: Added strict mode for unknown labels.
"""
```

- The docstring must come before the imports.
- Fields keep the standard order: Author, Summary, Description, Changelog.
  Omit an optional field entirely rather than leaving an empty label.

## Function and class documents

Attach a multiline docstring to every public function and class; its first
line is the imperative summary.

```python
def normalize_label(label: str) -> str:
    """
    Normalize leading, trailing, and case differences in a label.

    Parameters:
        label (in): Raw text supplied by the caller.

    Returns:
        Always the stripped, lowercase form of label; empty input comes
        back empty. This function never raises.

    Notes:
        Does not validate the result.
    """
    return label.strip().lower()
```

- The `(in)` / `(out)` / `(in-out)` marker follows the parameter name.
- The Returns prose must cover every distinct case, including the
  no-error claim when the function cannot fail.
- Leave one blank docstring line between sections; never use a one-line
  docstring for a public unit.

## Examples

Use an `Example:` section with doctest prompts (`>>>`) for functions — the
output lines are part of the documentation. Show real output, one comment
line above an example whose case is not obvious, and a blank docstring line
between separate examples.

## Other public kinds

- **Class**: a docstring on the class body saying what it represents and how
  instances are obtained; every public method follows the function rules.
- **Enum**: a docstring on the class for the choice itself, then one trailing
  comment per variant stating what the caller does on it.
- **Constant**: a `#:` comment directly above the assignment with its meaning,
  unit, and range.
- **Entry point**: the `if __name__ == "__main__":` block gets a comment
  stating the invocation, inputs read, output printed, and exit behavior.

```python
class Budget(Enum):
    """
    Pick how many attempts one call may spend.

    Chosen by caller patience, never by the callee.
    """

    ONCE = 1  # No retries: callers that only log the outcome.
    FAST = 3  # Two retries: interactive callers waiting on the result.

#: Seconds to wait between attempts; range 1..10 s.
ATTEMPT_INTERVAL_SECONDS = 5.0
```
