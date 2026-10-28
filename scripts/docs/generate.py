"""The docs generator: `uv run --no-project python -m scripts.docs.generate`.

Three stages, so a bad run never leaves half a tree behind:

1. `produce` builds every generated file in memory (`dict[PurePosixPath, str]`), running
   pyreverse and paracelsus through the injected `run_tool`.
2. `run` stages that tree in a temp dir and checks every Markdown file there: block size and
   edges, duplicate class names, absolute paths, and the local Mermaid parse through the
   injected `validate`.
3. Only when nothing failed, `write_tree` writes the tree and removes what the run did not
   produce. Otherwise every problem is printed as `<file>: block <n>: <rule>: <detail>`, the
   exit code is 1, and `docs/` is byte-identical to before.

Which packages, layers and children get a diagram is read from the filesystem.
"""

from __future__ import annotations

import sys
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from scripts.docs.discover import discover
from scripts.docs.text import (
    MAX_BLOCK_CHARS,
    MAX_BLOCK_EDGES,
    Kind,
    Problem,
    absolute_paths,
    block_problems,
    duplicate_classes,
    finalize,
)
from scripts.docs.tools import (
    REPO_ROOT,
    RunTool,
    ToolCall,
    ToolError,
    paracelsus_call,
    pyreverse_call,
    run_all,
    subprocess_runner,
)
from scripts.docs.validate import ParseReport, Validator, node_validator
from scripts.docs.writer import write_tree

LAYERS = ("domain", "application", "adapters")
GENERATED = PurePosixPath("docs/architecture/generated")
API = PurePosixPath("docs/api")
SPLIT_NOTE = "Edges between children are not drawn."
NO_LAYER = "No such layer in this package."
NO_CLASSES_IN_LAYER = "No classes in this layer."
NO_CLASSES = "No classes in this diagram."
SCOPE_NOTE = (
    "A diagram shows only its own package: classes of other packages, and the edges that "
    "reach them, are not drawn."
)


@dataclass(frozen=True)
class Limits:
    """A block with `max_chars` characters or `max_edges` edges, or more, is too big."""

    max_chars: int = MAX_BLOCK_CHARS
    max_edges: int = MAX_BLOCK_EDGES


def _fence(body: str) -> str:
    return f"```mermaid\n{body.strip()}\n```"


def _has_classes(body: str) -> bool:
    return any(line.strip().startswith("class ") for line in body.splitlines())


def _count_fences(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.strip() == "```mermaid")


def _breaks(body: str, limits: Limits) -> bool:
    """Whether a class block breaks `limits` or names a class twice, once finalized."""
    text = finalize("class", _fence(body))
    return bool(
        block_problems(text, limits.max_chars, limits.max_edges) or duplicate_classes(text)
    )


def layers_present(package_dir: Path) -> list[str]:
    """The layers (`domain`, `application`, `adapters`) that exist as packages, in that order."""
    return [layer for layer in LAYERS if (package_dir / layer / "__init__.py").is_file()]


def children_of(directory: Path) -> list[str]:
    """The sorted direct children of a layer: its modules and its subpackages."""
    names = [
        child.stem if child.is_file() else child.name
        for child in directory.iterdir()
        if (child.is_file() and child.suffix == ".py" and child.name != "__init__.py")
        or (child.is_dir() and (child / "__init__.py").is_file())
    ]
    return sorted(names)


def _rel(path: Path, repo_root: Path) -> str:
    return path.relative_to(repo_root).as_posix()


def _plan(repo_root: Path) -> tuple[list[ToolCall], dict[str, list[str]]]:
    """The first batch of tool calls and, per hexagon, the layers it has."""
    app_dir = repo_root / "app"
    calls: list[ToolCall] = []
    hexagons: dict[str, list[str]] = {}
    for package in discover(app_dir):
        package_dir = app_dir / package
        layers = layers_present(package_dir)
        if not layers:
            calls.append(
                pyreverse_call(f"class/{package}", package, [_rel(package_dir, repo_root)], "classes")
            )
            continue
        hexagons[package] = layers
        calls.append(
            pyreverse_call(
                f"class/{package}/packages", package, [_rel(package_dir, repo_root)], "packages"
            )
        )
        for layer in layers:
            calls.append(
                pyreverse_call(
                    f"class/{package}/{layer}",
                    f"{package}_{layer}",
                    [_rel(package_dir / layer, repo_root)],
                    "classes",
                )
            )
    modules = sorted(p for p in app_dir.glob("*.py") if p.name != "__init__.py")
    if modules:
        calls.append(
            pyreverse_call("class/app-root", "app_root", [_rel(m, repo_root) for m in modules], "classes")
        )
    calls.append(paracelsus_call("er/data-model"))
    return calls, hexagons


def _split_calls(
    repo_root: Path, results: dict[str, str], hexagons: dict[str, list[str]], limits: Limits
) -> tuple[list[ToolCall], dict[tuple[str, str], list[str]]]:
    """The per-child calls for every layer whose block is too big or names a class twice."""
    calls: list[ToolCall] = []
    split: dict[tuple[str, str], list[str]] = {}
    for package, layers in hexagons.items():
        for layer in layers:
            if not _breaks(results[f"class/{package}/{layer}"], limits):
                continue
            layer_dir = repo_root / "app" / package / layer
            children = children_of(layer_dir)
            split[(package, layer)] = children
            for child in children:
                target = layer_dir / (child if (layer_dir / child).is_dir() else f"{child}.py")
                calls.append(
                    pyreverse_call(
                        f"child/{package}/{layer}/{child}",
                        f"{package}_{layer}_{child}",
                        [_rel(target, repo_root)],
                        "classes",
                    )
                )
    return calls, split


