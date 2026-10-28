"""Which suites a change runs on GitHub (ADR-0055): the `changes` job of ci.yml.

`select(paths, stack, areas_map, is_master_push)` is the one decision, a pure function over
the changed paths, `.agentic/stack.yaml` and the pytest area map `scripts/pytest_areas.json`.
`main` only reads the diff of the checked-out merge ref and writes the result to
`$GITHUB_OUTPUT`; `derive` writes the area map from a `pytest --cov-context=test` run.

Every step fails open: an unknown path, an empty diff, a missing parent, a git error, a path
matching `affected_fallback` and a push to `master` all select everything, never nothing.

- pytest: the "always" paths (the `tests-fast` command of `stack.yaml`, never listed here a
  second time) run in the `test` job and are never a group. The groups are one per
  `tests/<d>` that has an `app/<d>`, plus `rest` (every other test). `rest` runs on every
  change that affects pytest; a change under `app/<X>/` also runs every group that executes
  X, according to the area map. The root modules of `app/` and `app/shared` select all.
  A `web/src` path outside `screens/` also runs the groups whose tests read `web/src`.
- vitest: skipped only when every changed path is under `app/` and none is a fallback path.
- e2e: `web/src/screens/<Dir>` selects the specs of `SCREEN_SPECS[Dir]`, and any `web/src`
  change adds `mobile.spec.ts`; any other `web/src` path, a spec helper and a file of
  `web/e2e` that is not a spec select all; a changed spec selects itself; a change that is
  only under `app/` or `tests/` runs no e2e.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import sqlite3
import subprocess
import sys
from collections.abc import Callable, Mapping, Sequence
from fnmatch import fnmatchcase
from pathlib import Path, PurePosixPath
from typing import Literal, TypedDict, cast

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
STACK_PATH = REPO_ROOT / ".agentic" / "stack.yaml"
AREAS_MAP_PATH = REPO_ROOT / "scripts" / "pytest_areas.json"

REST = "rest"
MAX_SHARDS = 4
PHASES = frozenset({"setup", "run", "teardown"})
MASTER_REF = "refs/heads/master"

# The phone check walks every screen, so any change to the front runs it.
ALWAYS_SPECS: frozenset[str] = frozenset({"mobile.spec.ts"})

# `web/src/screens/<Dir>` -> the e2e specs that exercise that screen. Pinned in
# tests/test_ci_changes.py: a screen directory missing here, a spec that does not exist and a
# spec that is neither mapped nor in `FULL_ONLY_SPECS` all fail there.
SCREEN_SPECS: Mapping[str, frozenset[str]] = {
    "analisis": frozenset({"analysis.spec.ts", "withdrawals.spec.ts"}),
    "clientes": frozenset(
        {
            "clientesCobrar.spec.ts",
            "cobroHoja.spec.ts",
            "cobroModal.spec.ts",
            "customers.spec.ts",
            "inicioCobrar.spec.ts",
            "insets.spec.ts",
            "leaveWithBack.spec.ts",
            "panel.spec.ts",
            "payments.spec.ts",
        }
    ),
    "expenses": frozenset({"analysis.spec.ts", "flow.spec.ts", "tapBudget.spec.ts"}),
    "inicio": frozenset(
        {
            "cobroHoja.spec.ts",
            "cobroModal.spec.ts",
            "firstRun.spec.ts",
            "inicioCobrar.spec.ts",
            "panel.spec.ts",
            "settings.spec.ts",
            "withdrawals.spec.ts",
        }
    ),
    "onboarding": frozenset({"firstRun.spec.ts", "onboarding.spec.ts"}),
    "settings": frozenset(
        {
            "catalog.spec.ts",
            "firstRun.spec.ts",
            "flow.spec.ts",
            "passwords.spec.ts",
            "pinnedCatalog.spec.ts",
            "settings.spec.ts",
            "theme.spec.ts",
        }
    ),
    "varieties": frozenset(
        {
            "archivadas.spec.ts",
            "catalog.spec.ts",
            "flow.spec.ts",
            "pinnedCatalog.spec.ts",
            "priceModal.spec.ts",
            "varietiesAutoSelect.spec.ts",
        }
    ),
    "ventas": frozenset(
        {
            "customers.spec.ts",
            "insets.spec.ts",
            "leaveWithBack.spec.ts",
            "nuevaVentaTelefono.spec.ts",
            "payments.spec.ts",
            "sales.spec.ts",
            "ventasLinea.spec.ts",
            "ventasPhone.spec.ts",
            "ventasTelefono.spec.ts",
        }
    ),
    "withdrawals": frozenset({"analysis.spec.ts", "withdrawals.spec.ts"}),
}

# Specs about the whole shell, the document or the router, not about one screen directory:
# they run when the e2e run is full, or when the spec itself changes.
FULL_ONLY_SPECS: frozenset[str] = frozenset(
    {
        "barFit.spec.ts",
        "catalogInsecureOrigin.spec.ts",
        "consoleCollector.spec.ts",
        "install.spec.ts",
        "navigation.spec.ts",
        "pressed.spec.ts",
    }
)


class E2ESelection(TypedDict):
    mode: Literal["all", "list", "skip"]
    specs: list[str]
    shards: list[str]


class Selection(TypedDict):
    pytest: list[str]
    vitest: bool
    e2e: E2ESelection


Git = Callable[[Sequence[str]], tuple[int, str]]


def load_stack(path: Path = STACK_PATH) -> dict[str, object]:
    return cast("dict[str, object]", yaml.safe_load(path.read_text()))


def always_paths(stack: Mapping[str, object]) -> list[str]:
    """The paths the `tests-fast` command runs: the "always" set, read from `stack.yaml`."""
    checks = cast("Mapping[str, str]", stack["checks"])
    return [token for token in shlex.split(checks["tests-fast"]) if token.startswith("tests")]


def _under(path: str, prefixes: Sequence[str]) -> bool:
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in prefixes)


def area_names(always: Sequence[str], root: Path = REPO_ROOT) -> list[str]:
    """Every `tests/<d>` that has an `app/<d>` and is not an "always" path, sorted."""
    tests, app = root / "tests", root / "app"
    return sorted(
        child.name
        for child in tests.iterdir()
        if child.is_dir()
        and (app / child.name).is_dir()
        and not _under(f"tests/{child.name}", always)
    )


def groups_for(stack: Mapping[str, object], root: Path = REPO_ROOT) -> list[str]:
    return [*area_names(always_paths(stack), root), REST]


GROUPS: tuple[str, ...] = tuple(groups_for(load_stack()))


def coverage_artifact(group: str) -> str:
    """The name of the artifact one pytest group uploads its coverage data under."""
    return f"coverage-pytest-{group}"


def pytest_args(group: str, stack: Mapping[str, object], root: Path = REPO_ROOT) -> list[str]:
    """What to hand `pytest` for one group: the area's directory, or everything that is
    neither an "always" path nor an area (`rest`)."""
    always = always_paths(stack)
    areas = area_names(always, root)
    if group == REST:
        return [
            "tests",
            *(f"--ignore={path}" for path in [*always, *(f"tests/{a}" for a in areas)]),
        ]
    if group in areas:
        return [f"tests/{group}"]
    raise ValueError(f"unknown pytest group {group!r}")


def _everything(groups: Sequence[str]) -> Selection:
    return {
        "pytest": list(groups),
        "vitest": True,
        "e2e": {"mode": "all", "specs": [], "shards": _shards(MAX_SHARDS)},
    }


def _shards(count: int) -> list[str]:
    return [f"{index}/{count}" for index in range(1, count + 1)]


def _test_group(path: str, always: Sequence[str], areas: Sequence[str]) -> str | None:
    """The pytest group that runs the test file `path` (`tests/...`); None for "always"."""
    if _under(path, always):
        return None
    parts = PurePosixPath(path).parts
    if len(parts) > 2 and parts[1] in areas:
        return parts[1]
    return REST


# None: select all e2e. Otherwise the spec files (names under web/e2e) the path adds.
def _e2e_specs(path: str, root: Path) -> frozenset[str] | None:
    parts = PurePosixPath(path).parts
    if parts[0] in ("app", "tests"):
        return frozenset()
    if parts[:2] == ("web", "src"):
        if len(parts) > 4 and parts[2] == "screens" and parts[3] in SCREEN_SPECS:
            return SCREEN_SPECS[parts[3]] | ALWAYS_SPECS
        return None
    if len(parts) == 3 and parts[:2] == ("web", "e2e") and path.endswith(".spec.ts"):
        return frozenset({parts[2]}) if (root / path).is_file() else None
    return None


def _e2e(paths: Sequence[str], root: Path) -> E2ESelection:
    specs: set[str] = set()
    for path in paths:
        added = _e2e_specs(path, root)
        if added is None:
            return {"mode": "all", "specs": [], "shards": _shards(MAX_SHARDS)}
        specs |= added
    if not specs:
        return {"mode": "skip", "specs": [], "shards": []}
    listed = sorted(f"e2e/{name}" for name in specs)
    return {"mode": "list", "specs": listed, "shards": _shards(min(MAX_SHARDS, len(listed)))}


_QUOTED_WEB = re.compile(r"""["']web["']""")
_QUOTED_SRC = re.compile(r"""["']src["']|web/src""")


def web_readers(always: Sequence[str], areas: Sequence[str], root: Path) -> set[str]:
    """The groups with a test that names `web` and `src` (a shared fixture, a vectors file):
    found from the tests themselves on every run, never listed by hand. Errs toward
    running: an extra group costs minutes, a skipped one hides a failure."""
    readers: set[str] = set()
    for test in (root / "tests").rglob("test_*.py"):
        text = test.read_text(encoding="utf-8")
        if _QUOTED_WEB.search(text) is None or _QUOTED_SRC.search(text) is None:
            continue
        group = _test_group(test.relative_to(root).as_posix(), always, areas)
        if group is not None:
            readers.add(group)
    return readers


def _pytest_groups(
    paths: Sequence[str],
    always: Sequence[str],
    groups: Sequence[str],
    areas_map: Mapping[str, Sequence[str]],
    root: Path,
) -> set[str] | None:
    """The groups the paths affect; None when they affect all."""
    areas = [group for group in groups if group != REST]
    chosen: set[str] = set()
    for path in paths:
        parts = PurePosixPath(path).parts
        if parts[0] == "app":
            if len(parts) < 3 or parts[1] == "shared" or parts[1] not in areas_map:
                return None
            chosen |= {REST, *areas_map[parts[1]]}
            if parts[1] in areas:
                chosen.add(parts[1])
        elif parts[0] == "tests":
            # A helper or fixture (not a `test_*` file) may be imported by any group.
            if not PurePosixPath(path).name.startswith("test_"):
                return None
            group = _test_group(path, always, areas)
            if group is not None:
                chosen.add(group)
        else:
            chosen.add(REST)
            # Data under web/src (not a screen) may be read by a test of any area.
            if parts[:2] == ("web", "src") and parts[2:3] != ("screens",):
                chosen |= web_readers(always, areas, root)
    return {REST, *chosen} if chosen else chosen


def select(
    paths: Sequence[str],
    stack: Mapping[str, object],
    areas_map: Mapping[str, Sequence[str]],
    is_master_push: bool,
    *,
    root: Path = REPO_ROOT,
) -> Selection:
    """What a change runs. Fails open: see the module docstring."""
    always = always_paths(stack)
    groups = groups_for(stack, root)
    if is_master_push or not paths:
        return _everything(groups)
    fallback = cast("Sequence[str]", stack.get("affected_fallback", []))
    known = ("app/", "tests/", "web/src/", "web/e2e/")
    for path in paths:
        if any(fnmatchcase(path, glob) for glob in fallback) or not path.startswith(known):
            return _everything(groups)
    chosen = _pytest_groups(paths, always, groups, areas_map, root)
    if chosen is None:
        chosen = set(groups)
    return {
        "pytest": [group for group in groups if group in chosen],
        "vitest": not all(path.startswith("app/") for path in paths),
        "e2e": _e2e(paths, root),
    }


# --- the area map -----------------------------------------------------------------------


def _executed(data: Path) -> set[tuple[str, str]]:
    """(source file, dynamic context) for every pair the coverage data file recorded."""
    connection = sqlite3.connect(f"file:{data}?mode=ro", uri=True)
    try:
        rows = connection.execute(
            "SELECT DISTINCT f.path, c.context FROM line_bits l"
            " JOIN file f ON f.id = l.file_id JOIN context c ON c.id = l.context_id"
            " UNION SELECT DISTINCT f.path, c.context FROM arc a"
            " JOIN file f ON f.id = a.file_id JOIN context c ON c.id = a.context_id"
        ).fetchall()
    finally:
        connection.close()
    return {(str(path), str(context)) for path, context in rows}


def _area_of(source: str) -> str | None:
    """`app/<X>/...` -> X. The root modules of `app/` and `app/shared` are None: a change
    to them selects all groups, so an edge to them says nothing."""
    parts = PurePosixPath(source.replace("\\", "/")).parts
    indexes = [i for i, part in enumerate(parts[:-1]) if part == "app"]
    if not indexes:
        return None
    relative = parts[indexes[-1] + 1 :]
    if len(relative) < 2 or relative[0] == "shared":
        return None
    return relative[0]


def derive(data: Path, stack: Mapping[str, object], root: Path = REPO_ROOT) -> dict[str, list[str]]:
    """area -> the groups whose tests execute it, from a `--cov-context=test` data file.
    Every phase counts (setup, run and teardown): a fixture that seeds another area over
    HTTP runs in setup, and that edge is what the map exists to catch."""
    always = always_paths(stack)
    areas = area_names(always, root)
    edges: dict[str, set[str]] = {}
    for source, context in _executed(data):
        node, _, phase = context.rpartition("|")
        if phase not in PHASES:
            continue
        area = _area_of(source)
        group = _test_group(node.split("::")[0], always, areas)
        if area is None or group is None:
            continue
        edges.setdefault(area, set()).add(group)
    return {area: sorted(edges[area]) for area in sorted(edges)}


def missing_edges(
    committed: Mapping[str, Sequence[str]], derived: Mapping[str, Sequence[str]]
) -> list[str]:
    """The `area -> group` edges a fresh run found that the committed map lacks."""
    return [
        f"{area} -> {group}"
        for area, groups in sorted(derived.items())
        for group in groups
        if group not in committed.get(area, ())
    ]


def read_areas_map(path: Path = AREAS_MAP_PATH) -> dict[str, list[str]]:
    return cast("dict[str, list[str]]", json.loads(path.read_text()))


# --- the job ----------------------------------------------------------------------------


def run_git(command: Sequence[str]) -> tuple[int, str]:
    completed = subprocess.run(
        list(command), cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )
    return completed.returncode, completed.stdout


def changed_paths(git: Git) -> list[str]:
    """The paths of the merge ref's diff against its first parent; empty when git fails
    (which `select` reads as "everything")."""
    code, output = git(["git", "diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"])
    return [line for line in output.splitlines() if line] if code == 0 else []


def _say(line: str) -> None:
    print(line, file=sys.stderr)


def _outputs(selection: Selection) -> list[str]:
    return [
        f"pytest={json.dumps(selection['pytest'])}",
        f"vitest={json.dumps(selection['vitest'])}",
        f"e2e={json.dumps(selection['e2e'])}",
    ]


def _changes(env: Mapping[str, str], git: Git) -> int:
    event, ref = env.get("GITHUB_EVENT_NAME", ""), env.get("GITHUB_REF", "")
    is_master_push = event == "push" and ref == MASTER_REF
    stack = load_stack()
    try:
        # Anything but a pull request has no merge ref to diff: it runs everything.
        paths = changed_paths(git) if event == "pull_request" else []
        selection = select(paths, stack, read_areas_map(), is_master_push)
    except (OSError, ValueError, KeyError, TypeError):
        _say("changes: could not decide -> everything")
        selection = _everything(groups_for(stack))
    lines = _outputs(selection)
    target = env.get("GITHUB_OUTPUT")
    if target:
        with open(target, "a", encoding="utf-8") as output:
            output.write("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0


def _derive(argv: Sequence[str]) -> int:
    if not 1 <= len(argv) <= 2:
        _say("usage: ci_changes.py derive <coverage-data> [<out.json>]")
        return 2
    out = Path(argv[1]) if len(argv) == 2 else AREAS_MAP_PATH
    derived = derive(Path(argv[0]), load_stack())
    if AREAS_MAP_PATH.is_file():
        for edge in missing_edges(read_areas_map(), derived):
            print(f"::warning::scripts/pytest_areas.json lacks the edge {edge}")
    out.write_text(json.dumps(derived, indent=2) + "\n", encoding="utf-8")
    return 0


def main(argv: Sequence[str], env: Mapping[str, str] | None = None, git: Git = run_git) -> int:
    """`ci_changes.py` selects; `derive <data> [out]` writes the area map;
    `args <group>` prints the pytest arguments of one group."""
    env = os.environ if env is None else env
    if argv[:1] == ["derive"]:
        return _derive(argv[1:])
    if argv[:1] == ["args"] and len(argv) == 2:
        print(shlex.join(pytest_args(argv[1], load_stack())))
        return 0
    if argv:
        _say("usage: ci_changes.py [derive <data> [out] | args <group>]")
        return 2
    return _changes(env, git)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
