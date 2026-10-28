"""Which suites a change runs on GitHub (scripts/ci_changes.py, ADR-0055).

The seams are `select` (a pure function over paths, `stack.yaml` and the area map), `derive`
(the area map from a `--cov-context=test` data file) and the pins that keep the inputs of
both honest: the partition of `tests/`, `SCREEN_SPECS`, the area map and what the front
reads outside `web/`. The acceptance rows run over the real tree; every pin has a pure
`*_problems` function whose rejections are tested on in-memory data."""

from __future__ import annotations

import json
import re
import sqlite3
from collections.abc import Mapping, Sequence
from pathlib import Path, PurePosixPath

import pytest

from scripts.ci_changes import (
    ALWAYS_SPECS,
    FULL_ONLY_SPECS,
    GROUPS,
    REPO_ROOT,
    SCREEN_SPECS,
    Git,
    Selection,
    always_paths,
    area_names,
    changed_paths,
    coverage_artifact,
    derive,
    load_stack,
    main,
    missing_edges,
    pytest_args,
    read_areas_map,
    select,
    web_readers,
)

STACK = load_stack()
AREAS_MAP = read_areas_map()
E2E = REPO_ROOT / "web" / "e2e"
SCREENS = REPO_ROOT / "web" / "src" / "screens"
ALL_SHARDS = ["1/4", "2/4", "3/4", "4/4"]


def sel(
    *paths: str,
    master: bool = False,
    areas_map: Mapping[str, Sequence[str]] = AREAS_MAP,
) -> Selection:
    return select(list(paths), STACK, areas_map, master)


EVERYTHING: Selection = {
    "pytest": list(GROUPS),
    "vitest": True,
    "e2e": {"mode": "all", "specs": [], "shards": ALL_SHARDS},
}


# --- acceptance rows over the real tree ---------------------------------------------------


def test_one_screen_runs_vitest_its_specs_and_mobile_and_no_area_group() -> None:
    selection = sel("web/src/screens/ventas/NuevaVentaCliente.tsx")
    assert selection["vitest"] is True
    assert selection["pytest"] == ["rest"]
    assert selection["e2e"]["mode"] == "list"
    expected = sorted(f"e2e/{name}" for name in SCREEN_SPECS["ventas"] | ALWAYS_SPECS)
    assert selection["e2e"]["specs"] == expected
    assert "e2e/mobile.spec.ts" in selection["e2e"]["specs"]
    assert selection["e2e"]["shards"] == ALL_SHARDS


def test_a_few_specs_get_as_many_shards_as_specs() -> None:
    selection = sel("web/src/screens/onboarding/Listo.tsx")
    assert len(selection["e2e"]["specs"]) == 3
    assert selection["e2e"]["shards"] == ["1/3", "2/3", "3/3"]


def test_a_leaf_area_runs_its_group_and_rest_and_no_e2e() -> None:
    leaf = {**AREAS_MAP, "stock": ["stock"]}
    selection = sel("app/stock/domain/entry.py", areas_map=leaf)
    assert selection["pytest"] == ["stock", "rest"]
    assert selection["vitest"] is False
    assert selection["e2e"] == {"mode": "skip", "specs": [], "shards": []}


def test_an_area_runs_every_group_that_executes_it() -> None:
    selection = sel("app/results/adapters/sql.py")
    assert set(selection["pytest"]) == set(AREAS_MAP["results"]) | {"results", "rest"}
    assert {"results", "stock", "varieties", "payments", "rest"} <= set(selection["pytest"])
    assert "sales" not in selection["pytest"]
    assert selection["e2e"]["mode"] == "skip"
    assert selection["pytest"][-1] == "rest"


def test_a_group_with_no_edge_to_an_area_does_not_run_for_it() -> None:
    assert "accounts" not in sel("app/results/x.py")["pytest"]
    assert "accounts" in sel("app/stock/x.py")["pytest"]


