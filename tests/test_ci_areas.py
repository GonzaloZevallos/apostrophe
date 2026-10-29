"""`scripts/ci_areas.py` (GH-448): the pure functions over a temporary tree, and the guard tests
over the real repository tree."""

from __future__ import annotations

from pathlib import Path

from scripts import ci_areas
from scripts.affected import REPO_ROOT
from scripts.ci_areas import (
    ALWAYS_DIRS,
    CORE,
    SUPPORT_DIRS,
    always_paths,
    area_shards,
    areas,
    closure,
    import_graph,
    main_includes_with_prefix,
    pack,
    route_owners,
    selected_test_dirs,
    unclassified_test_dirs,
    unowned_areas,
    weight,
)


def write(root: Path, relative: str, text: str = "") -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def make_areas(root: Path, *names: str) -> None:
    for name in names:
        write(root, f"app/{name}/__init__.py")


# --- areas and the import graph -------------------------------------------------------------


def test_an_area_is_an_app_directory_with_an_init(tmp_path: Path) -> None:
    make_areas(tmp_path, "b", "a")
    write(tmp_path, "app/loose/mod.py")
    write(tmp_path, "app/main.py")
    assert areas(tmp_path) == ("a", "b")


def test_the_graph_resolves_plain_nested_relative_and_from_app_imports(tmp_path: Path) -> None:
    make_areas(tmp_path, "a", "b", "c", "d", "e")
    write(tmp_path, "app/a/x.py", "from app.b.core import thing\n")
    write(tmp_path, "app/b/x.py", "def f() -> None:\n    import app.c\n")
    write(tmp_path, "app/c/adapters/y.py", "from ...d import z\n")
    write(tmp_path, "app/d/x.py", "from app import e\n")
    write(tmp_path, "app/e/x.py", "from . import sibling\nfrom .sibling import q\n")
    write(tmp_path, "app/main.py", "from app.a import x\n")
    assert import_graph(tmp_path) == {
        "a": frozenset({"b"}),
        "b": frozenset({"c"}),
        "c": frozenset({"d"}),
        "d": frozenset({"e"}),
        "e": frozenset(),
    }


def test_an_import_of_a_non_area_module_is_no_edge(tmp_path: Path) -> None:
    make_areas(tmp_path, "a")
    write(tmp_path, "app/db.py")
    write(tmp_path, "app/a/x.py", "from app.db import engine\nimport app.main\n")
    assert import_graph(tmp_path) == {"a": frozenset()}


def test_the_closure_adds_every_direct_and_indirect_importer(tmp_path: Path) -> None:
    graph = {
        "a": frozenset({"b"}),
        "b": frozenset({"c"}),
        "c": frozenset(),
        "d": frozenset(),
    }
    assert closure(graph, {"c"}) == {"a", "b", "c"}
    assert closure(graph, {"d"}) == {"d"}
    assert closure(graph, set()) == frozenset()


def test_the_closure_terminates_on_a_cycle() -> None:
    graph = {"a": frozenset({"b"}), "b": frozenset({"c"}), "c": frozenset({"a"})}
    assert closure(graph, {"b"}) == {"a", "b", "c"}


# --- route owners ----------------------------------------------------------------------------

ROUTER = """
from fastapi import APIRouter

router = APIRouter(prefix="/stock")
entries = APIRouter(prefix="/entries")
plain = APIRouter()

@router.get("")
def root(): ...

@entries.post("/{id}")
def entry(): ...

@plain.get("/panel")
async def panel(): ...

router.include_router(entries)
"""


def test_routes_are_keyed_by_the_first_joined_segment(tmp_path: Path) -> None:
    make_areas(tmp_path, "stock", "results")
    write(tmp_path, "app/stock/adapters/router.py", ROUTER)
    assert route_owners(tmp_path) == {
        "stock": frozenset({"stock"}),
        "panel": frozenset({"stock"}),
    }


def test_a_segment_with_several_owners_maps_to_all_of_them(tmp_path: Path) -> None:
    make_areas(tmp_path, "customers", "payments")
    for area in ("customers", "payments"):
        write(
            tmp_path,
            f"app/{area}/adapters/router.py",
            'from fastapi import APIRouter\nr = APIRouter(prefix="/customers")\n'
            '@r.get("/x")\ndef f(): ...\n',
        )
    assert route_owners(tmp_path) == {"customers": frozenset({"customers", "payments"})}


# --- test-directory selection ----------------------------------------------------------------


