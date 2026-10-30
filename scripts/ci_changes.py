"""The `changes` job of the selective CI (GH-448, ADR-0064): which suites a pull request runs.

`select(paths, root)` is a pure function over the changed paths and a repository tree. The result
is the union of every rule that matches a path, and it fails closed: a path that matches no rule,
a git failure, an empty diff or an event other than `pull_request` selects every suite. Nothing
here imports or runs a node tool; vitest's guard tests are found the way `affected.py` finds them,
by importing it. Only `main` runs git, through the `Runner` that `affected.py` defines.

    ci_changes.py <event name>      prints `key=value` lines, for `$GITHUB_OUTPUT`
"""

from __future__ import annotations

import ast
import json
import re
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from fnmatch import fnmatchcase
from pathlib import Path, PurePosixPath
from typing import Final, Literal

from scripts.affected import REPO_ROOT, Runner, discover_guards, is_e2e_sound, run_command
from scripts.ci_areas import (
    ALWAYS_DIRS,
    always_paths,
    areas,
    closure,
    import_graph,
    pack,
    selected_test_dirs,
    weight,
)

SELECTOR_INPUTS = (
    "scripts/ci_areas.py",
    "scripts/ci_changes.py",
    "scripts/e2e_screen_specs.json",
    "scripts/affected.py",
)

STACK_PATH: Final = ".agentic/stack.yaml"
SCREEN_MAP_PATH: Final = "scripts/e2e_screen_specs.json"
ALWAYS_SHARD: Final = "always"
MAX_E2E_SHARDS: Final = 4
MOBILE_PAIR: Final = ("web/e2e/mobile.spec.ts", "web/e2e/mobile.setup.ts")
_WATCHED: Final = frozenset({"web", "docs"})
_TEST_SUFFIXES: Final = (".test.ts", ".test.tsx")
_SAFE_PATH: Final = re.compile(r"[A-Za-z0-9._/][A-Za-z0-9._/-]*")
ALL_SHARD: Final = "all"


# --- paths that may reach a shell --------------------------------------------------------------


def is_safe_path(path: str) -> bool:
    """Whether a path a fork can influence is plain enough to travel through `env:` into a command
    line: letters, digits, `.`, `_`, `-` and `/`, never starting with `-`. Every producer of such a
    value drops it to a full run when any path fails this."""
    return _SAFE_PATH.fullmatch(path) is not None


def _is_plain_path(path: str) -> bool:
    """`is_safe_path`, and no segment starts with `-` (a spec name Playwright could read as an
    option once the directory is stripped)."""
    return is_safe_path(path) and not any(part.startswith("-") for part in path.split("/"))


# --- the git side -----------------------------------------------------------------------------


def diff_argv(event: str) -> list[str] | None:
    """The git command that lists a pull request's changed paths; `None` for any other event,
    whose selection is everything."""
    if event == "pull_request":
        return ["git", "diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"]
    return None


def paths_from_git(returncode: int, stdout: str) -> list[str] | None:
    """The changed paths, or `None` (select everything) on a failure or an empty diff."""
    if returncode != 0:
        return None
    paths = sorted({line for line in stdout.splitlines() if line})
    return paths or None


# --- the reader map: which pytest shards read a `web/` or `docs/` path -------------------------

_Name = Literal["local", "unknown"]


@dataclass(frozen=True)
class _Anchored:
    """A path known to start at the repository root: its parts below the root."""

    parts: tuple[str, ...]


_Value = _Anchored | _Name
_LOCAL: Final[_Name] = "local"
_UNKNOWN: Final[_Name] = "unknown"
_SAME_PATH = frozenset({"resolve", "absolute", "expanduser"})
_GLOB_METHODS = frozenset({"glob", "rglob"})
_FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef)
_COMPREHENSIONS = (ast.ListComp, ast.SetComp, ast.GeneratorExp, ast.DictComp)


def _extend(parts: tuple[str, ...], text: str) -> tuple[str, ...] | None:
    """`parts` joined with a string operand; `None` for an absolute one."""
    if text.startswith("/"):
        return None
    out = list(parts)
    for segment in text.split("/"):
        if segment == "..":
            if out:
                out.pop()
        elif segment not in ("", "."):
            out.append(segment)
    return tuple(out)