@pytest.mark.parametrize(
    "path",
    [
        ".github/workflows/ci.yml",
        "uv.lock",
        "pyproject.toml",
        "web/package-lock.json",
        "web/playwright.config.ts",
        "web/e2e/fixtures.ts",
        "app/migrations/versions/0001_first.py",
        "app/legacy_front_paths.json",
        "tests/conftest.py",
        "tests/fakes/telegram.py",
        "scripts/affected.py",
    ],
)
def test_a_fallback_path_runs_everything(path: str) -> None:
    assert sel("web/src/screens/ventas/X.tsx", path) == EVERYTHING


def test_a_push_to_master_runs_everything_whatever_changed() -> None:
    assert sel("web/src/screens/ventas/X.tsx", master=True) == EVERYTHING
    assert sel(master=True) == EVERYTHING


def test_the_groups_are_the_areas_and_rest() -> None:
    assert GROUPS[-1] == "rest"
    assert "architecture" not in GROUPS
    assert "migrations" not in GROUPS
    assert {"stock", "sales", "results"} <= set(GROUPS)


# --- it fails open ------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "docs/adr/0055.md",
        "README.md",
        "scripts/ci_changes.py",
        "web/index.html",
        ".agentic/stack.yaml",
    ],
)
def test_an_unknown_path_runs_everything(path: str) -> None:
    assert sel("app/stock/x.py", path) == EVERYTHING


def test_an_empty_diff_runs_everything() -> None:
    assert sel() == EVERYTHING


def test_an_area_the_map_does_not_know_runs_every_group() -> None:
    selection = sel("app/brand_new_area/x.py")
    assert selection["pytest"] == list(GROUPS)
    assert selection["e2e"]["mode"] == "skip"


@pytest.mark.parametrize("path", ["app/main.py", "app/db.py", "app/shared/money.py"])
def test_a_root_module_or_the_shared_kernel_runs_every_group(path: str) -> None:
    selection = sel(path)
    assert selection["pytest"] == list(GROUPS)
    assert selection["vitest"] is False
    assert selection["e2e"]["mode"] == "skip"


def test_a_spec_that_is_gone_runs_the_whole_e2e() -> None:
    assert sel("web/e2e/deleted.spec.ts")["e2e"]["mode"] == "all"


@pytest.mark.parametrize(
    "path",
    [
        "web/src/components/Boton.tsx",
        "web/src/screens/Analisis.tsx",
        "web/src/screens/unmapped/Screen.tsx",
        "web/e2e/helpers/seed.ts",
        "web/e2e/mobile/walk.ts",
    ],
)
def test_a_front_path_no_screen_owns_runs_the_whole_e2e(path: str) -> None:
    selection = sel(path)
    assert selection["e2e"] == {"mode": "all", "specs": [], "shards": ALL_SHARDS}
    assert selection["vitest"] is True


@pytest.mark.parametrize(
    "path",
    [
        "web/src/sales/pricing-matrix.json",
        "web/src/format/periods.vectors.json",
        "web/src/api/fixtures/sale.json",
    ],
)
def test_shared_data_under_web_src_runs_the_groups_whose_tests_read_it(path: str) -> None:
    pytest_groups = sel(path)["pytest"]
    assert {"sales", "results", "rest"} <= set(pytest_groups)
    assert "stock" not in pytest_groups


@pytest.mark.parametrize(
    "path", ["web/src/screens/ventas/X.tsx", "web/e2e/sales.spec.ts", "web/e2e/helpers/seed.ts"]
)
def test_a_screen_or_an_e2e_path_runs_no_area_group(path: str) -> None:
    assert sel(path)["pytest"] == ["rest"]


