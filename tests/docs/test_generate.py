"""The pure core of the docs generator: text rules, discover, OpenAPI export, writer.

Everything here is in-memory text or `tmp_path`; nothing reads the committed generated paths.
"""

from __future__ import annotations

import json
import random
from pathlib import Path, PurePosixPath

import pytest

from scripts.docs.discover import discover
from scripts.docs.openapi_export import build_docs_app, export_openapi
from scripts.docs.text import (
    HEADER,
    Problem,
    absolute_paths,
    block_problems,
    duplicate_classes,
    finalize,
)
from scripts.docs.writer import write_tree


def _fenced(*lines: str) -> str:
    return "# T\n\n```mermaid\n" + "\n".join(lines) + "\n```\n"


# --- finalize -------------------------------------------------------------------------


def test_finalize_rewrites_generics_unions_and_callables() -> None:
    raw = _fenced(
        "classDiagram",
        "  class Foo {",
        "    +data : dict[str, list[int]]",
        "    +maybe : X | None",
        "    +hook : Callable[..., T]",
        "    +cmp : list<int>",
        "  }",
    )
    out = finalize("class", raw)
    assert "+data : dict~str, list~int~~" in out
    assert "+maybe : X #124; None" in out
    assert "+hook : Callable~..., T~" in out
    assert "+cmp : list#60;int#62;" in out
    assert "[" not in out.split("```mermaid")[1]


def test_finalize_keeps_the_method_arrow() -> None:
    out = finalize("class", _fenced("classDiagram", "  class A {", "    +run(x) -> int", "  }"))
    assert "+run(x) -> int" in out


def test_finalize_is_idempotent_and_puts_the_header_once() -> None:
    raw = _fenced(
        "classDiagram", "  class B {", "    +x : list[int]", "  }", "  class A", "  A --> B"
    )
    once = finalize("class", raw)
    assert finalize("class", once) == once
    assert once.count(HEADER) == 1
    assert once.startswith(HEADER + "\n")
    assert once.endswith("\n") and not once.endswith("\n\n")


def test_finalize_normalises_line_endings_and_trailing_whitespace() -> None:
    out = finalize("index", "# Title  \r\n\r\ntext\t\r\n\r\n\r\n")
    assert out == f"{HEADER}\n\n# Title\n\ntext\n"


def test_finalize_index_does_not_touch_diagram_text() -> None:
    raw = _fenced("classDiagram", "  class B", "  class A")
    assert (
        finalize("index", raw)
        .split("```mermaid\n")[1]
        .startswith("classDiagram\n  class B\n  class A")
    )


def test_finalize_class_orders_attributes_before_methods_each_sorted() -> None:
    raw = _fenced(
        "classDiagram",
        "  class Z {",
        "    +zeta() int",
        "    +beta : int",
        "    +alpha(x) str",
        "    +hook : Callable[..., T]",
        "    +aardvark : int",
        "  }",
    )
    out = finalize("class", raw)
    members = [line.strip() for line in out.splitlines() if line.startswith("    ")]
    assert members == [
        "+aardvark : int",
        "+beta : int",
        "+hook : Callable~..., T~",
        "+alpha(x) str",
        "+zeta() int",
    ]


def test_finalize_class_is_independent_of_input_order() -> None:
    lines = [
        "  class B {",
        "    +b2 : int",
        "    +b1 : int",
        "    +go() int",
        "  }",
        "  class A {",
        "    +a : int",
        "  }",
        "  A --|> B",
        "  B --> A : uses",
        "  A --* B : owns",
    ]
    expected = finalize("class", _fenced("classDiagram", *lines))
    rng = random.Random(0)
    # shuffle whole groups and relation lines, not the lines inside a group
    groups = [lines[0:5], lines[5:8], [lines[8]], [lines[9]], [lines[10]]]
    for _ in range(10):
        rng.shuffle(groups)
        shuffled = [line for group in groups for line in group]
        assert finalize("class", _fenced("classDiagram", *shuffled)) == expected
    names = [line.strip() for line in expected.splitlines() if line.strip().startswith("class ")]
    assert names == ["class A {", "class B {"]
    assert expected.index("A --* B") < expected.index("A --|> B") < expected.index("B --> A")