def _literal(node: ast.expr) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _glob_prefix(pattern: str) -> str:
    """The segments of a glob pattern before the first one with a wildcard."""
    kept: list[str] = []
    for segment in pattern.split("/"):
        if any(mark in segment for mark in "*?["):
            break
        kept.append(segment)
    return "/".join(kept)


def _bound_names(target: ast.expr) -> list[str]:
    return [node.id for node in ast.walk(target) if isinstance(node, ast.Name)]


class _FileScan:
    """What one test file reads of `web/` and `docs/`. A read counts only when its path is
    anchored at the repository root: `Path(__file__)` walked up with `.parent` / `.parents[N]`,
    or a module constant of this file, then extended by `/`, `joinpath`, `glob` or `rglob`.
    A string anywhere else (a list, a call argument, `parametrize`) claims nothing, and a chain
    that starts from a fixture parameter or a loop variable claims nothing either. A chain that
    names `web` or `docs` from an origin this scan cannot place is reported."""

    def __init__(self, root: Path, path: Path) -> None:
        self._here = path.relative_to(root).parts
        self.claims: set[str] = set()
        self.unanchored = False
        self._tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        self._module = _module_env(self._tree, self._here)

    def run(self) -> None:
        self._visit(self._tree, dict(self._module))

    # evaluation: what a path expression stands for

    def _value(self, node: ast.expr, env: dict[str, _Value]) -> _Value:
        return _value_of(node, env, self._here)

    def _visit(self, node: ast.AST, env: dict[str, _Value]) -> None:
        if isinstance(node, _FUNCTIONS):
            inner = dict(env)
            arguments = node.args
            for argument in (*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs):
                inner[argument.arg] = _LOCAL
            for extra in (arguments.vararg, arguments.kwarg):
                if extra is not None:
                    inner[extra.arg] = _LOCAL
            for outer in (*node.decorator_list, *arguments.defaults, *arguments.kw_defaults):
                if outer is not None:
                    self._visit(outer, env)
            for statement in node.body:
                self._visit(statement, inner)
        elif isinstance(node, ast.Lambda):
            inner = dict(env)
            for argument in (*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs):
                inner[argument.arg] = _LOCAL
            self._visit(node.body, inner)
        elif isinstance(node, ast.ClassDef):
            inner = dict(env)
            for statement in node.body:
                self._visit(statement, inner)
        elif isinstance(node, ast.Assign):
            self._assign(node.targets, node.value, env)
        elif isinstance(node, ast.AnnAssign):
            if node.value is not None:
                self._assign([node.target], node.value, env)
        elif isinstance(node, (ast.For, ast.AsyncFor)):
            self._visit(node.iter, env)
            for name in _bound_names(node.target):
                env[name] = _LOCAL
            for statement in (*node.body, *node.orelse):
                self._visit(statement, env)
        elif isinstance(node, _COMPREHENSIONS):
            inner = dict(env)
            for generator in node.generators:
                self._visit(generator.iter, inner)
                for name in _bound_names(generator.target):
                    inner[name] = _LOCAL
                for condition in generator.ifs:
                    self._visit(condition, inner)
            for child in ast.iter_child_nodes(node):
                if not isinstance(child, ast.comprehension):
                    self._visit(child, inner)
        elif isinstance(node, (ast.With, ast.AsyncWith)):
            for item in node.items:
                self._visit(item.context_expr, env)
                if item.optional_vars is not None:
                    for name in _bound_names(item.optional_vars):
                        env[name] = _LOCAL
            for statement in node.body:
                self._visit(statement, env)
        elif isinstance(node, ast.expr) and self._read(node, env):
            return
        else:
            for child in ast.iter_child_nodes(node):
                self._visit(child, env)

    def _assign(self, targets: Sequence[ast.expr], value: ast.expr, env: dict[str, _Value]) -> None:
        computed = self._value(value, env)
        plain = all(isinstance(target, ast.Name) for target in targets)
        if not (plain and isinstance(computed, _Anchored)):
            # A constant that is a path defines one; any other value is read where it is built.
            self._visit(value, env)
        for target in targets:
            if isinstance(target, ast.Name):
                env[target.id] = computed
            else:
                for name in _bound_names(target):
                    env[name] = _LOCAL

    def _read(self, node: ast.expr, env: dict[str, _Value]) -> bool:
        """Records the claim or the unanchored chain `node` stands for; true when it did, so the
        walk does not descend into the chain's own parts."""
        value = self._value(node, env)
        if isinstance(value, _Anchored):
            if value.parts and value.parts[0] in _WATCHED:
                self.claims.add("/".join(value.parts))
                return True
            return False
        if value == _UNKNOWN and _names_watched(node):
            self.unanchored = True
            return True
        return False