def test_web_readers_are_found_from_the_tests_themselves(tmp_path: Path) -> None:
    for name in ("a", "b"):
        (tmp_path / "app" / name).mkdir(parents=True)
        (tmp_path / "tests" / name).mkdir(parents=True)
    (tmp_path / "tests" / "a" / "test_reads.py").write_text('ROOT / "web" / "src" / "x.json"\n')
    (tmp_path / "tests" / "b" / "test_pure.py").write_text("def test_it() -> None: ...\n")
    (tmp_path / "tests" / "b" / "test_web_only.py").write_text('ROOT / "web" / "dist"\n')
    (tmp_path / "tests" / "test_root.py").write_text('ROOT / "web" / "src"\n')
    (tmp_path / "tests" / "architecture").mkdir()
    (tmp_path / "tests" / "architecture" / "test_a.py").write_text("web/src\n'web'\n")
    assert web_readers(["tests/architecture"], ["a", "b"], tmp_path) == {"a", "rest"}


def test_a_changed_spec_selects_itself() -> None:
    selection = sel("web/e2e/sales.spec.ts")
    assert selection["e2e"] == {"mode": "list", "specs": ["e2e/sales.spec.ts"], "shards": ["1/1"]}


def test_a_spec_and_a_screen_select_both() -> None:
    selection = sel("web/e2e/barFit.spec.ts", "web/src/screens/onboarding/Listo.tsx")
    assert "e2e/barFit.spec.ts" in selection["e2e"]["specs"]
    assert "e2e/onboarding.spec.ts" in selection["e2e"]["specs"]


def test_an_app_change_beside_a_screen_still_runs_the_screens_e2e() -> None:
    selection = sel("app/stock/x.py", "web/src/screens/onboarding/Listo.tsx")
    assert selection["e2e"]["mode"] == "list"
    assert selection["vitest"] is True
    assert "stock" in selection["pytest"]


def test_a_test_file_runs_its_group_and_rest_and_an_always_test_only_the_test_job() -> None:
    assert sel("tests/sales/test_sale.py")["pytest"] == ["sales", "rest"]
    assert sel("tests/test_serving.py")["pytest"] == ["rest"]
    assert sel("tests/design/test_x.py")["pytest"] == ["rest"]
    assert sel("tests/architecture/test_architecture.py")["pytest"] == []
    assert sel("tests/test_stack_ci.py")["e2e"]["mode"] == "skip"


def test_a_test_helper_may_be_imported_by_any_group() -> None:
    assert sel("tests/contract_shapes.py")["pytest"] == list(GROUPS)
    assert sel("tests/sales/helpers.py")["pytest"] == list(GROUPS)


# --- the job ------------------------------------------------------------------------------


def _git(code: int, output: str = "") -> Git:
    def run(command: Sequence[str]) -> tuple[int, str]:
        assert list(command) == ["git", "diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"]
        return code, output

    return run


def _outputs(env: dict[str, str], git: Git, tmp_path: Path) -> dict[str, object]:
    target = tmp_path / "output"
    assert main([], {**env, "GITHUB_OUTPUT": str(target)}, git) == 0
    written = dict(line.split("=", 1) for line in target.read_text().splitlines())
    return {name: json.loads(value) for name, value in written.items()}


PULL_REQUEST = {"GITHUB_EVENT_NAME": "pull_request", "GITHUB_REF": "refs/pull/1/merge"}


def test_a_pull_request_diff_is_read_from_the_merge_ref(tmp_path: Path) -> None:
    written = _outputs(PULL_REQUEST, _git(0, "app/results/x.py\n"), tmp_path)
    assert written["vitest"] is False
    assert written["pytest"] == sel("app/results/x.py")["pytest"]
    assert written["e2e"] == {"mode": "skip", "specs": [], "shards": []}


@pytest.mark.parametrize(
    ("env", "git"),
    [
        (PULL_REQUEST, _git(128, "")),
        (PULL_REQUEST, _git(0, "")),
        (PULL_REQUEST, _git(0, "\n")),
        ({"GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/master"}, _git(0, "app/x.py\n")),
        ({"GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/other"}, _git(0, "app/x.py\n")),
        ({"GITHUB_EVENT_NAME": "workflow_dispatch"}, _git(0, "app/x.py\n")),
        ({}, _git(0, "app/x.py\n")),
    ],
)
def test_a_git_error_an_empty_diff_or_no_pull_request_runs_everything(
    env: dict[str, str], git: Git, tmp_path: Path
) -> None:
    assert _outputs(env, git, tmp_path) == {
        "pytest": list(GROUPS),
        "vitest": True,
        "e2e": {"mode": "all", "specs": [], "shards": ALL_SHARDS},
    }


