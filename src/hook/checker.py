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
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SOURCE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
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
    ".kts",
    ".sh",
    ".bash",
    ".php",
    ".rb",
    ".swift",
    ".dart",
    ".hs",
    ".lua",
    ".scala",
}
COMPOSE_DEFAULTS = (
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
    "compose.*.yaml",
    "compose.*.yml",
)
PLACEHOLDER_AUTHORS = {
    "",
    "todo",
    "tbd",
    "fixme",
    "unknown",
    "n/a",
    "none",
    "agent",
    "ai",
    "assistant",
    "claude",
    "copilot",
    "you",
    "name",
    "your",
    "placeholder",
}


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


def _inline_policy() -> dict | None:
    """Summary: Reads the live policy the host passes through the environment.

    Returns:
        Parsed policy dictionary, or None when the host sent nothing usable.
    """

    raw = os.environ.get("CODING_DOC_STANDARD_POLICY_JSON", "").strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _file_policy(path: str | None) -> dict | None:
    """Summary: Reads a user policy document from disk.

    Parameters:
        path: Optional JSON policy file supplied by the host plugin.

    Returns:
        Parsed policy dictionary, or None when absent or unreadable.
    """

    if not path:
        return None
    try:
        parsed = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _load_policy(path: str | None) -> dict:
    """Summary: Loads canonical defaults merged with the effective user policy.

    The host hands over the policy it is enforcing right now through the
    environment, so a durable write that failed or was interrupted cannot leave
    the checker judging a candidate against a stale rule set. The file path
    stays the fallback for standalone runs.

    Parameters:
        path: Optional JSON policy file supplied by the host plugin.

    Returns:
        Effective policy dictionary.
    """

    defaults = json.loads(_policy_path().read_text(encoding="utf-8"))
    override = _inline_policy()
    if override is None:
        override = _file_policy(path)
    if override is None:
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


def _require_labels(path: str, text: str, labels: Iterable[str | tuple[str, ...]]) -> list[Violation]:
    """Summary: Reports absent documentation labels in a normalized comment block.

    Each label is either one string or a tuple of accepted spellings; any one
    spelling satisfies the label, so `("@author", "Author:")` accepts both the
    tag and the prose form across language families.

    Parameters:
        path: Candidate path.
        text: Documentation block to inspect.
        labels: Case-insensitive labels or spelling groups required by policy.

    Returns:
        Violations for each missing label.
    """

    lowered = text.lower()
    violations: list[Violation] = []
    for label in labels:
        spellings = label if isinstance(label, tuple) else (label,)
        if not any(spelling.lower() in lowered for spelling in spellings):
            violations.append(
                Violation(path, 1, f"Missing '{spellings[0]}' in file header")
            )
    return violations


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
        ("Author:", "Summary:", "Usage:"),
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


