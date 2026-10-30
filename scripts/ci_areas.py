"""Pytest areas for the selective CI (GH-448): the import graph of `app/`, its closure, and
which `tests/<dir>` a change selects, packed into shards.

An area is an `app/<dir>` with an `__init__.py`. Every function here is pure over a repository
tree (`root`): nothing runs a process, and nothing imports the code it reads, it only parses it
with `ast`. The always set (`ALWAYS_DIRS` plus the top-level `tests/test_*.py`) is a superset
of what `tests-fast` runs; any pytest selection carries it, and an always directory is never an
area shard even when it is also a graph node (`migrations`, `shared`).
"""

from __future__ import annotations

import ast
from collections.abc import Collection, Iterator, Mapping
from pathlib import Path

# Defined here only: every other script imports it.
ALWAYS_DIRS = (
    "architecture",
    "migrations",
    "deploy",
    "design",
    "operator_copy",
    "shared",
    "docs",
)
# Test directories that hold support code, not tests.
SUPPORT_DIRS = ("fakes", "fixtures")
# `app/<dir>` packages that are deliberately not an area with a `tests/<dir>`.
CORE: tuple[str, ...] = ()

MAX_AREA_SHARDS = 3
_CLIENT_FIXTURES = frozenset({"client", "other_client"})
_ROUTE_METHODS = frozenset({"get", "post", "put", "patch", "delete"})
_FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef)


def areas(root: Path) -> tuple[str, ...]:
    """Every `app/<dir>` that has an `__init__.py`, sorted."""
    app = root / "app"
    if not app.is_dir():
        return ()
    return tuple(
        sorted(d.name for d in app.iterdir() if d.is_dir() and (d / "__init__.py").is_file())
    )


def _parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _python_files(directory: Path) -> list[Path]:
    return sorted(p for p in directory.rglob("*.py") if p.is_file())