def test_finalize_packages_sorts_nodes_then_edges() -> None:
    raw = _fenced("classDiagram", "  b --> a", "  class b", "  class a", "  a --> b")
    out = finalize("packages", raw)
    assert out.split("```mermaid\n")[1].split("```")[0].splitlines() == [
        "classDiagram",
        "  class a",
        "  class b",
        "  a --> b",
        "  b --> a",
    ]


def test_finalize_er_keeps_attribute_order_inside_an_entity() -> None:
    raw = _fenced(
        "erDiagram",
        "  zebra ||--o{ apple : has",
        "  zebra {",
        "    INTEGER id PK",
        "    VARCHAR zeta",
        "    VARCHAR alpha",
        "  }",
        "  apple {",
        "    INTEGER id PK",
        "  }",
    )
    out = finalize("er", raw)
    body = out.split("```mermaid\n")[1].split("```")[0].splitlines()
    assert body == [
        "erDiagram",
        "  apple {",
        "    INTEGER id PK",
        "  }",
        "  zebra {",
        "    INTEGER id PK",
        "    VARCHAR zeta",
        "    VARCHAR alpha",
        "  }",
        "  zebra ||--o{ apple : has",
    ]
    assert finalize("er", out) == out


def test_finalize_keeps_markdown_outside_fences() -> None:
    raw = "# Pkg\n\nSome | text <b>\n\n" + _fenced("classDiagram", "  class A")
    out = finalize("class", raw)
    assert "Some | text <b>" in out


# --- block_problems / duplicate_classes / absolute_paths -------------------------------


def _edges(count: int) -> str:
    return _fenced("classDiagram", *(f"  C{i} --> D{i}" for i in range(count)))


def test_block_problems_edge_limit() -> None:
    assert block_problems(_edges(499)) == []
    assert block_problems(_edges(500)) == [Problem(1, "block-edges", "500 edges, limit is 499")]


def test_block_problems_size_limit() -> None:
    def padded(total: int) -> str:
        head = "classDiagram\n%% "
        return "```mermaid\n" + head + "x" * (total - len(head)) + "\n```\n"

    assert block_problems(padded(49_999)) == []
    problems = block_problems(padded(50_000))
    assert [p.rule for p in problems] == ["block-size"]


def test_block_problems_names_the_block_and_ignores_member_dots() -> None:
    ok = _fenced("classDiagram", "  class A {", "    +hook : Callable~..., T~", "  }")
    text = ok + "\n" + _edges(500)
    assert [(p.block, p.rule) for p in block_problems(text)] == [(2, "block-edges")]
    many_members = _fenced(
        "classDiagram", "  class A {", *(f"    +h{i} : Callable~..., T~" for i in range(600)), "  }"
    )
    assert block_problems(many_members) == []


def test_duplicate_classes() -> None:
    dup = _fenced("classDiagram", "  class A {", "  }", "  class B", "  class A")
    assert duplicate_classes(dup) == [Problem(1, "duplicate-class", "class A is defined twice")]
    clean = _fenced("classDiagram", "  class A {", "    +class : int", "  }", "  class B")
    assert duplicate_classes(clean) == []
    across = _fenced("classDiagram", "  class A") + _fenced("classDiagram", "  class A")
    assert duplicate_classes(across) == []


def test_absolute_paths_finds_a_planted_temp_dir() -> None:
    text = _fenced("classDiagram", "  class A {", "    +path : /tmp/xyz/app/a.py", "  }")
    assert absolute_paths(text, ["/tmp/xyz"]) == [Problem(1, "absolute-path", "found /tmp/xyz")]
    assert absolute_paths(text, ["/tmp/other", ""]) == []
    assert absolute_paths("see /tmp/xyz here\n" + text, ["/tmp/xyz"])[0].block == 0


# --- discover --------------------------------------------------------------------------


def _make_app(root: Path, names: list[str]) -> Path:
    app = root / "app"
    app.mkdir()
    for name in names:
        (app / name).mkdir()
        (app / name / "__init__.py").write_text("")
    return app