def _names_watched(node: ast.expr) -> bool:
    """A `/` chain or a `joinpath` call with a `web` or `docs` literal operand."""
    literals: list[str] = []
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
        current: ast.expr = node
        while isinstance(current, ast.BinOp) and isinstance(current.op, ast.Div):
            text = _literal(current.right)
            if text is not None:
                literals.append(text)
            current = current.left
        if isinstance(current, ast.Call) and _call_name(current) == "Path":
            literals.extend(text for arg in current.args if (text := _literal(arg)) is not None)
    elif (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "joinpath"
    ):
        literals = [text for arg in node.args if (text := _literal(arg)) is not None]
    return any(text.split("/")[0] in _WATCHED for text in literals)


def _call_name(node: ast.Call) -> str | None:
    return node.func.id if isinstance(node.func, ast.Name) else None


def _value_of(node: ast.expr, env: dict[str, _Value], here: tuple[str, ...]) -> _Value:
    if isinstance(node, ast.Name):
        return env.get(node.id, _UNKNOWN)
    if isinstance(node, ast.Attribute):
        base = _value_of(node.value, env, here)
        if isinstance(base, _Anchored):
            return _Anchored(base.parts[:-1]) if node.attr == "parent" else _UNKNOWN
        return base
    if isinstance(node, ast.Subscript):
        value = node.value
        if isinstance(value, ast.Attribute) and value.attr == "parents":
            base = _value_of(value.value, env, here)
            index = node.slice
            if isinstance(base, _Anchored):
                if (
                    isinstance(index, ast.Constant)
                    and isinstance(index.value, int)
                    and 0 <= index.value < len(base.parts)
                ):
                    return _Anchored(base.parts[: len(base.parts) - index.value - 1])
                return _UNKNOWN
            return base
        base = _value_of(value, env, here)
        return _LOCAL if base == _LOCAL else _UNKNOWN
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
        left = _value_of(node.left, env, here)
        if isinstance(left, _Anchored):
            text = _literal(node.right)
            if text is None:
                return left
            extended = _extend(left.parts, text)
            return _UNKNOWN if extended is None else _Anchored(extended)
        return left
    if isinstance(node, ast.Call):
        return _call_value(node, env, here)
    return _UNKNOWN


def _call_value(node: ast.Call, env: dict[str, _Value], here: tuple[str, ...]) -> _Value:
    func = node.func
    arguments = [_value_of(arg, env, here) for arg in node.args]
    if isinstance(func, ast.Name) and func.id == "Path" and node.args:
        first = node.args[0]
        if isinstance(first, ast.Name) and first.id == "__file__":
            return _Anchored(here)
        if isinstance(arguments[0], _Anchored):
            return _join(arguments[0], node.args[1:])
        text = _literal(first)
        if text is not None and text.startswith("/"):
            return _LOCAL  # an absolute path is not the repository: a fake root in a unit test
    elif isinstance(func, ast.Attribute):
        receiver = _value_of(func.value, env, here)
        if isinstance(receiver, _Anchored):
            if func.attr in _SAME_PATH:
                return receiver
            if func.attr == "joinpath":
                return _join(receiver, node.args)
            if func.attr in _GLOB_METHODS and node.args:
                text = _literal(node.args[0])
                if text is not None:
                    return _join(receiver, [ast.Constant(_glob_prefix(text))])
            return _UNKNOWN
        if receiver == _LOCAL:
            return _LOCAL
    return _LOCAL if _LOCAL in arguments else _UNKNOWN


def _join(base: _Anchored, operands: Sequence[ast.expr]) -> _Value:
    parts = base.parts
    for operand in operands:
        text = _literal(operand)
        if text is None:
            return _Anchored(parts)
        extended = _extend(parts, text)
        if extended is None:
            return _UNKNOWN
        parts = extended
    return _Anchored(parts)