def _import_targets(tree: ast.Module, package: list[str]) -> Iterator[list[str]]:
    """The dotted module paths every import in `tree` can reach, relative ones resolved against
    `package` (the file's own package). `from m import a` yields `m` and `m.a`, so
    `from app import x` reaches `app.x`. Imports nested in functions count."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name.split(".")
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                keep = len(package) - (node.level - 1)
                if keep < 0:
                    continue
                base = package[:keep]
            else:
                base = []
            module = base + (node.module.split(".") if node.module else [])
            yield module
            for alias in node.names:
                yield [*module, alias.name]


def _app_areas_reached(tree: ast.Module, package: list[str], known: frozenset[str]) -> set[str]:
    reached: set[str] = set()
    for target in _import_targets(tree, package):
        if len(target) > 1 and target[0] == "app" and target[1] in known:
            reached.add(target[1])
    return reached


def import_graph(root: Path) -> dict[str, frozenset[str]]:
    """Each area to the areas it imports. A file directly under `app/` belongs to no area, so it
    has no node, and an import of it is not an edge."""
    known = frozenset(areas(root))
    graph: dict[str, set[str]] = {area: set() for area in known}
    for area in known:
        for path in _python_files(root / "app" / area):
            package = list(path.relative_to(root).parent.parts)
            graph[area] |= _app_areas_reached(_parse(path), package, known) - {area}
    return {area: frozenset(edges) for area, edges in graph.items()}


def closure(graph: Mapping[str, frozenset[str]], changed: Collection[str]) -> frozenset[str]:
    """The changed areas plus every area that imports them, directly or not."""
    importers: dict[str, set[str]] = {}
    for area, imported in graph.items():
        for target in imported:
            importers.setdefault(target, set()).add(area)
    seen: set[str] = set()
    pending = list(changed)
    while pending:
        area = pending.pop()
        if area in seen:
            continue
        seen.add(area)
        pending.extend(importers.get(area, ()))
    return frozenset(seen)


def _call_name(call: ast.Call) -> str | None:
    if isinstance(call.func, ast.Name):
        return call.func.id
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    return None


def _constant_string(node: ast.expr) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _module_routes(tree: ast.Module) -> set[str]:
    """The first path segment of every route a module declares: `APIRouter(prefix=…)` per
    router variable, joined through the module's own `x.include_router(y)` and the decorator
    path."""
    prefixes: dict[str, str] = {}
    parents: dict[str, str] = {}
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
            and isinstance(node.value, ast.Call)
            and _call_name(node.value) == "APIRouter"
        ):
            prefix = ""
            for keyword in node.value.keywords:
                if keyword.arg == "prefix":
                    prefix = _constant_string(keyword.value) or ""
            prefixes[node.targets[0].id] = prefix
        elif (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Call)
            and isinstance(node.value.func, ast.Attribute)
            and node.value.func.attr == "include_router"
            and isinstance(node.value.func.value, ast.Name)
            and node.value.args
            and isinstance(node.value.args[0], ast.Name)
        ):
            parents[node.value.args[0].id] = node.value.func.value.id

    def full_prefix(name: str) -> str:
        joined, visited = "", set()
        current: str | None = name
        while current is not None and current not in visited:
            visited.add(current)
            joined = prefixes.get(current, "") + joined
            current = parents.get(current)
        return joined

    segments: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, _FUNCTIONS):
            continue
        for decorator in node.decorator_list:
            if not (
                isinstance(decorator, ast.Call)
                and isinstance(decorator.func, ast.Attribute)
                and decorator.func.attr in _ROUTE_METHODS
                and isinstance(decorator.func.value, ast.Name)
                and decorator.func.value.id in prefixes
                and decorator.args
            ):
                continue
            path = _constant_string(decorator.args[0])
            if path is None:
                continue
            parts = [p for p in (full_prefix(decorator.func.value.id) + path).split("/") if p]
            if parts and "{" not in parts[0]:
                segments.add(parts[0])
    return segments


def route_owners(root: Path) -> dict[str, frozenset[str]]:
    """The first path segment of each route, to every area that declares one under it
    (`customers` is owned by customers and payments). Routes are read from
    `app/<area>/adapters/*.py`."""
    owners: dict[str, set[str]] = {}
    for area in areas(root):
        adapters = root / "app" / area / "adapters"
        if not adapters.is_dir():
            continue
        for path in sorted(adapters.glob("*.py")):
            for segment in _module_routes(_parse(path)):
                owners.setdefault(segment, set()).add(area)
    return {segment: frozenset(found) for segment, found in owners.items()}


def _literal_text(node: ast.Constant | ast.JoinedStr) -> str | None:
    if isinstance(node, ast.Constant):
        return node.value if isinstance(node.value, str) else None
    text = ""
    for part in node.values:
        piece = _constant_string(part) if isinstance(part, ast.Constant) else "{"
        text += piece or ""
    return text


def _route_segment_of(text: str) -> str | None:
    """The first path segment of a string that looks like a route, cut at the first `{` or
    `?`; `None` for anything that does not start with `/` or has no segment before the cut."""
    if not text.startswith("/"):
        return None
    for mark in ("{", "?"):
        text = text.split(mark, 1)[0]
    parts = text.split("/")
    return parts[1] if len(parts) > 1 and parts[1] else None


class _TestFileFacts:
    """What one test file says about the code it exercises."""

    def __init__(
        self, path: Path, known: frozenset[str], helpers: frozenset[str], root: Path
    ) -> None:
        tree = _parse(path)
        package = list(path.relative_to(root).parent.parts)
        self.areas = _app_areas_reached(tree, package, known)
        self.helpers = {
            target[1]
            for target in _import_targets(tree, package)
            if len(target) > 1 and target[0] == "tests" and target[1] in helpers
        }
        inner = {
            id(part)
            for node in ast.walk(tree)
            if isinstance(node, ast.JoinedStr)
            for part in node.values
        }
        self.segments: set[str] = set()
        self.uses_client = False
        for node in ast.walk(tree):
            if isinstance(node, (ast.Constant, ast.JoinedStr)) and id(node) not in inner:
                text = _literal_text(node)
                segment = _route_segment_of(text) if text is not None else None
                if segment is not None:
                    self.segments.add(segment)
            elif isinstance(node, _FUNCTIONS):
                names = {a.arg for a in (*node.args.posonlyargs, *node.args.args)}
                names |= {a.arg for a in node.args.kwonlyargs}
                self.uses_client = self.uses_client or bool(names & _CLIENT_FIXTURES)


def _helpers(root: Path) -> frozenset[str]:
    tests = root / "tests"
    if not tests.is_dir():
        return frozenset()
    return frozenset(
        p.stem
        for p in tests.glob("*.py")
        if p.stem not in {"__init__", "conftest"} and not p.stem.startswith("test_")
    )


def selected_test_dirs(root: Path, closed: Collection[str]) -> list[str]:
    """The `tests/<area>` directories a change selects, given its closure: the area is in the
    closure; or a `.py` under it imports an area in the closure, or has a route literal under a
    route a closure area owns, or uses the `client` fixture while `accounts` is in the closure;
    or it imports a top-level `tests/*.py` helper that does one of those. An always directory is
    never an area shard."""
    known = frozenset(areas(root))
    closed_set = frozenset(closed)
    owners = route_owners(root)
    helper_names = _helpers(root)
    tests = root / "tests"

    def hits(facts: _TestFileFacts) -> bool:
        if facts.areas & closed_set:
            return True
        if any(owners.get(segment, frozenset()) & closed_set for segment in facts.segments):
            return True
        return facts.uses_client and "accounts" in closed_set

    helper_facts = {
        name: _TestFileFacts(tests / f"{name}.py", known, helper_names, root)
        for name in helper_names
    }

    def helper_hits(name: str, visited: frozenset[str] = frozenset()) -> bool:
        if name in visited:
            return False
        facts = helper_facts[name]
        return hits(facts) or any(helper_hits(h, visited | {name}) for h in facts.helpers)

    selected: list[str] = []
    for area in sorted(known - set(ALWAYS_DIRS)):
        directory = tests / area
        if not directory.is_dir():
            continue
        if area in closed_set:
            selected.append(area)
            continue
        for path in _python_files(directory):
            facts = _TestFileFacts(path, known, helper_names, root)
            if hits(facts) or any(helper_hits(h) for h in facts.helpers):
                selected.append(area)
                break
    return selected


def always_paths(root: Path) -> list[str]:
    """The always set, as repo-relative paths: every top-level `tests/test_*.py` and each
    existing always directory."""
    tests = root / "tests"
    if not tests.is_dir():
        return []
    files = sorted(f"tests/{p.name}" for p in tests.glob("test_*.py"))
    dirs = [f"tests/{name}" for name in sorted(ALWAYS_DIRS) if (tests / name).is_dir()]
    return sorted(files + dirs)


def _parametrize_count(decorator: ast.expr) -> int | None:
    """The literal case count of a `pytest.mark.parametrize(...)` decorator, 1 when the cases
    are not a literal list or tuple; `None` when the decorator is something else."""
    if not (
        isinstance(decorator, ast.Call)
        and isinstance(decorator.func, ast.Attribute)
        and decorator.func.attr == "parametrize"
    ):
        return None
    values: ast.expr | None = decorator.args[1] if len(decorator.args) > 1 else None
    for keyword in decorator.keywords:
        if keyword.arg == "argvalues":
            values = keyword.value
    if isinstance(values, (ast.List, ast.Tuple)):
        return len(values.elts)
    return 1


def _multiplier(decorators: list[ast.expr]) -> int:
    factor = 1
    for decorator in decorators:
        factor *= _parametrize_count(decorator) or 1
    return factor


def _tests_in(body: list[ast.stmt]) -> int:
    count = 0
    for node in body:
        if isinstance(node, _FUNCTIONS) and node.name.startswith("test_"):
            count += _multiplier(node.decorator_list)
        elif isinstance(node, ast.ClassDef) and node.name.startswith("Test"):
            methods = _tests_in(node.body)
            count += methods * _multiplier(node.decorator_list)
    return count


def weight(test_dir: Path) -> int:
    """The number of tests under a directory, by AST: `test_*` functions and the `test_*`
    methods of `Test*` classes, each multiplied by its stacked `parametrize` decorators."""
    return sum(_tests_in(_parse(path).body) for path in _python_files(test_dir))


def pack(
    dirs_with_weights: Mapping[str, int], max_shards: int = MAX_AREA_SHARDS
) -> list[list[str]]:
    """Greedy longest-first into `min(max_shards, len)` bins, ties broken by directory name and
    by bin index, so the result is deterministic. The first items fill the bins in index order,
    so no bin is ever empty. Each bin lists its directories sorted by name."""
    ordered = sorted(dirs_with_weights.items(), key=lambda item: (-item[1], item[0]))
    count = min(max_shards, len(ordered))
    bins: list[list[str]] = [[] for _ in range(count)]
    loads = [0] * count
    for index, (name, size) in enumerate(ordered):
        target = index if index < count else loads.index(min(loads))
        bins[target].append(name)
        loads[target] += size
    return [sorted(names) for names in bins]


def area_shards(root: Path, closed: Collection[str]) -> list[list[str]]:
    """The area shards a closure selects: its test directories packed by test count."""
    selected = selected_test_dirs(root, closed)
    return pack({name: weight(root / "tests" / name) for name in selected})


def unowned_areas(root: Path) -> list[str]:
    """Areas with neither a `tests/<dir>` nor a place in `CORE`."""
    return [
        area for area in areas(root) if area not in CORE and not (root / "tests" / area).is_dir()
    ]


def unclassified_test_dirs(root: Path) -> list[str]:
    """`tests/<dir>` that is neither an always directory, an area, nor support code."""
    tests = root / "tests"
    known = set(areas(root))
    allowed = set(ALWAYS_DIRS) | known | set(SUPPORT_DIRS)
    return [
        d.name
        for d in sorted(tests.iterdir())
        if d.is_dir() and not d.name.startswith(("__", ".")) and d.name not in allowed
    ]


def main_includes_with_prefix(root: Path) -> list[int]:
    """The lines of `app/main.py` where `include_router` is passed `prefix=`: the route scan
    does not read it, so it would make a route owner wrong."""
    main = root / "app" / "main.py"
    if not main.is_file():
        return []
    return [
        node.lineno
        for node in ast.walk(_parse(main))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "include_router"
        and any(keyword.arg == "prefix" for keyword in node.keywords)
    ]