def test_discover_is_sorted_and_skips_migrations_and_plain_dirs(tmp_path: Path) -> None:
    app = _make_app(tmp_path, ["zeta", "migrations", "alpha", "mid"])
    (app / "no_init").mkdir()
    (app / "no_init" / "x.py").write_text("")
    (app / "top.py").write_text("")
    assert discover(app) == ["alpha", "mid", "zeta"]


def test_discover_does_not_depend_on_creation_order(tmp_path: Path) -> None:
    names = ["c", "a", "d", "b"]
    (tmp_path / "x").mkdir()
    (tmp_path / "y").mkdir()
    first = discover(_make_app(tmp_path / "x", names))
    second = discover(_make_app(tmp_path / "y", list(reversed(names))))
    assert first == second == ["a", "b", "c", "d"]


# --- export_openapi ---------------------------------------------------------------------


def test_export_openapi_is_stable_and_equals_the_app_document() -> None:
    app = build_docs_app()
    first = export_openapi(app)
    assert export_openapi(app) == first
    assert export_openapi(build_docs_app()) == first
    assert json.loads(first) == app.openapi()
    assert first == json.dumps(app.openapi(), sort_keys=True, indent=2, ensure_ascii=False) + "\n"


# --- write_tree -------------------------------------------------------------------------

GEN = PurePosixPath("docs/architecture/generated")
API = PurePosixPath("docs/api")


def test_write_tree_refuses_a_key_outside_the_roots_and_writes_nothing(tmp_path: Path) -> None:
    outputs = {GEN / "a.md": "a", PurePosixPath("README.md"): "x"}
    with pytest.raises(ValueError, match="README.md"):
        write_tree(tmp_path, outputs)
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "bad", ["docs/api", "docs/apix/a.md", "docs/api/../../x.md", "/abs/x.md", "docs/other/x.md"]
)
def test_write_tree_refuses_lookalike_paths(tmp_path: Path, bad: str) -> None:
    with pytest.raises(ValueError):
        write_tree(tmp_path, {PurePosixPath(bad): "x"})
    assert list(tmp_path.iterdir()) == []


def test_write_tree_writes_files_and_removes_stale_headered_ones(tmp_path: Path) -> None:
    (tmp_path / GEN / "classes").mkdir(parents=True)
    stale = tmp_path / GEN / "classes" / "gone.md"
    stale.write_text(f"{HEADER}\n\nold\n")
    (tmp_path / API).mkdir(parents=True)
    (tmp_path / API / "openapi.json").write_text("{}\n")
    write_tree(tmp_path, {GEN / "README.md": f"{HEADER}\n", API / "README.md": f"{HEADER}\n"})
    assert not stale.exists()
    assert not (tmp_path / GEN / "classes").exists()
    assert not (tmp_path / API / "openapi.json").exists()
    assert (tmp_path / GEN / "README.md").read_text() == f"{HEADER}\n"


def test_write_tree_keeps_headerless_files_and_anything_outside_the_roots(tmp_path: Path) -> None:
    (tmp_path / GEN).mkdir(parents=True)
    (tmp_path / API).mkdir(parents=True)
    handmade = tmp_path / GEN / "notes.md"
    handmade.write_text("mine\n")
    index_html = tmp_path / API / "index.html"
    index_html.write_text("<html>\n")
    outside = tmp_path / "docs" / "architecture" / "stale.md"
    outside.write_text(f"{HEADER}\n")
    (tmp_path / "other.md").write_text(f"{HEADER}\n")
    write_tree(tmp_path, {API / "openapi.json": "{}\n"})
    assert handmade.read_text() == "mine\n"
    assert index_html.exists()
    assert outside.exists()
    assert (tmp_path / "other.md").exists()
    assert (tmp_path / API / "openapi.json").read_text() == "{}\n"


def test_write_tree_replaces_a_changed_file_byte_for_byte(tmp_path: Path) -> None:
    write_tree(tmp_path, {GEN / "a.md": "one\n"})
    write_tree(tmp_path, {GEN / "a.md": "two\n"})
    assert (tmp_path / GEN / "a.md").read_bytes() == b"two\n"