# The repository root, and the paths below it, as the modules that define them export them. Only
# these imports are placed: a name imported from anywhere else stays unplaced.
_ROOT_EXPORTS: Final[dict[tuple[str, str], tuple[str, ...]]] = {
    ("scripts.affected", "REPO_ROOT"): (),
    ("scripts.affected", "WEB"): ("web",),
    ("tests.architecture.hexagon", "REPO_ROOT"): (),
}


def _module_env(tree: ast.Module, here: tuple[str, ...]) -> dict[str, _Value]:
    """The module-level names that stand for an anchored path, resolved in source order. The
    repository root imported from the module that defines it (`_ROOT_EXPORTS`) is anchored, so a
    guard test that reads `REPO_ROOT / "web" / ...` claims what it reads; a walk of the whole
    tree (`REPO_ROOT.rglob("*.py")`) claims nothing. A name imported from any other module claims
    nothing and is not reported."""
    env: dict[str, _Value] = {}
    for statement in tree.body:
        if isinstance(statement, ast.ImportFrom):
            for alias in statement.names:
                exported = _ROOT_EXPORTS.get((statement.module or "", alias.name))
                name = alias.asname or alias.name
                env[name] = _LOCAL if exported is None else _Anchored(exported)
        elif isinstance(statement, ast.Assign):
            value = _value_of(statement.value, env, here)
            for target in statement.targets:
                if isinstance(target, ast.Name):
                    env[target.id] = value
        elif isinstance(statement, ast.AnnAssign) and statement.value is not None:
            if isinstance(statement.target, ast.Name):
                env[statement.target.id] = _value_of(statement.value, env, here)
    return env


def _test_files(root: Path) -> list[Path]:
    tests = root / "tests"
    return sorted(p for p in tests.rglob("*.py") if p.is_file()) if tests.is_dir() else []


def _shards_of(path: Path, root: Path, every: frozenset[str]) -> frozenset[str]:
    """The pytest shards a test file belongs to: the always shard for an always directory or a
    top-level `test_*.py`, the area for `tests/<area>`, every area for a top-level helper or a
    support directory."""
    parts = path.relative_to(root / "tests").parts
    if len(parts) == 1:
        return frozenset({ALWAYS_SHARD}) if parts[0].startswith("test_") else every
    if parts[0] in ALWAYS_DIRS:
        return frozenset({ALWAYS_SHARD})
    if parts[0] in every:
        return frozenset({parts[0]})
    return every


def _test_areas(root: Path) -> list[str]:
    """Every area with a `tests/<area>` that is not an always directory: a shard of its own."""
    return [a for a in areas(root) if a not in ALWAYS_DIRS and (root / "tests" / a).is_dir()]


def _scans(root: Path) -> list[tuple[Path, _FileScan]]:
    scans: list[tuple[Path, _FileScan]] = []
    for path in _test_files(root):
        scan = _FileScan(root, path)
        scan.run()
        scans.append((path, scan))
    return scans


def pytest_readers(root: Path) -> dict[str, frozenset[str]]:
    """A repository path prefix under `web/` or `docs/` to the pytest shards that read it. A
    prefix that does not exist in `root` is dropped."""
    readers: dict[str, frozenset[str]] = {}
    every = frozenset(_test_areas(root))
    for path, scan in _scans(root):
        shards = _shards_of(path, root, every)
        for claim in scan.claims:
            if (root / claim).exists():
                readers[claim] = readers.get(claim, frozenset()) | shards
    return readers


def unanchored_reads(root: Path) -> list[str]:
    """The test files with a chain naming `web` or `docs` from an origin the scan cannot place,
    as repo-relative paths: a reader the map would miss."""
    return [path.relative_to(root).as_posix() for path, scan in _scans(root) if scan.unanchored]


# --- the rules --------------------------------------------------------------------------------