def test_changed_paths_is_empty_when_git_fails() -> None:
    assert changed_paths(_git(1, "app/x.py\n")) == []
    assert changed_paths(_git(0, "a\n\nb\n")) == ["a", "b"]


def test_main_refuses_an_unknown_argument() -> None:
    assert main(["bogus"], {}) == 2


def test_main_prints_the_pytest_arguments_of_a_group(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["args", "stock"]) == 0
    assert capsys.readouterr().out.strip() == "tests/stock"


def test_the_coverage_artifact_of_each_group_has_its_own_name() -> None:
    names = {coverage_artifact(group) for group in GROUPS}
    assert len(names) == len(GROUPS)
    assert coverage_artifact("stock") == "coverage-pytest-stock"


# --- derive: the area map from a --cov-context=test run ------------------------------------

APP = "/runner/work/repo/repo/app"


def _coverage_data(tmp_path: Path, rows: Sequence[tuple[str, str, str]]) -> Path:
    """A coverage.py data file (its documented SQLite schema) with (table, file, context)
    rows: `line_bits` for line coverage, `arc` for branch coverage."""
    path = tmp_path / ".coverage"
    connection = sqlite3.connect(path)
    connection.executescript(
        "CREATE TABLE file (id INTEGER PRIMARY KEY, path TEXT);"
        "CREATE TABLE context (id INTEGER PRIMARY KEY, context TEXT);"
        "CREATE TABLE line_bits (file_id INTEGER, context_id INTEGER, numbits BLOB);"
        "CREATE TABLE arc (file_id INTEGER, context_id INTEGER, fromno INTEGER, tono INTEGER);"
    )
    files: dict[str, int] = {}
    contexts: dict[str, int] = {}
    for table, source, context in rows:
        file_id = files.setdefault(source, len(files) + 1)
        context_id = contexts.setdefault(context, len(contexts) + 1)
        connection.execute("INSERT OR IGNORE INTO file VALUES (?, ?)", (file_id, source))
        connection.execute("INSERT OR IGNORE INTO context VALUES (?, ?)", (context_id, context))
        if table == "line_bits":
            connection.execute("INSERT INTO line_bits VALUES (?, ?, x'02')", (file_id, context_id))
        else:
            connection.execute("INSERT INTO arc VALUES (?, ?, 1, 2)", (file_id, context_id))
    connection.commit()
    connection.close()
    return path


def _derived(tmp_path: Path, *rows: tuple[str, str, str]) -> dict[str, list[str]]:
    return derive(_coverage_data(tmp_path, rows), STACK)


def test_a_fixture_that_seeds_another_area_during_setup_produces_the_edge(tmp_path: Path) -> None:
    derived = _derived(
        tmp_path,
        ("line_bits", f"{APP}/stock/service.py", "tests/sales/test_sale.py::test_a|setup"),
    )
    assert derived == {"stock": ["sales"]}


@pytest.mark.parametrize("phase", ["setup", "run", "teardown"])
def test_every_test_phase_counts(tmp_path: Path, phase: str) -> None:
    derived = _derived(
        tmp_path, ("line_bits", f"{APP}/stock/a.py", f"tests/results/test_x.py::test_a|{phase}")
    )
    assert derived == {"stock": ["results"]}


def test_branch_coverage_arcs_count_like_lines(tmp_path: Path) -> None:
    derived = _derived(tmp_path, ("arc", f"{APP}/stock/a.py", "tests/results/test_x.py::t|run"))
    assert derived == {"stock": ["results"]}


