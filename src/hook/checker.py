#!/usr/bin/env python3
"""
Author: Perijn Huijser
Summary: Validates pending source and Docker Compose content against documentation policy.

Usage:
    Core principle: Keep documentation validation deterministic and independent of
        the editor by analyzing candidate text before a write reaches disk.
    Setup: Invoke this module with a target path and pipe candidate UTF-8 content
        through standard input when using the --stdin option.
    Workflow: Load policy, classify the path, collect documentation violations,
        print actionable diagnostics, and exit with a blocking status when needed.
    API guide: Use check_content from adapters that need structured violations;
        use main from command-line hooks.
    Worked example: printf '%s' "$content" | python3 checker.py compose.yaml --stdin
"""

from __future__ import annotations

import argparse
import ast
import fnmatch
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SOURCE_EXTENSIONS = {
    ".py",
    ".ts",
    ".js",
    ".mjs",
    ".cjs",
    ".rs",
    ".c",
    ".h",
    ".cc",
    ".cpp",
    ".hpp",
    ".go",
    ".cs",
    ".java",
    ".kt",
    ".sh",
    ".bash",
}
COMPOSE_DEFAULTS = (
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
    "compose.*.yaml",
    "compose.*.yml",
)


@dataclass(frozen=True)
class Violation:
    """Summary: Represents one actionable documentation-policy failure.

    Parameters:
        path: Candidate path associated with the failure.
        line: One-based source line where the failure is reported.
        message: Human-readable explanation of the required correction.
    """

    path: str
    line: int
    message: str


def _policy_path() -> Path:
    """Summary: Returns the package-local canonical policy path.

    Returns:
        Absolute path to the bundled policy defaults.
    """

    return Path(__file__).resolve().parents[1] / "policy" / "defaults.json"


def _load_policy(path: str | None) -> dict:
    """Summary: Loads canonical defaults merged with an optional user policy.

    Parameters:
        path: Optional JSON policy file supplied by the host plugin.

    Returns:
        Effective policy dictionary.
    """

    defaults = json.loads(_policy_path().read_text(encoding="utf-8"))
    if not path:
        return defaults
    try:
        override = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return defaults
    if not isinstance(override, dict):
        return defaults
    defaults.update(
        {key: value for key, value in override.items() if key != "languages"}
    )
    if isinstance(override.get("languages"), dict):
        defaults["languages"].update(override["languages"])
    return defaults


def _is_compose(path: str, policy: dict) -> bool:
    """Summary: Determines whether a YAML path is a Docker Compose document.

    Parameters:
        path: Candidate path.
        policy: Effective policy dictionary.

    Returns:
        True when the basename matches a configured Compose pattern.
    """

    basename = Path(path).name.lower()
    patterns = policy.get("composePatterns", COMPOSE_DEFAULTS)
    return any(fnmatch.fnmatchcase(basename, pattern.lower()) for pattern in patterns)


def _leading_comment_text(text: str) -> str:
    """Summary: Extracts the opening YAML comment header from candidate text.

    Parameters:
        text: Complete candidate document.

    Returns:
        Normalized opening comment lines joined with newlines.
    """

    lines: list[str] = []
    for raw in text.splitlines():
        if not raw.strip() and not lines:
            continue
        if raw.lstrip().startswith("#"):
            lines.append(raw.lstrip()[1:].strip())
            continue
        if not raw.strip() and lines:
            lines.append("")
            continue
        break
    return "\n".join(lines)


def _require_labels(path: str, text: str, labels: Iterable[str]) -> list[Violation]:
    """Summary: Reports absent documentation labels in a normalized comment block.

    Parameters:
        path: Candidate path.
        text: Documentation block to inspect.
        labels: Case-insensitive labels required by policy.

    Returns:
        Violations for each missing label.
    """

    lowered = text.lower()
    return [
        Violation(path, 1, f"Missing '{label}' in file header")
        for label in labels
        if label.lower() not in lowered
    ]


def _check_compose(path: str, text: str) -> list[Violation]:
    """Summary: Validates root and service documentation in a Compose document.

    Parameters:
        path: Candidate Compose path.
        text: Complete candidate YAML content.

    Returns:
        Compose-specific documentation violations.
    """

    violations = _require_labels(
        path,
        _leading_comment_text(text),
        (
            "Author:",
            "Summary:",
            "Usage:",
            "Core principle:",
            "Setup:",
            "Workflow:",
            "API guide:",
            "Worked example:",
        ),
    )
    services_match = re.search(r"(?m)^services:\s*$", text)
    if not services_match:
        return violations + [Violation(path, 1, "Missing top-level 'services' mapping")]
    services_tail = text[services_match.end() :]
    service_pattern = re.compile(r"(?m)^( {2})([A-Za-z0-9][A-Za-z0-9_.-]*):\s*$")
    for match in service_pattern.finditer(services_tail):
        preceding = services_tail[max(0, match.start() - 600) : match.start()]
        comments = "\n".join(
            line.strip()[1:].strip()
            for line in preceding.splitlines()[-8:]
            if line.strip().startswith("#")
        )
        if "summary:" not in comments.lower():
            line = text[: services_match.end() + match.start()].count("\n") + 1
            violations.append(
                Violation(
                    path,
                    line,
                    f"Missing Summary comment for service '{match.group(2)}'",
                )
            )
    return violations


