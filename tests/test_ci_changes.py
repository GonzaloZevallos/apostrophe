"""`scripts/ci_changes.py` (GH-448, ADR-0064): the selection of suites from the changed paths, the
reader map, the diff command and the thin `main`, over a `tmp_path` tree and the real repository."""

from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.affected import REPO_ROOT, CommandResult
from scripts.ci_areas import ALWAYS_DIRS, areas
from scripts.ci_changes import (
    MOBILE_PAIR,
    SELECTOR_INPUTS,
    Selection,
    diff_argv,
    main,
    paths_from_git,
    pytest_readers,
    render,
    select,
    unanchored_reads,
)

ROOT_LINE = "ROOT = Path(__file__).resolve().parents[1]\n"
ROOT_FROM_AREA = "ROOT = Path(__file__).resolve().parents[2]\n"
FALLBACK = ["uv.lock", "web/src/test-setup.ts", "scripts/ci_changes.py"]
MOBILE = sorted(MOBILE_PAIR)


def write(root: Path, relative: str, text: str = "") -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def make_tree(root: Path) -> Path:
    """Three areas (`sales` imports `catalog`), always tests, a helper, a screen map, two guards
    and a pytest of `pinned_catalog` that reads one screen data file."""
    stack = "affected_fallback:\n" + "".join(f"  - {glob}\n" for glob in FALLBACK)
    write(root, ".agentic/stack.yaml", "name: x\n" + stack + "design:\n  entry: a\n")
    for area in ("catalog", "sales", "pinned_catalog"):
        write(root, f"app/{area}/__init__.py")
    write(root, "app/catalog/data.py")
    write(root, "app/sales/service.py", "from app.catalog import data\n")
    write(root, "app/pinned_catalog/service.py")
    write(root, "app/main.py")
    for area in ("catalog", "sales", "pinned_catalog"):
        write(root, f"tests/{area}/test_{area}.py", "def test_one() -> None: ...\n")
    write(
        root,
        "tests/pinned_catalog/test_cases.py",
        "from pathlib import Path\n"
        + ROOT_FROM_AREA
        + "CASES = ROOT / 'web' / 'src' / 'screens' / 'cases.json'\n"
        + "def test_cases() -> None:\n    CASES.read_text()\n",
    )
    write(root, "tests/architecture/test_arch.py", "def test_arch() -> None: ...\n")
    write(root, "tests/test_top.py", "def test_top() -> None: ...\n")
    write(root, "tests/helper.py", "VALUE = 1\n")
    write(root, "web/src/screens/Foo.tsx")
    write(root, "web/src/screens/Foo.test.tsx")
    write(root, "web/src/screens/cases.json", "{}")
    write(root, "web/src/screens/notes.ts")
    write(root, "web/src/screens/clientes/Clientes.tsx")
    write(root, "web/src/screens/Unmapped.tsx")
    write(root, "web/src/App.tsx")
    write(root, "web/src/components/Icono.tsx")
    write(root, "web/src/guard.test.ts", "readFileSync('x')\n")
    write(root, "web/src/plain.test.ts", "expect(1)\n")
    write(root, "web/src/test-setup.ts")
    for spec in ("foo", "other", "mobile"):
        write(root, f"web/e2e/{spec}.spec.ts")
    write(root, "web/e2e/mobile.setup.ts")
    write(root, "web/e2e/helpers/seed.ts")
    screens = {"Foo": ["web/e2e/foo.spec.ts"], "clientes": [], "Unmapped2": []}
    write(root, "scripts/e2e_screen_specs.json", json.dumps(screens))
    return root


def selected(paths: Sequence[str] | None, root: Path) -> Selection:
    return select(paths, root)


def shards(selection: Selection) -> list[str]:
    return [entry["shard"] for entry in selection.pytest_matrix]


def dirs(selection: Selection) -> set[str]:
    found: set[str] = set()
    for entry in selection.pytest_matrix:
        if entry["shard"] != "always":
            found.update(p.removeprefix("tests/") for p in entry["paths"].split())
    return found


