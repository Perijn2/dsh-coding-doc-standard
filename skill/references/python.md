# Python Documentation Rules

Author: Perijn Huijser

Load this reference only for Python after applying `SKILL.md`.

## Header and public-unit rules

Use a multiline module docstring as the first statement in each supported Python
module. Use the shared `Author:`, `Summary:`, `Usage:`, and optional `Notes:`
fields. Usage is a file-specific guide, not a mandatory subsection template:
include only useful, code-derived guidance about setup, workflow, capabilities,
limitations, result/error handling, and complete examples when they apply. Do
not add an `Includes:` list.

Use a multiline triple-quoted docstring as the first statement in every public
top-level function and class body. Follow PEP 257: begin with a one-sentence
summary ending in a period, then leave one blank docstring line before behavior
or each populated labeled section. Python has no mandatory native equivalents of
`Args:`, `Returns:`, or `Raises:`; add clear labeled prose only when those facts
are known and useful rather than copying another language's template.

The write guard blocks a Python module that lacks `Author:`, `Summary:`, or
`Usage:`, and blocks public top-level classes or functions without a docstring.
It cannot prove that a description is true, so review behavior and tests before
approving it.

## Documentation-shape example

This is a syntax illustration. Its statements describe the sample code only;
replace every claim with facts established by the module you document.

```python
"""Author: Perijn Huijser
Summary: Normalizes labels for case-insensitive comparison.

Usage:
    Getting started: Import normalize_label before reading a label from a
        request, file, or command-line argument. The function needs no
        configuration or lifecycle.

    Using the result: Normalize the raw text, retain the returned string for
        lookup or comparison, and keep the original value for diagnostics. The
        function returns new stripped, lowercase text and does not validate it.

    Boundaries and failures: This function has no error channel. Callers decide
        whether an empty normalized value is acceptable and how an unknown key
        should be reported.

    Complete workflow: Normalize a lookup key, handle a missing entry, and
        preserve the original input for the diagnostic message.
        raw_label = "  Ready "
        labels = {"ready": "enabled"}
        normalized = normalize_label(raw_label)
        state = labels.get(normalized)
        if state is None:
            raise LookupError(f"Unknown label: {raw_label!r}")
"""


def normalize_label(label: str) -> str:
    """Normalize leading, trailing, and case differences in a label.

    Parameters:
        label: Text supplied by the caller.

    Returns:
        The stripped, lowercase form of label.
    """

    return label.strip().lower()
```

## Layout and review

Never use a one-line required docstring. Use exactly one blank docstring line
between the Summary and each populated section, keep section entries together,
and indent wrapped prose and examples consistently. Missing module or public
unit documentation is a blocker; a one-line required docstring or missing
summary/detail separation is a minor layout defect.

## Formatter and verifier

The pre-write guard uses the DSH-provisioned **Ruff 0.16.6** formatter and fails
closed when it is missing (unless the user changes that policy). Provision it
with `npm run provision-tools`. The provisioned binary is located at:

- Windows: `~/.dsh/plugins/coding-doc-standard/tools/ruff-0.16.6/bin/ruff.exe`
- Linux/macOS: `~/.dsh/plugins/coding-doc-standard/tools/ruff-0.16.6/bin/ruff`

Run the same pinned executable for manual formatting and verification; do not
silently substitute a host-wide Ruff of another version.

```text
# Windows PowerShell
& "$HOME\.dsh\plugins\coding-doc-standard\tools\ruff-0.16.6\bin\ruff.exe" format path/to/module.py
& "$HOME\.dsh\plugins\coding-doc-standard\tools\ruff-0.16.6\bin\ruff.exe" format --check path/to/module.py
& "$HOME\.dsh\plugins\coding-doc-standard\tools\ruff-0.16.6\bin\ruff.exe" check path/to/module.py

# Linux/macOS
"$HOME/.dsh/plugins/coding-doc-standard/tools/ruff-0.16.6/bin/ruff" format path/to/module.py
"$HOME/.dsh/plugins/coding-doc-standard/tools/ruff-0.16.6/bin/ruff" format --check path/to/module.py
"$HOME/.dsh/plugins/coding-doc-standard/tools/ruff-0.16.6/bin/ruff" check path/to/module.py
```

For project-aware detailed verification, run the formatter check and lint check
on every changed Python file. Resolve missing facts with the author before
writing documentation; formatters validate layout, not semantic truth.