def fallback_globs(root: Path) -> list[str] | None:
    """The `affected_fallback` globs of `.agentic/stack.yaml`; `None` when the file is missing
    or declares none, which selects everything."""
    stack = root / STACK_PATH
    if not stack.is_file():
        return None
    globs: list[str] = []
    inside = False
    for line in stack.read_text(encoding="utf-8").splitlines():
        if line.startswith("affected_fallback:"):
            inside = True
        elif inside and line.startswith("  - "):
            globs.append(line[4:].strip())
        elif inside and not line.startswith(("#", " ")) and line.strip():
            break
    return globs or None


def _screen_map(root: Path) -> dict[str, list[str]] | None:
    path = root / SCREEN_MAP_PATH
    if not path.is_file():
        return None
    loaded = json.loads(path.read_text(encoding="utf-8"))
    return {str(k): [str(s) for s in v] for k, v in loaded.items()}


@dataclass
class _Plan:
    """What the paths seen so far select; every rule only adds."""

    everything: bool = False
    pytest: bool = False
    all_areas: bool = False
    changed_areas: set[str] = field(default_factory=set)
    area_dirs: set[str] = field(default_factory=set)
    guards: bool = False
    vitest_changed: bool = False
    vitest_all: bool = False
    vitest_tests: set[str] = field(default_factory=set)
    all_e2e: bool = False
    e2e_specs: set[str] = field(default_factory=set)
    mobile_pair: bool = False


@dataclass
class _Context:
    root: Path
    fallback: list[str] | None
    screens: dict[str, list[str]] | None
    known: frozenset[str]
    readers: dict[str, frozenset[str]] | None = None

    def readers_map(self) -> dict[str, frozenset[str]]:
        if self.readers is None:
            self.readers = pytest_readers(self.root)
        return self.readers


def _rule_fallback(path: str, parts: tuple[str, ...], plan: _Plan, ctx: _Context) -> bool:
    if path == STACK_PATH or any(fnmatchcase(path, glob) for glob in ctx.fallback or ()):
        plan.everything = True
        return True
    return False


def _rule_app(path: str, parts: tuple[str, ...], plan: _Plan, ctx: _Context) -> bool:
    if parts[0] != "app":
        return False
    plan.pytest = True
    if len(parts) > 2 and parts[1] in ctx.known:
        plan.changed_areas.add(parts[1])
    else:
        plan.all_areas = True
    return True


def _rule_tests(path: str, parts: tuple[str, ...], plan: _Plan, ctx: _Context) -> bool:
    if parts[0] != "tests":
        return False
    if len(parts) == 2:
        if not path.endswith(".py"):
            return False
        plan.pytest = True
        if not parts[1].startswith("test_"):
            plan.all_areas = True
        return True
    if len(parts) > 2 and parts[1] in ALWAYS_DIRS:
        plan.pytest = True
        return True
    if len(parts) > 2 and parts[1] in ctx.known:
        plan.pytest = True
        plan.area_dirs.add(parts[1])
        return True
    return False


def _screen_key(below: tuple[str, ...]) -> str | None:
    if len(below) > 1:
        return below[0]
    if below and below[0].endswith(".tsx"):
        return below[0].removesuffix(".tsx")
    return None


def _rule_web_src(path: str, parts: tuple[str, ...], plan: _Plan, ctx: _Context) -> bool:
    if parts[:2] != ("web", "src") or len(parts) < 3:
        return False
    if path.endswith(_TEST_SUFFIXES):
        plan.vitest_tests.add(PurePosixPath(*parts[1:]).as_posix())
        return True
    plan.guards = True
    plan.vitest_changed = True
    if parts[2] in ("screens", "components"):
        plan.mobile_pair = True
    if parts[2] != "screens":
        plan.all_e2e = True
        return True
    key = _screen_key(parts[3:])
    specs = ctx.screens.get(key) if ctx.screens is not None and key is not None else None
    if specs is None:
        plan.all_e2e = True
    else:
        plan.e2e_specs.update(specs)
    return True


def _rule_web_other(path: str, parts: tuple[str, ...], plan: _Plan, ctx: _Context) -> bool:
    if parts[0] != "web":
        return False
    if parts[1:2] == ("public",) and len(parts) > 2:
        plan.vitest_all = True
        plan.all_e2e = True
        return True
    if is_e2e_sound(path):
        if path.endswith(".spec.ts"):
            plan.e2e_specs.add(path)
        else:
            plan.all_e2e = True
        return True
    return False