def _class_section(body: str, empty: str) -> str:
    return _fence(body) if _has_classes(body) else empty


def _hexagon_file(
    package: str,
    layers: Sequence[str],
    results: dict[str, str],
    split: dict[tuple[str, str], list[str]],
) -> str:
    parts = [f"# {package}", "", "## Packages", "", _fence(results[f"class/{package}/packages"])]
    for layer in LAYERS:
        parts += ["", f"## {layer}", ""]
        if layer not in layers:
            parts.append(NO_LAYER)
        elif (package, layer) in split:
            parts += [SPLIT_NOTE]
            for child in split[(package, layer)]:
                body = results[f"child/{package}/{layer}/{child}"]
                parts += ["", f"#### {child}", "", _class_section(body, NO_CLASSES_IN_LAYER)]
        else:
            parts.append(_class_section(results[f"class/{package}/{layer}"], NO_CLASSES_IN_LAYER))
    return "\n".join(parts)


def _index(paths: Sequence[PurePosixPath]) -> str:
    parts = ["# Generated architecture diagrams", "", SCOPE_NOTE, ""]
    for path in sorted(paths):
        relative = path.relative_to(GENERATED).as_posix()
        parts.append(f"- [{relative}]({relative})")
    return "\n".join(parts)


def _real_openapi() -> str:
    from scripts.docs.openapi_export import build_docs_app, export_openapi

    return export_openapi(build_docs_app())


def produce(
    repo_root: Path,
    run_tool: RunTool,
    limits: Limits = Limits(),
    openapi: Callable[[], str] = _real_openapi,
) -> dict[PurePosixPath, str]:
    """Every generated file as repo-relative path to final text; nothing is written."""
    calls, hexagons = _plan(repo_root)
    results = run_all(calls, run_tool)
    child_calls, split = _split_calls(repo_root, results, hexagons, limits)
    results.update(run_all(child_calls, run_tool))

    classes: dict[PurePosixPath, tuple[Kind, str]] = {}
    for package in discover(repo_root / "app"):
        path = GENERATED / "classes" / f"{package}.md"
        if package in hexagons:
            text = _hexagon_file(package, hexagons[package], results, split)
        else:
            body = _class_section(results[f"class/{package}"], NO_CLASSES)
            text = f"# {package}\n\n{body}"
        classes[path] = ("class", text)
    if "class/app-root" in results:
        body = _class_section(results["class/app-root"], NO_CLASSES)
        classes[GENERATED / "app-root.md"] = ("class", f"# app root\n\n{body}")
    classes[GENERATED / "data-model.md"] = (
        "er",
        f"# Data model\n\n{_fence(results['er/data-model'])}",
    )
    outputs = {path: finalize(kind, text) for path, (kind, text) in classes.items()}
    outputs[GENERATED / "README.md"] = finalize("index", _index(list(outputs)))
    outputs[API / "README.md"] = finalize(
        "index",
        "# API\n\nThe OpenAPI document of the app, exported without starting a server: "
        "[openapi.json](openapi.json).",
    )
    outputs[API / "openapi.json"] = openapi()
    return outputs


def _located(repo_path: str, problems: Sequence[Problem]) -> list[str]:
    return [f"{repo_path}: block {p.block}: {p.rule}: {p.detail}" for p in problems]


def _staged_findings(
    stage: Path,
    outputs: dict[PurePosixPath, str],
    validate: Validator,
    limits: Limits,
    repo_root: Path,
) -> list[str]:
    roots = [str(stage), tempfile.gettempdir(), str(repo_root)]
    findings: list[str] = []
    markdown: list[Path] = []
    fences = 0
    for path in sorted(outputs):
        if path.suffix != ".md":
            continue
        text = outputs[path]
        markdown.append(stage / path)
        fences += _count_fences(text)
        findings += _located(
            str(path),
            [
                *block_problems(text, limits.max_chars, limits.max_edges),
                *duplicate_classes(text),
                *absolute_paths(text, roots),
            ],
        )
    report: ParseReport = validate(markdown)
    for problem in report.problems:
        shown = problem.path.relative_to(stage).as_posix() if problem.path.is_relative_to(stage) else str(problem.path)
        findings.append(f"{shown}: block {problem.block}: mermaid-parse: {problem.message}")
    if report.blocks_checked is None:
        findings.append("<parser>: block 0: parser-silent: the parser printed no count line")
    elif report.blocks_checked != fences:
        findings.append(
            f"<parser>: block 0: parser-count: the parser checked {report.blocks_checked} "
            f"blocks, the generator produced {fences}"
        )
    return findings


def run(
    repo_root: Path,
    *,
    run_tool: RunTool,
    validate: Validator,
    limits: Limits = Limits(),
    openapi: Callable[[], str] = _real_openapi,
    report: Callable[[str], None] = print,
) -> int:
    """Produce, validate on a staged copy, then write. The exit code: 0, or 1 on any problem."""
    try:
        outputs = produce(repo_root, run_tool, limits, openapi)
    except ToolError as error:
        report(f"<tools>: block 0: tool-failed: {error}")
        return 1
    with tempfile.TemporaryDirectory(prefix="docs-stage-") as stage_name:
        stage = Path(stage_name)
        for path, text in sorted(outputs.items()):
            target = stage / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(text.encode("utf-8"))
        findings = _staged_findings(stage, outputs, validate, limits, repo_root)
    if findings:
        for line in findings:
            report(line)
        return 1
    write_tree(repo_root, outputs)
    return 0


def main() -> int:
    return run(REPO_ROOT, run_tool=subprocess_runner(), validate=node_validator())


if __name__ == "__main__":
    sys.exit(main())