def _haskell_source_header(text: str) -> str:
    """Summary: Extracts a supported Haskell module documentation header.

    Parameters:
        text: Complete candidate Haskell source content.

    Returns:
        Module documentation lines, or an empty string when none is found.
    """

    lines = text.removeprefix("\ufeff").splitlines()
    index = 0
    while index < len(lines) and re.fullmatch(r"\{\-# LANGUAGE .+ #\-\}", lines[index]):
        index += 1
        while index < len(lines) and not lines[index].strip():
            index += 1
    if index >= len(lines) or not lines[index].startswith("-- |"):
        return ""
    header: list[str] = []
    while index < len(lines) and lines[index].startswith("--"):
        header.append(lines[index][2:].lstrip(" |"))
        index += 1
    if (
        not header
        or index >= len(lines)
        or not re.match(r"module\s+[A-Z][\w.']*\s+where\b", lines[index])
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
    if suffix == ".hs":
        return _haskell_source_header(text)
    if suffix == ".py":
        match = re.match(
            r"(?:\ufeff)?(?:#![^\n]*\n)?(?:[ \t]*#.*coding[:=][ \t]*[-\w.]+[^\n]*\n)?\s*(?:[rubfRUBF]{0,2})?(?:'''|\"\"\")(.*?)(?:'''|\"\"\")",
            text,
            re.S,
        )
    elif suffix in {".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"}:
        match = re.match(r"(?:\ufeff)?(?:#![^\n]*\n)?\s*/\*\*(.*?)\*/", text, re.S)
    elif suffix in {".c", ".h", ".cc", ".cpp", ".hpp", ".java", ".kt", ".kts", ".scala"}:
        match = re.match(r"(?:\ufeff)?\s*/\*\*(.*?)\*/", text, re.S)
    elif suffix == ".php":
        match = re.match(
            r"(?:\ufeff)?[ \t]*<\?php[ \t]*(?:\r?\n)?\s*/\*\*(.*?)\*/", text, re.S
        )
    elif suffix in {".cs", ".swift", ".dart"}:
        match = re.match(
            r"(?:\ufeff)?\s*((?:///[^\n]*\n?)+|/\*\*[\s\S]*?\*/)",
            text,
        )
    elif suffix in {".sh", ".bash"}:
        match = re.match(r"(?:\ufeff)?(?:#![^\n]*\n)?\s*((?:#[^!].*\n?)+)", text)
    elif suffix == ".rb":
        match = re.match(
            r"(?:\ufeff)?(?:#![^\n]*\n)?(?!\s*#.*(?:coding|encoding|frozen_string_literal|typed))\s*((?:#[^!].*\n?)+)",
            text,
            re.I,
        )
    elif suffix == ".lua":
        match = re.match(r"(?:\ufeff)?\s*((?:---.*\n?)+)", text)
    elif suffix == ".rs":
        match = re.match(r"\s*((?://!.*\n?)+)", text)
    else:
        match = None
    return match.group(1) if match else ""


def _comment_lines(block: str) -> list[str]:
    """Summary: Normalizes lines from a native documentation block."""
    return [line.strip().lstrip("*").strip() for line in block.splitlines()]


def _label_has_value(block: str, label: str) -> bool:
    """Summary: Tests whether a documentation label has non-empty content."""
    return any(
        line.lower().startswith(label.lower()) and line[len(label) :].strip()
        for line in _comment_lines(block)
    )


def _check_cpp_public_units(path: str, text: str) -> list[Violation]:
    """Summary: Checks documented externally visible C and C++ functions."""
    declaration = re.compile(
        r"(?mx)^\s*(?!static\b)"
        r"(?P<return>(?:extern\s+)?(?:[A-Za-z_]\w*(?:::\w+)?|struct\s+\w+|"
        r"enum\s+\w+|class\s+\w+|const|volatile|restrict|unsigned|signed|"
        r"short|long|[*&])+[\t ]+)"
        r"(?P<name>[A-Za-z_]\w*)\s*\((?P<params>[^(){};]*)\)"
        r"\s*(?:const\s*)?(?:;|\{)"
    )
    blocks = list(re.finditer(r"/\*\*(.*?)\*/", text, re.S))
    violations: list[Violation] = []
    for match in declaration.finditer(text):
        if any(block.start() <= match.start() < block.end() for block in blocks):
            continue
        line = text[: match.start()].count("\n") + 1
        preceding = [block for block in blocks if block.end() <= match.start()]
        last = preceding[-1] if preceding else None
        if last is None or text[last.end() : match.start()].strip():
            violations.append(
                Violation(
                    path,
                    line,
                    f"Missing Doxygen documentation for public function '{match.group('name')}'",
                )
            )
            continue
        doc = last.group(1)
        if not _label_has_value(doc, "@brief"):
            violations.append(
                Violation(
                    path,
                    line,
                    f"Missing '@brief' for public function '{match.group('name')}'",
                )
            )
        for raw in match.group("params").split(","):
            item = raw.strip().split("=", 1)[0].strip()
            if not item or item in {"void", "..."}:
                continue
            names = re.findall(r"[A-Za-z_]\w*", item)
            if not names:
                continue
            name = names[-1]
            tags = re.findall(rf"@param(?:\[([^\]]+)\])?\s+{re.escape(name)}\b", doc)
            if not tags:
                violations.append(
                    Violation(
                        path,
                        line,
                        f"Missing '@param' documentation for parameter '{name}' in '{match.group('name')}'",
                    )
                )
            elif len(tags) != 1 or tags[0] not in {"in", "out", "in,out"}:
                violations.append(
                    Violation(
                        path,
                        line,
                        f"Parameter '{name}' in '{match.group('name')}' must have exactly one @param direction",
                    )
                )
        return_type = re.sub(
            r"\b(?:extern|const|volatile|restrict)\b",
            "",
            match.group("return"),
        ).strip()
        if return_type != "void" and not re.search(r"@(return|retval)\b", doc):
            violations.append(
                Violation(
                    path,
                    line,
                    f"Missing '@return' or '@retval' for public function '{match.group('name')}'",
                )
            )
    return violations


def _check_cpp_named_declarations(path: str, text: str) -> list[Violation]:
    """Summary: Checks documented C/C++ records, enums, and aliases."""
    pattern = re.compile(
        r"(?m)^\s*(?!static\b)(?:(?:struct|class|enum|union|typedef)\s+"
        r"(?P<name>[A-Za-z_]\w*)|extern\s+[^;()]+\s+(?P<variable>[A-Za-z_]\w*))"
        r"\s*(?:\{|;|=)"
    )
    blocks = list(re.finditer(r"/\*\*(.*?)\*/", text, re.S))
    violations: list[Violation] = []
    for match in pattern.finditer(text):
        if any(block.start() <= match.start() < block.end() for block in blocks):
            continue
        line = text[: match.start()].count("\n") + 1
        preceding = [block for block in blocks if block.end() <= match.start()]
        last = preceding[-1] if preceding else None
        name = match.group("name") or match.group("variable")
        if last is None or text[last.end() : match.start()].strip():
            violations.append(
                Violation(
                    path,
                    line,
                    f"Missing Doxygen documentation for public declaration '{name}'",
                )
            )
        elif not _label_has_value(last.group(1), "@brief"):
            violations.append(
                Violation(
                    path, line, f"Missing '@brief' for public declaration '{name}'"
                )
            )
    return violations


def _check_rust_public_units(path: str, text: str) -> list[Violation]:
    """Summary: Checks documentation attached to public Rust items."""
    pattern = re.compile(
        r"\bpub\s+(?P<unsafe>unsafe\s+)?(?:async\s+)?"
        r"(?:fn|struct|enum|trait|const|type)\s+(?P<name>\w+)"
    )
    violations: list[Violation] = []
    for match in pattern.finditer(text):
        line = text[: match.start()].count("\n") + 1
        preceding = text[: match.start()].splitlines()
        docs: list[str] = []
        for raw in reversed(preceding):
            if raw.strip().startswith("///"):
                docs.append(raw.strip()[3:].strip())
            elif raw.strip():
                break
        if not docs:
            violations.append(
                Violation(
                    path,
                    line,
                    f"Missing unit doc for public unit '{match.group('name')}'",
                )
            )
        elif match.group("unsafe") and not any(
            item.lower() == "# safety" for item in docs
        ):
            violations.append(
                Violation(
                    path,
                    line,
                    f"Missing '# Safety' section for public unsafe item '{match.group('name')}'",
                )
            )
    return violations


def _check_python_doc_shape(
    path: str, line: int, doc: str, subject: str
) -> list[Violation]:
    """Summary: Checks PEP 257 summary and section spacing."""
    lines = doc.splitlines()
    violations: list[Violation] = []
    if lines and not lines[0].strip().endswith("."):
        violations.append(
            Violation(path, line, f"Summary for {subject} must end with a period")
        )
    if len(lines) > 1 and lines[1].strip():
        violations.append(
            Violation(
                path,
                line,
                f"Summary for {subject} needs a blank line before details",
            )
        )
    return violations


def _check_python_public_units(path: str, text: str) -> list[Violation]:
    """Summary: Checks public top-level Python declarations and known contracts.

    Parameters:
        path: Candidate Python path.
        text: Complete candidate source content.

    Returns:
        Violations for undocumented declarations or known signature sections.
    """

    try:
        module = ast.parse(text)
    except SyntaxError as error:
        return [Violation(path, error.lineno or 1, f"Python syntax error: {error.msg}")]
    violations: list[Violation] = []
    for node in ast.walk(module):
        if not isinstance(
            node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
        ) or node.name.startswith("_"):
            continue
        doc = ast.get_docstring(node, clean=False)
        if not doc:
            violations.append(
                Violation(
                    path,
                    node.lineno,
                    f"Missing unit doc for public unit '{node.name}'",
                )
            )
            continue
        violations.extend(
            _check_python_doc_shape(
                path, node.lineno, doc, f"public unit '{node.name}'"
            )
        )
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            parameters = [
                argument.arg
                for argument in [
                    *node.args.posonlyargs,
                    *node.args.args,
                    *node.args.kwonlyargs,
                ]
                if argument.arg not in {"self", "cls"}
            ]
            if node.args.vararg and node.args.vararg.arg not in {"self", "cls"}:
                parameters.append(node.args.vararg.arg)
            if node.args.kwarg and node.args.kwarg.arg not in {"self", "cls"}:
                parameters.append(node.args.kwarg.arg)
            if parameters and "parameters:" not in doc.lower():
                violations.append(
                    Violation(
                        path,
                        node.lineno,
                        f"Missing Parameters section for public unit '{node.name}'",
                    )
                )
            if node.returns is not None and "returns:" not in doc.lower():
                violations.append(
                    Violation(
                        path,
                        node.lineno,
                        f"Missing Returns section for public unit '{node.name}'",
                    )
                )
    return violations


def _check_cpp_documentation(path: str, text: str) -> list[Violation]:
    """Summary: Validates C/C++ documentation contracts."""
    header = _source_header(path, text)
    required = ("@file", "@author", "@brief")
    violations = _require_labels(path, header, required)
    if "usage:" not in header.lower() and "@par usage" not in header.lower():
        violations.append(Violation(path, 1, "Missing 'Usage' in file header"))
    basename = Path(path).name
    pattern = rf"(?m)^\s*\*?\s*@file\s+{re.escape(basename)}\s*$"
    if not re.search(pattern, header):
        violations.append(
            Violation(path, 1, f"Missing exact '@file {basename}' in file header")
        )
    if not (
        _label_has_value(header, "@author") or _label_has_value(header, "Author:")
    ):
        violations.append(Violation(path, 1, "Missing '@author' value in file header"))
    if not _label_has_value(header, "@brief"):
        violations.append(
            Violation(path, 1, "Missing non-empty '@brief' in file header")
        )
    violations.extend(_check_cpp_public_units(path, text))
    violations.extend(_check_cpp_named_declarations(path, text))
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
    source_name = Path(path).name.lower()
    suffix = Path(path).suffix.lower()
    if suffix == ".dart" and source_name.endswith(".g.dart"):
        return []
    if suffix not in SOURCE_EXTENSIONS:
        return []
    family = {
        ".py": "python",
        ".rs": "rust",
        ".ts": "typescriptJavascript",
        ".tsx": "typescriptJavascript",
        ".mts": "typescriptJavascript",
        ".cts": "typescriptJavascript",
        ".js": "typescriptJavascript",
        ".jsx": "typescriptJavascript",
        ".mjs": "typescriptJavascript",
        ".cjs": "typescriptJavascript",
        ".go": "go",
        ".cs": "csharp",
        ".java": "java",
        ".kt": "kotlin",
        ".kts": "kotlin",
        ".sh": "shell",
        ".bash": "shell",
        ".php": "php",
        ".rb": "ruby",
        ".swift": "swift",
        ".dart": "dart",
        ".hs": "haskell",
        ".lua": "lua",
        ".scala": "scala",
    }.get(suffix, "cCpp")
    if not effective["languages"].get(family, True):
        return []
    if family == "cCpp":
        return _check_cpp_documentation(path, text)
    header = _source_header(path, text)
    if family in {"python", "go", "shell", "ruby", "swift", "dart", "haskell", "lua"}:
        violations = _require_labels(path, header, ("Author:", "Summary:", "Usage:"))
    elif family in {
        "typescriptJavascript",
        "cCpp",
        "csharp",
        "java",
        "kotlin",
        "php",
        "scala",
    }:
        violations = _require_labels(
            path, header, (("@author", "Author:"), "Usage:")
        )
    else:
        violations = _require_labels(path, header, ("Author", "Usage"))
    if suffix == ".py":
        violations.extend(_check_python_public_units(path, text))
    if suffix == ".rs":
        violations.extend(_check_rust_public_units(path, text))
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
    # Emit findings as UTF-8 regardless of the Windows console codepage, so a
    # candidate containing non-ASCII text cannot crash the checker mid-report.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    try:
        if args.stdin:
            # Decode the piped candidate explicitly and drop a leading byte-order
            # mark: sys.stdin would use the locale codec, turning EF BB BF into
            # "ï»¿", which defeats every header regex below and reports a
            # perfectly documented file as missing its header.
            text = sys.stdin.buffer.read().decode("utf-8-sig")
        else:
            text = Path(args.path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
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