def _is_root_markdown(path: str) -> bool:
    return "/" not in path and path.endswith(".md")


def _rule_docs(path: str, parts: tuple[str, ...], plan: _Plan, ctx: _Context) -> bool:
    if parts[0] not in ("docs", ".agentic") and not _is_root_markdown(path):
        return False
    plan.pytest = True
    plan.guards = True
    if path.startswith("docs/product/design-system/"):
        plan.mobile_pair = True
    return True


def _rule_scripts(path: str, parts: tuple[str, ...], plan: _Plan, ctx: _Context) -> bool:
    if parts[0] not in ("scripts", "deploy") and path not in ("alembic.ini", "render.yaml"):
        return False
    plan.pytest = True
    if path.startswith("scripts/design/"):
        plan.mobile_pair = True
    return True


_RULES = (
    _rule_fallback,
    _rule_app,
    _rule_tests,
    _rule_web_src,
    _rule_web_other,
    _rule_docs,
    _rule_scripts,
)


def _apply_readers(path: str, plan: _Plan, ctx: _Context) -> None:
    for prefix, shards in ctx.readers_map().items():
        if path == prefix or path.startswith(f"{prefix}/"):
            plan.pytest = True
            plan.area_dirs.update(shards - {ALWAYS_SHARD})


def _apply(path: str, plan: _Plan, ctx: _Context) -> None:
    parts = PurePosixPath(path).parts
    if not parts:
        plan.everything = True
        return
    matched = [rule(path, parts, plan, ctx) for rule in _RULES]
    if not any(matched):
        plan.everything = True
    elif parts[0] in _WATCHED:
        _apply_readers(path, plan, ctx)


# --- the outputs ------------------------------------------------------------------------------


@dataclass(frozen=True)
class Selection:
    pytest: bool
    vitest: bool
    e2e: bool
    vitest_changed: bool
    vitest_all: bool
    pytest_matrix: list[dict[str, str]]
    vitest_files: list[str]
    e2e_specs: list[str]
    e2e_shards: int
    e2e_all: bool
    shard_paths_safe: bool
    areas: list[str]
    selected: list[str]


def _all_e2e_specs(root: Path) -> list[str]:
    e2e = root / "web" / "e2e"
    if not e2e.is_dir():
        return []
    names = [p.name for p in e2e.iterdir() if p.name.endswith((".spec.ts", ".setup.ts"))]
    return [f"web/e2e/{name}" for name in sorted(names)]


def _matrix(root: Path, dirs: list[str], always: list[str]) -> list[dict[str, str]]:
    matrix: list[dict[str, str]] = []
    if always:
        matrix.append({"shard": ALWAYS_SHARD, "paths": " ".join(always)})
    bins = pack({name: weight(root / "tests" / name) for name in dirs})
    for number, names in enumerate(bins, start=1):
        matrix.append({"shard": f"areas-{number}", "paths": " ".join(f"tests/{n}" for n in names)})
    return matrix


def _e2e_shards(specs: list[str]) -> int:
    """Shards for the selected specs: one per spec up to the cap, and at least one whenever
    anything is selected."""
    if not specs:
        return 0
    return min(MAX_E2E_SHARDS, max(1, sum(s.endswith(".spec.ts") for s in specs)))


def select(paths: Sequence[str] | None, root: Path) -> Selection:
    """The suites, shards and files a set of changed paths selects. `None` or an empty list
    (a git failure, an empty diff, an event that does not diff) selects everything."""
    plan = _Plan(everything=not paths)
    if paths:
        context = _Context(root, fallback_globs(root), _screen_map(root), frozenset(areas(root)))
        if context.fallback is None:
            plan.everything = True
        for path in paths:
            _apply(path, plan, context)
    return _finish(plan, root)