def test_only_the_root_modules_and_the_shared_kernel_are_left_out(tmp_path: Path) -> None:
    context = "tests/sales/test_sale.py::test_a|run"
    derived = _derived(
        tmp_path,
        ("line_bits", f"{APP}/main.py", context),
        ("line_bits", f"{APP}/__init__.py", context),
        ("line_bits", f"{APP}/shared/money.py", context),
        ("line_bits", f"{APP}/shared/nested/deep.py", context),
        ("line_bits", f"{APP}/customers/api.py", context),
        ("line_bits", f"{APP}/customers/adapters/sql.py", context),
        ("line_bits", f"{APP}/migrations/env.py", context),
        ("line_bits", "/venv/lib/site-packages/sqlalchemy/engine.py", context),
    )
    assert derived == {"customers": ["sales"], "migrations": ["sales"]}


def test_a_relative_path_and_a_checkout_in_a_directory_named_app_both_read(
    tmp_path: Path,
) -> None:
    context = "tests/sales/test_sale.py::test_a|run"
    derived = _derived(
        tmp_path,
        ("line_bits", "app/stock/a.py", context),
        ("line_bits", "/home/app/work/app/payments/b.py", context),
    )
    assert derived == {"payments": ["sales"], "stock": ["sales"]}


def test_collection_time_lines_and_the_always_tests_are_not_edges(tmp_path: Path) -> None:
    derived = _derived(
        tmp_path,
        ("line_bits", f"{APP}/stock/a.py", ""),
        ("line_bits", f"{APP}/stock/a.py", "tests/architecture/test_a.py::test_a|run"),
        ("line_bits", f"{APP}/stock/a.py", "tests/migrations/test_naming.py::test_a|run"),
        ("line_bits", f"{APP}/stock/a.py", "tests/test_stack_ci.py::test_a|run"),
        ("line_bits", f"{APP}/stock/a.py", "tests/sales/test_sale.py::test_a|bogus"),
    )
    assert derived == {}


def test_tests_that_belong_to_no_area_are_the_rest_group(tmp_path: Path) -> None:
    derived = _derived(
        tmp_path,
        ("line_bits", f"{APP}/stock/a.py", "tests/test_serving.py::test_a|run"),
        ("line_bits", f"{APP}/stock/a.py", "tests/design/test_x.py::test_a|run"),
        ("line_bits", f"{APP}/stock/a.py", "tests/stock/test_entry.py::test_a|run"),
    )
    assert derived == {"stock": ["rest", "stock"]}


def test_a_derived_edge_the_committed_map_lacks_is_reported() -> None:
    derived = {"stock": ["sales", "stock"], "sales": ["sales"]}
    assert missing_edges({"stock": ["stock"], "sales": ["sales"]}, derived) == ["stock -> sales"]
    assert missing_edges(derived, derived) == []
    assert missing_edges({}, derived) == ["sales -> sales", "stock -> sales", "stock -> stock"]