def routed_tree(root: Path) -> None:
    make_areas(root, "accounts", "stock", "sales", "pricing", "extra")
    write(root, "app/stock/adapters/router.py", ROUTER)
    write(root, "app/sales/x.py", "from app.stock import thing\n")
    for area in ("accounts", "stock", "sales", "pricing", "extra"):
        write(root, f"tests/{area}/__init__.py")


def test_a_test_directory_is_selected_by_the_name_of_an_area_in_the_closure(
    tmp_path: Path,
) -> None:
    routed_tree(tmp_path)
    assert selected_test_dirs(tmp_path, {"stock"}) == ["stock"]


def test_a_test_directory_is_selected_by_importing_an_area_in_the_closure(
    tmp_path: Path,
) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/sales/test_a.py", "from app.stock.x import y\n\ndef test_a(): ...\n")
    assert selected_test_dirs(tmp_path, {"stock"}) == ["sales", "stock"]


def test_a_test_directory_is_selected_by_a_route_literal(tmp_path: Path) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/pricing/test_a.py", 'def test_a(c): c.get("/stock/entries?x=1")\n')
    assert selected_test_dirs(tmp_path, {"stock"}) == ["pricing", "stock"]


def test_a_test_directory_is_selected_by_an_f_string_route(tmp_path: Path) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/pricing/test_a.py", 'def test_a(c, i): c.get(f"/stock/{i}/x")\n')
    assert selected_test_dirs(tmp_path, {"stock"}) == ["pricing", "stock"]


def test_an_f_string_fragment_is_not_read_as_a_route(tmp_path: Path) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/pricing/test_a.py", 'def test_a(i, j): return f"{i}/stock/{j}"\n')
    assert selected_test_dirs(tmp_path, {"extra"}) == ["extra"]


def test_a_string_that_is_not_a_route_selects_nothing(tmp_path: Path) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/pricing/test_a.py", 'X = "stock/entries"\nY = "/tmp/stock"\n')
    assert selected_test_dirs(tmp_path, {"stock"}) == ["stock"]


def test_the_client_fixture_is_an_edge_to_accounts(tmp_path: Path) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/pricing/test_a.py", "def test_a(client): ...\n")
    write(tmp_path, "tests/extra/test_a.py", "def test_a(other_client): ...\n")
    assert selected_test_dirs(tmp_path, {"accounts"}) == ["accounts", "extra", "pricing"]
    assert selected_test_dirs(tmp_path, {"stock"}) == ["stock"]


def test_a_top_level_helper_is_attributed_to_the_directories_that_import_it(
    tmp_path: Path,
) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/helper_a.py", "from app.stock.x import y\n")
    write(tmp_path, "tests/helper_b.py", "from tests.helper_a import y\n")
    write(tmp_path, "tests/helper_c.py", "X = 1\n")
    write(tmp_path, "tests/pricing/test_a.py", "from tests.helper_b import y\n")
    write(tmp_path, "tests/extra/test_a.py", "from tests import helper_c\n")
    assert selected_test_dirs(tmp_path, {"stock"}) == ["pricing", "stock"]


def test_an_always_directory_that_is_also_an_area_is_never_an_area_shard(
    tmp_path: Path,
) -> None:
    make_areas(tmp_path, "shared", "stock")
    write(tmp_path, "tests/shared/test_a.py", "from app.stock import x\n")
    write(tmp_path, "tests/stock/__init__.py")
    assert selected_test_dirs(tmp_path, {"shared", "stock"}) == ["stock"]


def test_the_always_set_is_the_top_level_tests_and_the_always_directories(
    tmp_path: Path,
) -> None:
    write(tmp_path, "tests/test_b.py")
    write(tmp_path, "tests/test_a.py")
    write(tmp_path, "tests/helper.py")
    write(tmp_path, "tests/architecture/test_x.py")
    write(tmp_path, "tests/stock/test_x.py")
    assert always_paths(tmp_path) == [
        "tests/architecture",
        "tests/test_a.py",
        "tests/test_b.py",
    ]


# --- weight and packing ----------------------------------------------------------------------