def _go_source_header(text: str) -> str:
    """Summary: Extracts a supported Go package documentation header.

    Parameters:
        text: Complete candidate Go source content.

    Returns:
        Consecutive package documentation lines, or an empty string.
    """

    lines = text.removeprefix("\ufeff").splitlines()
    index = 0
    if index < len(lines) and (
        lines[index].startswith("//go:build") or lines[index].startswith("// +build")
    ):
        while index < len(lines) and lines[index].startswith("//"):
            index += 1
        if index >= len(lines) or lines[index].strip():
            return ""
        while index < len(lines) and not lines[index].strip():
            index += 1
    header: list[str] = []
    while index < len(lines) and lines[index].startswith("//"):
        header.append(lines[index][2:].lstrip())
        index += 1
    if (
        not header
        or index >= len(lines)
        or not re.match(r"package\s+\w+", lines[index])
    ):
        return ""
    return "\n".join(header)


def _source_header(path: str, text: str) -> str:
    """Summary: Extracts a language-native leading documentation header.

    Parameters:
        path: Candidate source path.
        text: Complete candidate source content.

    Returns:
        Leading header text, or an empty string when none is found.
    """

    suffix = Path(path).suffix.lower()
    if suffix == ".go":
        return _go_source_header(text)
    if suffix == ".py":
        match = re.match(
            r"(?:\ufeff)?(?:#![^\n]*\n)?(?:[ \t]*#.*coding[:=][ \t]*[-\w.]+[^\n]*\n)?\s*(?:[rubfRUBF]{0,2})?(?:'''|\"\"\")(.*?)(?:'''|\"\"\")",
            text,
            re.S,
        )
    elif suffix in {
        ".ts",
        ".js",
        ".mjs",
        ".cjs",
        ".c",
        ".h",
        ".cc",
        ".cpp",
        ".hpp",
        ".java",
        ".kt",
    }:
        match = re.match(r"(?:\ufeff)?(?:#![^\n]*\n)?\s*/\*\*(.*?)\*/", text, re.S)
    elif suffix == ".cs":
        match = re.match(r"(?:\ufeff)?\s*((?:///.*\n?)+)", text)
    elif suffix in {".sh", ".bash"}:
        match = re.match(r"(?:\ufeff)?(?:#![^\n]*\n)?\s*((?:#[^!].*\n?)+)", text)
    elif suffix == ".rs":
        match = re.match(r"\s*((?://!.*\n?)+)", text)
    else:
        match = None
    return match.group(1) if match else ""


def _check_python_public_units(path: str, text: str) -> list[Violation]:
    """Summary: Checks docstrings on public top-level Python declarations.

    Parameters:
        path: Candidate Python path.
        text: Complete candidate source content.

    Returns:
        Violations for undocumented public declarations.
    """

    try:
        module = ast.parse(text)
    except SyntaxError as error:
        return [Violation(path, error.lineno or 1, f"Python syntax error: {error.msg}")]
    violations: list[Violation] = []
    for node in module.body:
        if isinstance(
            node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
        ) and not node.name.startswith("_"):
            doc = ast.get_docstring(node, clean=False)
            if not doc:
                violations.append(
                    Violation(
                        path,
                        node.lineno,
                        f"Missing unit doc for public unit '{node.name}'",
                    )
                )
    return violations


def check_content(path: str, text: str, policy: dict | None = None) -> list[Violation]:
    """Summary: Checks candidate content against the enabled documentation profiles.

    Parameters:
        path: Candidate file path retained for language classification.
        text: Proposed complete file content.
        policy: Optional effective policy; defaults load when omitted.

    Returns:
        Ordered list of blocking documentation violations.
    """

    effective = policy or _load_policy(None)
    if not effective.get("enabled", True):
        return []
    if _is_compose(path, effective):
        return (
            _check_compose(path, text)
            if effective["languages"].get("dockerCompose", True)
            else []
        )
    suffix = Path(path).suffix.lower()
    if suffix not in SOURCE_EXTENSIONS:
        return []
    family = {
        ".py": "python",
        ".rs": "rust",
        ".ts": "typescriptJavascript",
        ".js": "typescriptJavascript",
        ".mjs": "typescriptJavascript",
        ".cjs": "typescriptJavascript",
        ".go": "go",
        ".cs": "csharp",
        ".java": "java",
        ".kt": "kotlin",
        ".sh": "shell",
        ".bash": "shell",
    }.get(suffix, "cCpp")
    if not effective["languages"].get(family, True):
        return []
    header = _source_header(path, text)
    if family in {"python", "go", "shell"}:
        violations = _require_labels(path, header, ("Author:", "Summary:", "Usage:"))
    elif family in {"typescriptJavascript", "cCpp", "csharp", "java", "kotlin"}:
        violations = _require_labels(path, header, ("@author", "Usage:"))
    else:
        violations = _require_labels(path, header, ("Author", "Usage"))
    if suffix == ".py":
        violations.extend(_check_python_public_units(path, text))
    return violations


def main() -> int:
    """Summary: Runs the checker command-line interface.

    Returns:
        Process status: zero when compliant and two when policy violations exist.
    """

    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--policy")
    parser.add_argument("--stdin", action="store_true")
    args = parser.parse_args()
    try:
        text = (
            sys.stdin.read()
            if args.stdin
            else Path(args.path).read_text(encoding="utf-8")
        )
    except OSError as error:
        print(f"[doc-standard] Cannot read candidate: {error}", file=sys.stderr)
        return 1
    violations = check_content(args.path, text, _load_policy(args.policy))
    for violation in violations:
        print(
            f"{violation.path}:{violation.line} [doc-standard] {violation.message}",
            file=sys.stderr,
        )
    return 2 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main())