def _finish(plan: _Plan, root: Path) -> Selection:
    if plan.everything:
        plan.pytest = plan.all_areas = plan.guards = plan.vitest_all = plan.all_e2e = True
    known = areas(root)
    dirs: set[str] = set(plan.area_dirs)
    if plan.pytest:
        closed = known if plan.all_areas else closure(import_graph(root), plan.changed_areas)
        dirs.update(selected_test_dirs(root, closed))
    always = always_paths(root) if plan.pytest else []
    ordered = sorted(d for d in dirs if (root / "tests" / d).is_dir() and d not in ALWAYS_DIRS)
    matrix = _matrix(root, ordered, always)
    specs = set(plan.e2e_specs)
    if plan.mobile_pair:
        specs.update(MOBILE_PAIR)
    if plan.all_e2e:
        specs.update(_all_e2e_specs(root))
    e2e_specs = sorted(s for s in specs if (root / s).is_file())
    guards = discover_guards(root / "web" / "src") if plan.guards else []
    vitest_files = sorted(
        set(guards) | {t for t in plan.vitest_tests if (root / "web" / t).is_file()}
    )
    in_always = [a for a in known if a in ALWAYS_DIRS and always]
    return Selection(
        pytest=bool(matrix),
        vitest=bool(vitest_files) or plan.vitest_changed or plan.vitest_all,
        e2e=bool(e2e_specs),
        vitest_changed=plan.vitest_changed,
        vitest_all=plan.vitest_all,
        pytest_matrix=matrix,
        vitest_files=vitest_files,
        e2e_specs=e2e_specs,
        e2e_shards=_e2e_shards(e2e_specs),
        e2e_all=plan.all_e2e,
        shard_paths_safe=all(is_safe_path(p) for p in [*always, *(f"tests/{d}" for d in ordered)]),
        areas=list(known),
        selected=sorted([*ordered, *in_always]) if matrix else [],
    )


def _e2e_args(selection: Selection) -> str:
    """The spec and setup paths below `web/` for Playwright; empty (every configured spec) on a
    full run or when any selected path is unsafe."""
    if selection.e2e_all or not _all_plain(selection.e2e_specs):
        return ""
    return " ".join(spec.removeprefix("web/") for spec in selection.e2e_specs)


def _all_plain(paths: list[str]) -> bool:
    return all(_is_plain_path(path) for path in paths)


def render(selection: Selection) -> list[str]:
    """The `key=value` lines for `$GITHUB_OUTPUT`: flags as `"true"`/`"false"`, lists as JSON. A
    pytest path that is not safe collapses the matrix to one `all` shard with no paths, which
    runs every test and counts as every area selected."""

    def flag(value: bool) -> str:
        return "true" if value else "false"

    def dump(value: object) -> str:
        return json.dumps(value, separators=(",", ":"))

    matrix = selection.pytest_matrix
    selected = selection.selected
    if matrix and not selection.shard_paths_safe:
        matrix = [{"shard": ALL_SHARD, "paths": ""}]
        selected = sorted(selection.areas)
    e2e_matrix = list(range(1, selection.e2e_shards + 1)) if selection.e2e else []
    coverage = {
        "pytest": flag(selection.pytest),
        "vitest": flag(selection.vitest),
        "e2e": flag(selection.e2e),
        "vitest_all": flag(selection.vitest_all),
        "vitest_files": len(selection.vitest_files),
        "areas": selection.areas,
        "selected": selected,
    }
    return [
        f"pytest={flag(selection.pytest)}",
        f"vitest={flag(selection.vitest)}",
        f"e2e={flag(selection.e2e)}",
        f"vitest_changed={flag(selection.vitest_changed)}",
        f"vitest_all={flag(selection.vitest_all)}",
        f"pytest_matrix={dump({'include': matrix})}",
        f"vitest_files={dump(selection.vitest_files)}",
        f"e2e_specs={dump(selection.e2e_specs)}",
        f"e2e_shards={selection.e2e_shards}",
        f"e2e_matrix={dump(e2e_matrix)}",
        f"e2e_args={_e2e_args(selection)}",
        f"selection={dump(coverage)}",
    ]


def main(argv: Sequence[str], run: Runner = run_command, *, root: Path = REPO_ROOT) -> int:
    """`ci_changes.py <event name>`: runs the diff only for a pull request, and prints the
    outputs. Anything it cannot diff selects everything."""
    command = diff_argv(argv[0] if argv else "")
    paths: list[str] | None = None
    if command is not None:
        result = run(command, capture=True, cwd=root)
        paths = paths_from_git(result.returncode, result.stdout)
        if paths is None:
            print("ci_changes: no usable diff -> everything", file=sys.stderr)
    for line in render(select(paths, root)):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