def test_weight_counts_functions_class_methods_and_multiplies_stacked_parametrize(
    tmp_path: Path,
) -> None:
    write(
        tmp_path,
        "t/test_a.py",
        "import pytest\n"
        "from elsewhere import CASES\n\n"
        "def test_one(): ...\n"
        "def helper(): ...\n"
        "async def test_async(): ...\n\n"
        "@pytest.mark.parametrize('a', [1, 2, 3])\n"
        "@pytest.mark.parametrize('b', (1, 2))\n"
        "def test_stacked(a, b): ...\n\n"
        "@pytest.mark.parametrize('a', CASES)\n"
        "def test_unresolved(a): ...\n\n"
        "class TestGroup:\n"
        "    def test_m(self): ...\n"
        "    @pytest.mark.parametrize(argnames='a', argvalues=[1, 2])\n"
        "    def test_n(self, a): ...\n"
        "    def other(self): ...\n\n"
        "class Helper:\n"
        "    def test_not_collected(self): ...\n",
    )
    write(tmp_path, "t/sub/test_b.py", "def test_b(): ...\n")
    # one + async + 6 stacked + 1 unresolved + 1 method + 2 parametrized method + 1 in sub
    assert weight(tmp_path / "t") == 1 + 1 + 6 + 1 + 1 + 2 + 1


def test_pack_is_longest_first_and_deterministic() -> None:
    sizes = {"a": 5, "b": 5, "c": 3, "d": 3, "e": 1}
    first = pack(sizes)
    assert first == [["a", "e"], ["b"], ["c", "d"]]
    assert pack(dict(reversed(list(sizes.items())))) == first


def test_pack_makes_fewer_bins_than_three_when_there_are_fewer_directories() -> None:
    assert pack({"b": 1, "a": 9}) == [["a"], ["b"]]
    assert pack({"a": 4}) == [["a"]]


def test_pack_of_nothing_is_no_bins() -> None:
    assert pack({}) == []


def test_pack_never_leaves_a_bin_empty_even_for_zero_weights() -> None:
    assert pack({"a": 0, "b": 0, "c": 0, "d": 0}) == [["a", "d"], ["b"], ["c"]]


def test_area_shards_pack_the_selected_directories_by_test_count(tmp_path: Path) -> None:
    routed_tree(tmp_path)
    write(tmp_path, "tests/stock/test_a.py", "def test_a(): ...\ndef test_b(): ...\n")
    write(tmp_path, "tests/sales/test_a.py", "from app.stock import x\n\ndef test_a(): ...\n")
    assert area_shards(tmp_path, {"stock", "sales"}) == [["stock"], ["sales"]]
    assert area_shards(tmp_path, set()) == []


# --- the guards, each fed an input it must reject --------------------------------------------


def test_an_area_without_tests_or_core_is_reported(tmp_path: Path) -> None:
    make_areas(tmp_path, "with_tests", "without_tests")
    write(tmp_path, "tests/with_tests/__init__.py")
    assert unowned_areas(tmp_path) == ["without_tests"]


def test_a_test_directory_that_is_nothing_known_is_reported(tmp_path: Path) -> None:
    make_areas(tmp_path, "stock")
    for name in ("stock", "architecture", "fakes", "mystery", "__pycache__"):
        write(tmp_path, f"tests/{name}/x.py")
    assert unclassified_test_dirs(tmp_path) == ["mystery"]


def test_a_prefix_on_a_main_include_router_is_reported(tmp_path: Path) -> None:
    write(
        tmp_path,
        "app/main.py",
        "app.include_router(a, dependencies=g)\napp.include_router(b, prefix='/x')\n",
    )
    assert main_includes_with_prefix(tmp_path) == [2]


def test_every_real_area_has_tests_or_is_core() -> None:
    assert unowned_areas(REPO_ROOT) == []


def test_every_real_test_directory_is_classified() -> None:
    assert unclassified_test_dirs(REPO_ROOT) == []


def test_no_real_include_router_in_main_passes_a_prefix() -> None:
    assert main_includes_with_prefix(REPO_ROOT) == []


def test_the_always_directories_are_defined_once_and_exist() -> None:
    assert CORE == ()
    assert set(SUPPORT_DIRS).isdisjoint(ALWAYS_DIRS)
    for name in ALWAYS_DIRS:
        assert (REPO_ROOT / "tests" / name).is_dir(), name
    assert ci_areas.ALWAYS_DIRS is ALWAYS_DIRS


def test_the_real_tree_routes_are_owned_as_the_routers_declare() -> None:
    owners = route_owners(REPO_ROOT)
    assert owners["customers"] == {"customers", "payments"}
    assert owners["stock"] == {"stock"}
    assert owners["expense-categories"] == {"expenses"}
    assert owners["business"] == {"accounts"}


def test_the_real_tree_closure_of_a_leaf_area_selects_its_own_tests() -> None:
    graph = import_graph(REPO_ROOT)
    chosen = selected_test_dirs(REPO_ROOT, closure(graph, {"pinned_catalog"}))
    assert "pinned_catalog" in chosen
    assert not set(chosen) & set(ALWAYS_DIRS)