def everything(selection: Selection) -> bool:
    return (
        selection.pytest
        and selection.vitest
        and selection.e2e
        and selection.vitest_all
        and dirs(selection) == {"catalog", "sales", "pinned_catalog"}
        and sorted(selection.e2e_specs)
        == [
            "web/e2e/foo.spec.ts",
            "web/e2e/mobile.setup.ts",
            "web/e2e/mobile.spec.ts",
            "web/e2e/other.spec.ts",
        ]
    )


# --- the named acceptance rows ------------------------------------------------------------------


def test_one_screen_selects_vitest_and_its_specs_not_pytest(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    result = selected(["web/src/screens/Foo.tsx"], root)

    assert result.vitest and result.vitest_changed
    assert not result.pytest
    assert result.pytest_matrix == []
    assert result.e2e_specs == ["web/e2e/foo.spec.ts", *MOBILE]
    assert result.e2e_shards == 2
    assert result.vitest_files == ["src/guard.test.ts"]


def test_a_screen_data_file_read_by_a_pytest_selects_that_area(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    result = selected(["web/src/screens/cases.json"], root)

    assert shards(result) == ["always", "areas-1"]
    assert dirs(result) == {"pinned_catalog"}


def test_one_area_selects_its_closure_and_no_e2e(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    result = selected(["app/catalog/data.py"], root)

    assert dirs(result) == {"catalog", "sales"}
    assert not result.e2e and result.e2e_specs == [] and result.e2e_shards == 0
    assert not result.vitest


def test_a_fallback_path_selects_everything(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    assert everything(selected(["uv.lock"], root))
    assert everything(selected(["scripts/ci_changes.py", "web/src/App.tsx"], root))


def test_a_push_to_master_selects_everything(tmp_path: Path) -> None:
    root = make_tree(tmp_path)
    runner = FakeRunner(CommandResult(0, "web/src/App.tsx\n"))

    assert main(["push"], runner, root=root) == 0

    assert runner.commands == []
    assert everything(selected(None, root))


# --- path cases ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    ["foo/bar.xyz", "web/src/test-setup.ts", ".agentic/stack.yaml", "web/e2e/mobile.setup.ts"],
)
def test_a_path_that_matches_no_rule_or_is_a_selector_input_selects_everything(
    tmp_path: Path, path: str
) -> None:
    assert everything(selected([path], make_tree(tmp_path)))


def test_everything_is_selected_when_one_path_of_many_matches_no_rule(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    assert everything(selected(["docs/adr/x.md", "foo/bar.xyz"], root))


def test_a_stack_file_without_fallback_globs_selects_everything(tmp_path: Path) -> None:
    root = make_tree(tmp_path)
    write(root, ".agentic/stack.yaml", "name: x\n")

    assert everything(selected(["docs/adr/x.md"], root))


@pytest.mark.parametrize("path", ["docs/product/design-system/x.md", "scripts/design/screens.json"])
def test_a_design_path_gives_the_always_shard_and_the_mobile_pair(
    tmp_path: Path, path: str
) -> None:
    result = selected([path], make_tree(tmp_path))

    assert shards(result) == ["always"]
    assert result.e2e_specs == MOBILE
    assert result.e2e_shards == 1


@pytest.mark.parametrize(
    ("path", "guards"),
    [
        ("docs/adr/x.md", True),
        ("README.md", True),
        (".agentic/tasks/GH-1.md", True),
        ("deploy/x", False),
        ("scripts/docs/x.py", False),
        ("alembic.ini", False),
        ("render.yaml", False),
        ("scripts/other.py", False),
    ],
)
def test_a_docs_or_scripts_path_selects_the_always_shard_only(
    tmp_path: Path, path: str, guards: bool
) -> None:
    result = selected([path], make_tree(tmp_path))

    assert shards(result) == ["always"]
    assert result.e2e_specs == [] and not result.e2e
    assert result.vitest_files == (["src/guard.test.ts"] if guards else [])
    assert result.vitest is guards


def test_a_json_under_an_area_selects_the_closure_of_that_area(tmp_path: Path) -> None:
    root = make_tree(tmp_path)
    write(root, "app/catalog/seed.json", "{}")

    result = selected(["app/catalog/seed.json"], root)

    assert dirs(result) == {"catalog", "sales"}


def test_a_path_under_app_outside_any_area_selects_every_area_and_no_e2e(tmp_path: Path) -> None:
    result = selected(["app/main.py"], make_tree(tmp_path))

    assert dirs(result) == {"catalog", "sales", "pinned_catalog"}
    assert not result.e2e and not result.vitest


def test_a_test_directory_of_an_area_selects_that_area_only(tmp_path: Path) -> None:
    result = selected(["tests/catalog/test_catalog.py"], make_tree(tmp_path))

    assert dirs(result) == {"catalog"}


def test_an_always_test_selects_only_the_always_shard(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    assert shards(selected(["tests/architecture/test_arch.py"], root)) == ["always"]
    assert shards(selected(["tests/test_top.py"], root)) == ["always"]


def test_a_top_level_test_helper_selects_every_area(tmp_path: Path) -> None:
    result = selected(["tests/helper.py"], make_tree(tmp_path))

    assert dirs(result) == {"catalog", "sales", "pinned_catalog"}


def test_a_vitest_test_alone_selects_only_itself(tmp_path: Path) -> None:
    result = selected(["web/src/screens/Foo.test.tsx"], make_tree(tmp_path))

    assert result.vitest_files == ["src/screens/Foo.test.tsx"]
    assert result.vitest and not result.vitest_changed
    assert not result.e2e and not result.pytest


def test_a_screen_helper_or_an_unmapped_screen_selects_all_e2e(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    for path in ("web/src/screens/notes.ts", "web/src/screens/Unmapped.tsx"):
        assert len(selected([path], root).e2e_specs) == 4


def test_a_screen_with_no_spec_still_selects_the_mobile_pair(tmp_path: Path) -> None:
    result = selected(["web/src/screens/clientes/Clientes.tsx"], make_tree(tmp_path))

    assert result.e2e_specs == MOBILE


def test_any_other_web_src_path_selects_all_e2e_and_vitest_but_no_pytest(tmp_path: Path) -> None:
    result = selected(["web/src/App.tsx"], make_tree(tmp_path))

    assert len(result.e2e_specs) == 4 and result.e2e_shards == 3
    assert result.vitest and result.vitest_changed and not result.pytest


def test_an_e2e_spec_selects_itself_and_a_helper_selects_all_e2e(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    assert selected(["web/e2e/other.spec.ts"], root).e2e_specs == ["web/e2e/other.spec.ts"]
    assert len(selected(["web/e2e/helpers/seed.ts"], root).e2e_specs) == 4
    assert not selected(["web/e2e/other.spec.ts"], root).vitest


def test_a_public_asset_selects_all_vitest_and_all_e2e(tmp_path: Path) -> None:
    root = make_tree(tmp_path)
    write(root, "web/public/icon.svg")

    result = selected(["web/public/icon.svg"], root)

    assert result.vitest_all and result.vitest and len(result.e2e_specs) == 4


def test_a_screen_asset_with_no_reader_selects_no_pytest_and_a_removed_spec_nothing(
    tmp_path: Path,
) -> None:
    root = make_tree(tmp_path)

    assert not selected(["web/src/components/Icono.tsx"], root).pytest
    assert not selected(["web/e2e/gone.spec.ts"], root).e2e


def test_no_shard_is_ever_empty(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    for paths in (["docs/adr/x.md"], ["app/catalog/data.py"], ["web/src/App.tsx"], None):
        result = selected(paths, root)
        assert all(entry["paths"].strip() for entry in result.pytest_matrix)
        assert result.e2e_shards == min(4, sum(s.endswith(".spec.ts") for s in result.e2e_specs))


# --- the diff and git ---------------------------------------------------------------------------


def test_only_a_pull_request_builds_a_diff_command() -> None:
    assert diff_argv("pull_request") == [
        "git",
        "diff",
        "--name-only",
        "--no-renames",
        "HEAD^1",
        "HEAD",
    ]
    for event in ("push", "workflow_dispatch", "merge_group", "schedule", ""):
        assert diff_argv(event) is None


def test_a_git_failure_or_an_empty_diff_selects_everything(tmp_path: Path) -> None:
    root = make_tree(tmp_path)

    assert paths_from_git(128, "app/main.py\n") is None
    assert paths_from_git(0, "") is None
    assert paths_from_git(0, "\n") is None
    assert paths_from_git(0, "b.py\na.py\na.py\n") == ["a.py", "b.py"]
    assert everything(selected(paths_from_git(1, ""), root))


class FakeRunner:
    def __init__(self, result: CommandResult) -> None:
        self.result = result
        self.commands: list[list[str]] = []

    def __call__(
        self, command: Sequence[str], *, capture: bool, cwd: Path = REPO_ROOT
    ) -> CommandResult:
        self.commands.append(list(command))
        return self.result


def outputs(lines: Sequence[str]) -> dict[str, str]:
    return {key: value for key, _, value in (line.partition("=") for line in lines)}


def run_main(
    event: str, result: CommandResult, root: Path, capsys: pytest.CaptureFixture[str]
) -> tuple[FakeRunner, dict[str, str]]:
    runner = FakeRunner(result)
    assert main([event], runner, root=root) == 0
    return runner, outputs(capsys.readouterr().out.splitlines())


def test_main_runs_the_diff_for_a_pull_request_and_prints_the_outputs(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = make_tree(tmp_path)

    runner, printed = run_main(
        "pull_request", CommandResult(0, "app/catalog/data.py\n"), root, capsys
    )

    assert runner.commands == [diff_argv("pull_request")]
    assert printed["pytest"] == "true"
    assert printed["vitest"] == "false"
    assert printed["e2e"] == "false"
    assert printed["e2e_shards"] == "0"
    assert json.loads(printed["vitest_files"]) == []
    assert json.loads(printed["e2e_specs"]) == []
    matrix = json.loads(printed["pytest_matrix"])["include"]
    assert [entry["shard"] for entry in matrix] == ["always", "areas-1", "areas-2"]
    assert json.loads(printed["selection"]) == {
        "pytest": "true",
        "vitest": "false",
        "e2e": "false",
        "areas": ["catalog", "pinned_catalog", "sales"],
        "selected": ["catalog", "sales"],
    }


def test_a_suite_that_selects_nothing_prints_false_and_no_entries(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = make_tree(tmp_path)

    _, printed = run_main("pull_request", CommandResult(0, "web/src/App.tsx\n"), root, capsys)

    assert printed["pytest"] == "false"
    assert json.loads(printed["pytest_matrix"]) == {"include": []}
    assert json.loads(printed["selection"])["selected"] == []


@pytest.mark.parametrize(
    "result",
    [CommandResult(128, ""), CommandResult(0, ""), CommandResult(0, "web/src/App.tsx\n")],
)
def test_main_selects_everything_when_the_diff_is_unusable_for_the_event(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], result: CommandResult
) -> None:
    root = make_tree(tmp_path)
    expected = outputs(render(select(None, root)))

    for event in ("workflow_dispatch", "merge_group", "something_new", "push"):
        runner, printed = run_main(event, result, root, capsys)
        assert runner.commands == []
        assert printed == expected
    if result.returncode or not result.stdout:
        _, printed = run_main("pull_request", result, root, capsys)
        assert printed == expected


# --- the reader map -----------------------------------------------------------------------------


def readers_of(
    root: Path, test_text: str, where: str = "tests/test_reader.py"
) -> dict[str, set[str]]:
    write(root, "web/src/x.txt", "x")
    write(root, "docs/y.md", "y")
    write(root, where, "from pathlib import Path\n" + ROOT_LINE + test_text)
    return {prefix: set(found) for prefix, found in pytest_readers(root).items()}


@pytest.mark.parametrize(
    ("text", "claimed"),
    [
        (
            "DATA = ROOT / 'web/src/x.txt'\ndef test_a() -> None:\n    DATA.read_text()\n",
            "web/src/x.txt",
        ),
        (
            "def test_a() -> None:\n    (ROOT / 'web' / 'src' / 'x.txt').read_text()\n",
            "web/src/x.txt",
        ),
        (
            "X = ROOT / 'web' / 'src' / 'x.txt'\ndef test_a() -> None:\n    X.read_text()\n",
            "web/src/x.txt",
        ),
        (
            "WEB = ROOT / 'web'\ndef test_a() -> None:\n    (WEB / 'src' / 'x.txt').read_text()\n",
            "web/src/x.txt",
        ),
        (
            "def test_a() -> None:\n    ROOT.joinpath('docs', 'y.md').read_text()\n",
            "docs/y.md",
        ),
        (
            "def test_a() -> None:\n    list(ROOT.glob('web/src/*.txt'))\n",
            "web/src",
        ),
        (
            "def test_a() -> None:\n    top = Path(__file__).parent.parent\n"
            "    (top / 'docs' / 'y.md').read_text()\n",
            "docs/y.md",
        ),
        (
            "from scripts.affected import REPO_ROOT\n"
            "def test_a() -> None:\n    (REPO_ROOT / 'web' / 'src' / 'x.txt').read_text()\n",
            "web/src/x.txt",
        ),
        (
            "from scripts.affected import WEB\n"
            "def test_a() -> None:\n    (WEB / 'src' / 'x.txt').read_text()\n",
            "web/src/x.txt",
        ),
        (
            "from tests.architecture.hexagon import REPO_ROOT as TOP\n"
            "def test_a() -> None:\n    (TOP / 'docs' / 'y.md').read_text()\n",
            "docs/y.md",
        ),
    ],
)
def test_an_anchored_read_claims_its_prefix_for_the_shard_of_its_test(
    tmp_path: Path, text: str, claimed: str
) -> None:
    assert readers_of(tmp_path, text) == {claimed: {"always"}}
    assert unanchored_reads(tmp_path) == []


@pytest.mark.parametrize(
    "text",
    [
        "FILES = ['web/src/x.txt', 'docs/y.md']\nOTHER = ('web/src/x.txt',)\n",
        "CASES = {'a': 'docs/y.md'}\n",
        "import pytest\n@pytest.mark.parametrize('p', ['web/src/x.txt'])\n"
        "def test_a(p: str) -> None: ...\n",
        "def test_a(tmp_path: Path) -> None:\n    (tmp_path / 'web' / 'src').mkdir(parents=True)\n",
        "def test_a(repo: Path) -> None:\n    (repo / 'docs' / 'y.md').read_text()\n",
        "def test_a() -> None:\n    for f in ROOT.rglob('*.py'):\n        (f / 'web').exists()\n",
        "def test_a() -> None:\n    (ROOT / 'tests' / 'web').exists()\n",
        "from elsewhere import REPO_ROOT\n"
        "def test_a() -> None:\n    (REPO_ROOT / 'web' / 'src').exists()\n",
        "from scripts.affected import REPO_ROOT\n"
        "def test_a() -> None:\n    list(REPO_ROOT.rglob('*.py'))\n",
        "def test_a() -> None:\n    (ROOT / 'web' / 'gone').read_text()\n",
        "ROOT = Path('/repo')\n"
        "def test_a() -> None:\n    assert str(ROOT / 'web/node_modules/.bin/x') == '/repo/web'\n",
    ],
)
def test_a_string_that_is_not_an_anchored_read_claims_nothing(tmp_path: Path, text: str) -> None:
    assert readers_of(tmp_path, text) == {}
    assert unanchored_reads(tmp_path) == []


def test_a_constant_defined_as_a_path_claims_only_where_it_is_read(tmp_path: Path) -> None:
    text = "WEB = ROOT / 'web'\nDOCS = ROOT / 'docs'\ndef test_a() -> None:\n    DOCS.iterdir()\n"

    assert readers_of(tmp_path, text) == {"docs": {"always"}}


def test_a_chain_from_an_origin_the_scan_cannot_place_is_reported_by_file(tmp_path: Path) -> None:
    text = "def test_a() -> None:\n    (Path('web') / 'src' / 'x.txt').read_text()\n"

    assert readers_of(tmp_path, text) == {}
    assert unanchored_reads(tmp_path) == ["tests/test_reader.py"]


def test_the_shard_of_a_claim_follows_the_directory_of_the_reading_test(tmp_path: Path) -> None:
    text = "def test_a() -> None:\n    (ROOT / 'web' / 'src' / 'x.txt').read_text()\n"
    for area in ("catalog", "sales"):
        write(tmp_path, f"app/{area}/__init__.py")
        write(tmp_path, f"tests/{area}/test_{area}.py")
    write(tmp_path, "tests/helper.py", "from pathlib import Path\n" + ROOT_LINE + text)
    nested = "from pathlib import Path\n" + ROOT_FROM_AREA + text
    write(tmp_path, "tests/catalog/test_c.py", nested)
    write(tmp_path, "tests/architecture/test_a.py", nested)
    write(tmp_path, "web/src/x.txt")

    assert pytest_readers(tmp_path) == {"web/src/x.txt": frozenset({"catalog", "sales", "always"})}


def test_a_nested_test_climbs_to_the_root_by_its_own_depth(tmp_path: Path) -> None:
    text = "def test_a() -> None:\n    (ROOT / 'docs' / 'y.md').read_text()\n"
    write(tmp_path, "docs/y.md")
    write(
        tmp_path,
        "tests/architecture/test_a.py",
        "from pathlib import Path\nROOT = Path(__file__).resolve().parents[2]\n" + text,
    )
    write(tmp_path, "tests/architecture/test_b.py", "from pathlib import Path\n" + ROOT_LINE + text)

    assert pytest_readers(tmp_path) == {"docs/y.md": frozenset({"always"})}


# --- the real repository ------------------------------------------------------------------------


def test_every_real_test_reads_web_and_docs_from_an_origin_the_scan_places() -> None:
    assert unanchored_reads(REPO_ROOT) == []


def test_the_real_reader_map_names_paths_that_exist() -> None:
    readers = pytest_readers(REPO_ROOT)

    assert readers
    assert all((REPO_ROOT / prefix).exists() for prefix in readers)
    assert readers["web/src/screens/telegramPreview.cases.json"] == {"pinned_catalog"}


def test_the_real_tree_selects_only_the_always_shard_for_a_screen_or_the_app_shell() -> None:
    # The screen-map guard (tests/test_e2e_screen_specs.py) reads web/src/screens through the
    # imported REPO_ROOT, so a screen change runs it; no area shard is added.
    for path in ("web/src/screens/Analisis.tsx", "web/src/App.tsx"):
        result = select([path], REPO_ROOT)
        assert shards(result) == ["always"]
        assert result.vitest and result.e2e


def test_the_screen_map_guard_is_a_reader_of_the_screens_and_the_specs() -> None:
    readers = pytest_readers(REPO_ROOT)

    assert "always" in readers["web/src/screens"]
    assert "always" in readers["web/e2e"]


def test_the_real_tree_selects_the_reader_of_a_screen_data_file() -> None:
    result = select(["web/src/screens/telegramPreview.cases.json"], REPO_ROOT)

    assert "pinned_catalog" in dirs(result)
    assert shards(result)[0] == "always"


def test_the_real_tree_selects_every_reader_of_the_api_fixtures() -> None:
    result = select(["web/src/api/fixtures/x.json"], REPO_ROOT)
    every = {
        a for a in areas(REPO_ROOT) if a not in ALWAYS_DIRS and (REPO_ROOT / "tests" / a).is_dir()
    }

    assert shards(result)[0] == "always"
    assert "results" in dirs(result)
    assert dirs(result) == every


def test_the_real_tree_selects_the_always_shard_for_a_component_read_by_a_pytest() -> None:
    result = select(["web/src/components/Icono.tsx"], REPO_ROOT)

    assert shards(result) == ["always"]


def test_the_real_tree_selects_everything_for_a_push_and_for_a_fallback_path() -> None:
    for paths in (None, ["uv.lock"], ["pyproject.toml"]):
        result = select(paths, REPO_ROOT)
        assert result.pytest and result.vitest and result.e2e and result.vitest_all
        assert shards(result)[0] == "always" and len(result.pytest_matrix) == 4


def test_every_selector_input_exists() -> None:
    assert all((REPO_ROOT / path).is_file() for path in SELECTOR_INPUTS)