def test_derive_from_the_command_line_writes_the_map_and_warns_of_a_missing_edge(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    data = _coverage_data(
        tmp_path, [("line_bits", f"{APP}/results/a.py", "tests/accounts/test_x.py::t|setup")]
    )
    out = tmp_path / "areas.json"
    assert main(["derive", str(data), str(out)]) == 0
    assert json.loads(out.read_text()) == {"results": ["accounts"]}
    assert "::warning::scripts/pytest_areas.json lacks the edge results -> accounts" in (
        capsys.readouterr().out
    )
    assert main(["derive"]) == 2


# --- pin: the partition of tests/ ----------------------------------------------------------


def partition_problems(
    listing: Sequence[str], always: Sequence[str], areas: Sequence[str], rest_ignores: Sequence[str]
) -> list[str]:
    """What keeps `tests/` from being "always" ∪ areas ∪ "rest" with no overlap: every
    "always" path exists, no area is an "always" path, and `rest` ignores exactly the
    "always" paths and the areas."""
    problems: list[str] = []
    problems.extend(f"always path {path} does not exist" for path in always if path not in listing)
    problems.extend(
        f"area {area} is also an always path" for area in areas if f"tests/{area}" in always
    )
    expected = {*always, *(f"tests/{area}" for area in areas)}
    problems.extend(f"rest does not ignore {path}" for path in sorted(expected - set(rest_ignores)))
    problems.extend(
        f"rest ignores {path}, which is no group" for path in sorted(set(rest_ignores) - expected)
    )
    return problems


def _tests_listing() -> list[str]:
    """The files and directories of `tests/`, and the files one level down."""
    root = REPO_ROOT / "tests"
    return sorted(
        child.relative_to(REPO_ROOT).as_posix()
        for child in root.rglob("*")
        if "__pycache__" not in child.parts and len(child.relative_to(root).parts) <= 2
    )


def _rest_ignores() -> list[str]:
    return [arg.removeprefix("--ignore=") for arg in pytest_args("rest", STACK)[1:]]


def test_tests_is_the_always_paths_plus_the_areas_plus_rest() -> None:
    always = always_paths(STACK)
    areas = area_names(always)
    assert partition_problems(_tests_listing(), always, areas, _rest_ignores()) == []
    assert list(GROUPS) == [*areas, "rest"]
    top = {
        path.name
        for path in (REPO_ROOT / "tests").iterdir()
        if path.name != "__pycache__" and (path.is_dir() or path.name.startswith("test_"))
    }
    ignored = {PurePosixPath(path).parts[1] for path in _rest_ignores()}
    in_rest = top - ignored
    assert not in_rest & set(areas)
    assert set(areas) <= ignored
    assert {"test_serving.py", "design", "operator_copy"} <= in_rest


def test_the_partition_pin_rejects_a_missing_overlapping_or_unignored_path() -> None:
    listing = ["tests/a", "tests/b", "tests/c.py"]
    assert partition_problems(listing, ["tests/a"], ["b"], ["tests/a", "tests/b"]) == []
    assert partition_problems(listing, ["tests/gone"], ["b"], ["tests/gone", "tests/b"]) == [
        "always path tests/gone does not exist"
    ]
    assert partition_problems(listing, ["tests/b"], ["b"], ["tests/b"]) == [
        "area b is also an always path"
    ]
    assert partition_problems(listing, ["tests/a"], ["b"], ["tests/a"]) == [
        "rest does not ignore tests/b"
    ]
    assert partition_problems(
        listing, ["tests/a"], ["b"], ["tests/a", "tests/b", "tests/c.py"]
    ) == ["rest ignores tests/c.py, which is no group"]


def test_a_group_has_pytest_arguments_and_an_unknown_one_is_refused() -> None:
    assert pytest_args("stock", STACK) == ["tests/stock"]
    rest = pytest_args("rest", STACK)
    assert rest[0] == "tests"
    assert "--ignore=tests/architecture" in rest
    assert "--ignore=tests/stock" in rest
    with pytest.raises(ValueError, match="unknown pytest group"):
        pytest_args("architecture", STACK)


def test_the_always_set_is_read_from_the_tests_fast_command() -> None:
    always = always_paths(STACK)
    assert "tests/architecture" in always
    assert "tests/test_stack_ci.py" in always
    swapped = {"checks": {"tests-fast": "uv run pytest -n 2 tests/design tests/sales"}}
    assert always_paths(swapped) == ["tests/design", "tests/sales"]
    assert select(["tests/sales/test_sale.py"], swapped, AREAS_MAP, False)["pytest"] == []


# --- pin: the pytest area map ------------------------------------------------------------


def area_map_problems(
    areas_map: Mapping[str, Sequence[str]], app_areas: Sequence[str], groups: Sequence[str]
) -> list[str]:
    """What keeps the committed map from being usable: an unknown group, an area that is
    no `app/` directory and an `app/` area with no entry (which `select` would read as
    "unknown, run everything")."""
    problems: list[str] = []
    for area, executed_by in areas_map.items():
        if area not in app_areas:
            problems.append(f"{area} is not a directory of app/")
        problems.extend(
            f"{area} names the unknown group {g}" for g in executed_by if g not in groups
        )
    problems.extend(f"app/{area} has no entry" for area in app_areas if area not in areas_map)
    return problems


def _app_areas() -> list[str]:
    return sorted(
        child.name
        for child in (REPO_ROOT / "app").iterdir()
        if child.is_dir() and child.name not in {"shared", "__pycache__"}
    )


def test_the_committed_area_map_covers_every_app_area() -> None:
    assert area_map_problems(AREAS_MAP, _app_areas(), GROUPS) == []


def test_the_area_map_pin_rejects_what_select_could_not_use() -> None:
    assert area_map_problems({"stock": ["stock", "rest"]}, ["stock"], GROUPS) == []
    assert area_map_problems({"gone": ["stock"]}, ["stock"], GROUPS) == [
        "gone is not a directory of app/",
        "app/stock has no entry",
    ]
    assert area_map_problems({"stock": ["bogus"]}, ["stock"], GROUPS) == [
        "stock names the unknown group bogus"
    ]


# --- pin: SCREEN_SPECS -----------------------------------------------------------------------


def screen_spec_problems(
    screens: Sequence[str],
    specs_on_disk: Sequence[str],
    mapping: Mapping[str, frozenset[str]],
    always: frozenset[str],
    full_only: frozenset[str],
) -> list[str]:
    """What keeps `SCREEN_SPECS` from naming the specs a screen change must run: a screen
    directory it does not list, a mapped spec that does not exist, and a spec that is
    neither mapped nor in the always-full set."""
    problems = [
        f"screen {screen} is not in SCREEN_SPECS" for screen in screens if screen not in mapping
    ]
    problems.extend(
        f"{screen} maps no screen directory" for screen in mapping if screen not in screens
    )
    mapped = {spec for specs in mapping.values() for spec in specs}
    problems.extend(
        f"spec {spec} does not exist"
        for spec in sorted({*mapped, *always, *full_only} - set(specs_on_disk))
    )
    problems.extend(
        f"spec {spec} is neither mapped nor in the always-full set"
        for spec in sorted(set(specs_on_disk) - mapped - always - full_only)
    )
    problems.extend(
        f"spec {spec} is both mapped and full-only" for spec in sorted(mapped & full_only)
    )
    return problems


def test_screen_specs_names_every_screen_and_every_spec() -> None:
    screens = sorted(p.name for p in SCREENS.iterdir() if p.is_dir())
    specs = sorted(p.name for p in E2E.glob("*.spec.ts"))
    assert screen_spec_problems(screens, specs, SCREEN_SPECS, ALWAYS_SPECS, FULL_ONLY_SPECS) == []


def test_the_screen_specs_pin_rejects_each_way_the_map_can_go_stale() -> None:
    def problems(
        screens: Sequence[str], specs: Sequence[str], mapping: Mapping[str, frozenset[str]]
    ) -> list[str]:
        return screen_spec_problems(
            screens, specs, mapping, frozenset(), frozenset({"full.spec.ts"})
        )

    good = {"a": frozenset({"a.spec.ts"})}
    assert problems(["a"], ["a.spec.ts", "full.spec.ts"], good) == []
    assert problems(["a", "b"], ["a.spec.ts", "full.spec.ts"], good) == [
        "screen b is not in SCREEN_SPECS"
    ]
    assert problems(["a"], ["full.spec.ts"], good) == ["spec a.spec.ts does not exist"]
    assert problems(["a"], ["a.spec.ts", "full.spec.ts", "new.spec.ts"], good) == [
        "spec new.spec.ts is neither mapped nor in the always-full set"
    ]
    assert problems([], ["a.spec.ts", "full.spec.ts"], good) == ["a maps no screen directory"]
    both = {"a": frozenset({"a.spec.ts", "full.spec.ts"})}
    assert problems(["a"], ["a.spec.ts", "full.spec.ts"], both) == [
        "spec full.spec.ts is both mapped and full-only"
    ]


def test_every_screen_change_selects_the_specs_of_its_directory() -> None:
    for screen in sorted(p.name for p in SCREENS.iterdir() if p.is_dir()):
        selection = sel(f"web/src/screens/{screen}/Anything.tsx")
        expected = sorted(f"e2e/{spec}" for spec in SCREEN_SPECS[screen] | ALWAYS_SPECS)
        assert selection["e2e"]["specs"] == expected


# --- pin: what the front reads outside web/ ----------------------------------------------------

_RELATIVE = re.compile(r"""(?:from|import|glob)\s*\(?\s*['"](\.{1,2}/[^'"]+)['"]""")
_FROM_CWD = re.compile(r"""['"]\.\.['"]\s*,\s*['"]([^'".][^'"]*)['"]""")
_UP = re.compile(r"""['"](\.\.(?:/[^'"]*)?)['"]""")
_UP_SEGMENTS = re.compile(r"""((?:['"]\.\.['"]\s*,\s*)+)['"]([^'"]*)['"]""")


def _outside(directory: PurePosixPath, specifier: str) -> str | None:
    """`specifier` resolved from `directory`, or None while it stays inside `web/`."""
    parts: list[str] = []
    for part in [*directory.parts, *PurePosixPath(specifier).parts]:
        if part == "..":
            if parts:
                parts.pop()
        elif part != ".":
            parts.append(part)
    return "/".join(parts) if parts and parts[0] != "web" else None


def outside_reads(files: Mapping[str, str]) -> list[str]:
    """The repo paths (outside `web/`) that the files of `web/src` reach by a relative
    import, a glob or `resolve(process.cwd(), '..', '<path>')`. Keys are repo-relative."""
    reached: set[str] = set()
    for name, text in files.items():
        directory = PurePosixPath(name).parent
        specifiers = list(_RELATIVE.findall(text))
        if "__dirname" in text or "import.meta.url" in text:
            specifiers += _UP.findall(text)
            specifiers += [
                "../" * ups.count("..") + tail for ups, tail in _UP_SEGMENTS.findall(text)
            ]
        reached.update(path for s in specifiers if (path := _outside(directory, s)) is not None)
        reached.update(_FROM_CWD.findall(text))
    return sorted(reached)


def app_reads(reads: Sequence[str]) -> list[str]:
    return [
        path for path in reads if path.startswith("app/") and path != "app/legacy_front_paths.json"
    ]


def test_the_front_reads_no_app_path_but_the_legacy_paths_file() -> None:
    """Vitest is skipped for a change that is only under `app/`: that is sound only while the
    unit tests read nothing there (the one exception is a fallback path)."""
    files = {
        path.relative_to(REPO_ROOT).as_posix(): path.read_text()
        for path in (REPO_ROOT / "web" / "src").rglob("*.ts*")
        if path.is_file()
    }
    reads = outside_reads(files)
    assert "app/legacy_front_paths.json" in reads
    assert app_reads(reads) == []


def test_the_outside_reads_pin_rejects_a_front_file_that_reads_app() -> None:
    files = {
        "web/src/x/a.test.ts": "import f from '../../../app/some_table.json'\n",
        "web/src/y/b.test.ts": "resolve(process.cwd(), '..', 'app/stock/domain.py')\n",
        "web/src/w/d.test.ts": "resolve(__dirname, '../../../app/other.json')\n",
        "web/src/v/e.test.ts": "new URL('../../../app/viaurl.json', import.meta.url)\n"
        "join(__dirname, '..', '..', '..', 'app/joined.json')\n",
        "web/src/z/c.test.ts": "import g from '../../../tests/fixtures/spanish_copy.json'\n"
        "const l = resolve(process.cwd(), '..', 'app/legacy_front_paths.json')\n"
        "import d from '../d'\n",
    }
    reads = outside_reads(files)
    assert reads == [
        "app/joined.json",
        "app/legacy_front_paths.json",
        "app/other.json",
        "app/some_table.json",
        "app/stock/domain.py",
        "app/viaurl.json",
        "tests/fixtures/spanish_copy.json",
    ]
    assert app_reads(reads) == [
        "app/joined.json",
        "app/other.json",
        "app/some_table.json",
        "app/stock/domain.py",
        "app/viaurl.json",
    ]
