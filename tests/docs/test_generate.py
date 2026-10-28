"""The pure core of the docs generator: text rules, discover, OpenAPI export, writer.

Everything here is in-memory text or `tmp_path`; nothing reads the committed generated paths.
"""

from __future__ import annotations

import json
import random
import subprocess
import time
from collections.abc import Sequence
from pathlib import Path, PurePosixPath

import pytest

from scripts.docs.discover import discover
from scripts.docs.generate import (
    NO_CLASSES_IN_LAYER,
    NO_LAYER,
    SPLIT_NOTE,
    Limits,
    produce,
    run,
)
from scripts.docs.openapi_export import build_docs_app, export_openapi
from scripts.docs.text import (
    HEADER,
    Problem,
    absolute_paths,
    block_problems,
    duplicate_classes,
    finalize,
)
from scripts.docs.tools import (
    ToolCall,
    ToolError,
    argv_for,
    paracelsus_call,
    pyreverse_call,
    run_all,
    subprocess_runner,
    tool_env,
)
from scripts.docs.validate import (
    ParseProblem,
    ParseReport,
    node_validator,
    parse_node_output,
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


def test_finalize_encodes_braces_in_members() -> None:
    raw = _fenced("classDiagram", "  class Foo {", "    +opts : dict = {}", "  }")
    out = finalize("class", raw)
    assert "+opts : dict = #123;#125;" in out
    assert finalize("class", out) == out


def test_finalize_is_idempotent_on_a_fence_with_blank_lines() -> None:
    raw = _fenced("classDiagram", "", "  class B {", "", "    +x : int", "  }", "", "  B --> A")
    once = finalize("class", raw)
    assert "\n\n  class" not in once.split("```mermaid\n")[1]
    assert finalize("class", once) == once
    er = finalize("er", _fenced("erDiagram", "", "  a {", "    INTEGER id PK", "", "  }"))
    assert finalize("er", er) == er


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


def test_block_problems_counts_er_relation_lines() -> None:
    def er(count: int) -> str:
        return _fenced("erDiagram", *(f"  a{i} ||--o{{ b{i} : has" for i in range(count)))

    assert block_problems(er(499)) == []
    assert block_problems(er(500)) == [Problem(1, "block-edges", "500 edges, limit is 499")]
    entity_only = _fenced("erDiagram", "  a {", *(f"    INTEGER c{i}" for i in range(600)), "  }")
    assert block_problems(entity_only) == []


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
    assert first.endswith("}\n") and not first.endswith("\n\n")


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
    assert (tmp_path / API / "openapi.json").read_text() == "{}\n"
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


# --- the pipeline: produce, validate on a staged copy, write ---------------------------

SMALL = "classDiagram\n  class A {\n    +x : int\n  }"
PACKAGES = "classDiagram\n  class alpha {\n  }\n  class domain {\n  }\n  alpha --> domain"
ER = "erDiagram\n  t {\n    INTEGER id PK\n  }"


def _classes(*names: str) -> str:
    return "classDiagram\n" + "\n".join(f"  class {n} {{\n    +x : int\n  }}" for n in names)


def _fake_repo(root: Path) -> Path:
    """app/alpha is a hexagon without `adapters`; app/shared is not one; migrations is skipped."""
    for relative in (
        "app/__init__.py",
        "app/main.py",
        "app/migrations/__init__.py",
        "app/shared/__init__.py",
        "app/alpha/__init__.py",
        "app/alpha/domain/__init__.py",
        "app/alpha/domain/one.py",
        "app/alpha/domain/two.py",
        "app/alpha/application/__init__.py",
    ):
        (root / relative).parent.mkdir(parents=True, exist_ok=True)
        (root / relative).write_text("")
    return root


class FakeTools:
    """A `run_tool` that answers by call name and records every call."""

    def __init__(self, answers: dict[str, str] | None = None) -> None:
        self.answers = {
            "class/shared": _classes("Shared"),
            "class/alpha/packages": PACKAGES,
            "class/alpha/domain": _classes("One", "Two"),
            "class/alpha/application": "classDiagram",
            "class/app-root": _classes("Settings"),
            "er/data-model": ER,
            **(answers or {}),
        }
        self.calls: list[ToolCall] = []

    def __call__(self, call: ToolCall) -> str:
        self.calls.append(call)
        if call.name not in self.answers:
            raise ToolError(f"{call.name}: unexpected call")
        return self.answers[call.name]


def _fences_of(files: Sequence[Path]) -> int:
    return sum(f.read_text().count("```mermaid") for f in files)


def _accepting(files: Sequence[Path]) -> ParseReport:
    return ParseReport((), _fences_of(files))


def _openapi() -> str:
    return "{}\n"


def _snapshot(root: Path) -> dict[str, bytes]:
    return {
        p.relative_to(root).as_posix(): p.read_bytes()
        for p in sorted(root.rglob("*"))
        if p.is_file()
    }


def test_produce_lays_out_hexagons_packages_and_layers(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    out = produce(repo, FakeTools(), Limits(), _openapi)
    assert sorted(str(p) for p in out) == [
        "docs/api/README.md",
        "docs/api/openapi.json",
        "docs/architecture/generated/README.md",
        "docs/architecture/generated/app-root.md",
        "docs/architecture/generated/classes/alpha.md",
        "docs/architecture/generated/classes/shared.md",
        "docs/architecture/generated/data-model.md",
    ]
    alpha = out[GEN / "classes" / "alpha.md"]
    assert alpha.count(HEADER) == 1
    assert alpha.index("## Packages") < alpha.index("## domain") < alpha.index("## application")
    assert alpha.index("## application") < alpha.index("## adapters")
    assert alpha.count("```mermaid") == 2
    assert f"## application\n\n{NO_CLASSES_IN_LAYER}\n" in alpha
    assert f"## adapters\n\n{NO_LAYER}\n" in alpha
    assert out[GEN / "classes" / "shared.md"].count("```mermaid") == 1
    assert "[classes/alpha.md](classes/alpha.md)" in out[GEN / "README.md"]
    assert "shows only its own package" in out[GEN / "README.md"]
    assert out[API / "openapi.json"] == "{}\n"
    assert out[API / "README.md"].count(HEADER) == 1


def test_produce_bytes_do_not_depend_on_completion_order(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    plain = FakeTools()

    def slow_first(call: ToolCall) -> str:
        time.sleep(0.02 if call.name.startswith("class/a") else 0.0)
        return plain(call)

    assert produce(repo, slow_first, Limits(), _openapi) == produce(
        repo, FakeTools(), Limits(), _openapi
    )


def test_produce_splits_a_layer_that_breaks_the_limit_into_children(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    tools_ = FakeTools(
        {
            "child/alpha/domain/one": _classes("One"),
            "child/alpha/domain/two": _classes("Two"),
        }
    )
    limits = Limits(max_chars=len(_classes("One", "Two")) - 5, max_edges=500)
    out = produce(repo, tools_, limits, _openapi)
    alpha = out[GEN / "classes" / "alpha.md"]
    assert f"## domain\n\n{SPLIT_NOTE}\n" in alpha
    assert alpha.index("#### one") < alpha.index("#### two")
    assert alpha.count("```mermaid") == 3
    assert {c.name for c in tools_.calls if c.name.startswith("child/")} == {
        "child/alpha/domain/one",
        "child/alpha/domain/two",
    }


def test_produce_splits_a_layer_with_a_duplicate_class_name(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    tools_ = FakeTools(
        {
            "class/alpha/domain": _classes("Same", "Same"),
            "child/alpha/domain/one": _classes("Same"),
            "child/alpha/domain/two": _classes("Same"),
        }
    )
    alpha = produce(repo, tools_, Limits(), _openapi)[GEN / "classes" / "alpha.md"]
    assert SPLIT_NOTE in alpha
    assert duplicate_classes(alpha) == []


def test_run_writes_the_tree_when_everything_passes(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    lines: list[str] = []
    code = run(
        repo, run_tool=FakeTools(), validate=_accepting, openapi=_openapi, report=lines.append
    )
    assert code == 0
    assert lines == []
    assert (repo / GEN / "classes" / "alpha.md").is_file()
    assert (repo / API / "openapi.json").read_text() == "{}\n"


def test_run_twice_gives_the_same_bytes(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    run(repo, run_tool=FakeTools(), validate=_accepting, openapi=_openapi)
    first = _snapshot(repo / "docs")
    run(repo, run_tool=FakeTools(), validate=_accepting, openapi=_openapi)
    assert _snapshot(repo / "docs") == first


def test_a_failing_validator_leaves_seeded_files_unchanged_and_writes_nothing(
    tmp_path: Path,
) -> None:
    repo = _fake_repo(tmp_path)
    (repo / GEN / "classes").mkdir(parents=True)
    (repo / API).mkdir(parents=True)
    (repo / GEN / "classes" / "alpha.md").write_text(f"{HEADER}\n\nold alpha\n")
    (repo / GEN / "classes" / "gone.md").write_text(f"{HEADER}\n\nstale\n")
    (repo / API / "openapi.json").write_text('{"old": 1}\n')
    before = _snapshot(repo / "docs")
    lines: list[str] = []

    def rejecting(files: Sequence[Path]) -> ParseReport:
        bad = next(f for f in files if f.name == "alpha.md")
        return ParseReport((ParseProblem(bad, 2, "Parse error on line 3"),), _fences_of(files))

    code = run(
        repo, run_tool=FakeTools(), validate=rejecting, openapi=_openapi, report=lines.append
    )
    assert code == 1
    assert lines == [
        "docs/architecture/generated/classes/alpha.md: block 2: "
        "mermaid-parse: Parse error on line 3"
    ]
    assert _snapshot(repo / "docs") == before


def test_a_smaller_parser_count_is_parser_count(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    lines: list[str] = []
    code = run(
        repo,
        run_tool=FakeTools(),
        validate=lambda files: ParseReport((), _fences_of(files) - 1),
        openapi=_openapi,
        report=lines.append,
    )
    assert code == 1
    assert lines == [
        "<parser>: block 0: parser-count: the parser checked 4 blocks, the generator produced 5"
    ]
    assert not (repo / "docs").exists()


def test_no_count_line_is_parser_silent(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    lines: list[str] = []
    code = run(
        repo,
        run_tool=FakeTools(),
        validate=lambda files: ParseReport((), None),
        openapi=_openapi,
        report=lines.append,
    )
    assert code == 1
    assert lines == ["<parser>: block 0: parser-silent: the parser printed no count line"]
    assert not (repo / "docs").exists()


def test_a_child_still_over_the_limit_exits_1_and_names_the_rule(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    tools_ = FakeTools(
        {
            "child/alpha/domain/one": _classes("One", "Uno"),
            "child/alpha/domain/two": _classes("Two"),
        }
    )
    lines: list[str] = []
    code = run(
        repo,
        run_tool=tools_,
        validate=_accepting,
        limits=Limits(max_chars=60, max_edges=500),
        openapi=_openapi,
        report=lines.append,
    )
    assert code == 1
    assert lines
    assert all(
        line.startswith("docs/architecture/generated/classes/alpha.md: block ") for line in lines
    )
    assert any(": block-size: " in line for line in lines)
    assert not (repo / "docs").exists()


def test_a_duplicate_class_in_a_child_exits_1(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    tools_ = FakeTools(
        {
            "class/alpha/domain": _classes("Same", "Same"),
            "child/alpha/domain/one": _classes("Same", "Same"),
            "child/alpha/domain/two": _classes("Two"),
        }
    )
    lines: list[str] = []
    code = run(repo, run_tool=tools_, validate=_accepting, openapi=_openapi, report=lines.append)
    assert code == 1
    assert any(": duplicate-class: class Same is defined twice" in line for line in lines)


def test_an_absolute_path_in_a_diagram_exits_1(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    leaking = _classes("Shared") + f"\n  class P {{\n    +root : {repo}/app\n  }}"
    lines: list[str] = []
    code = run(
        repo,
        run_tool=FakeTools({"class/shared": leaking}),
        validate=_accepting,
        openapi=_openapi,
        report=lines.append,
    )
    assert code == 1
    assert any("classes/shared.md: block 1: absolute-path: found " in line for line in lines)


def test_a_failing_tool_exits_1_and_writes_nothing(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    tools_ = FakeTools()
    del tools_.answers["class/shared"]
    lines: list[str] = []
    code = run(repo, run_tool=tools_, validate=_accepting, openapi=_openapi, report=lines.append)
    assert code == 1
    assert lines == ["<tools>: block 0: tool-failed: class/shared: unexpected call"]
    assert not (repo / "docs").exists()


# --- the tool runner and the parser adapter ---------------------------------------------


def test_pyreverse_argv_has_the_agreed_flags_and_only_relative_paths() -> None:
    call = pyreverse_call("class/shared", "shared", ["app/shared"], "classes")
    argv = argv_for(call, "../x/docs-gen-1")
    assert argv[0].endswith("/pyreverse")
    assert argv[1:] == [
        "-o", "mmd", "--filter-mode", "PUB_ONLY", "--show-ancestors", "0",
        "--show-associated", "0", "-d", "../x/docs-gen-1", "-p", "shared", "app/shared",
    ]  # fmt: skip
    assert call.product == "classes_shared.mmd"


def test_paracelsus_argv_reads_the_shim_and_prints_to_stdout() -> None:
    argv = argv_for(paracelsus_call("er/data-model"), "unused")
    assert argv[0].endswith("/paracelsus")
    assert argv[1:] == [
        "graph", "scripts.docs.er_base:ErBase", "--format", "mermaid",
        "--column-sort", "preserve-order",
    ]  # fmt: skip


def test_tool_env_pins_pythonpath_and_hashseed() -> None:
    env = tool_env({"HOME": "/h", "PYTHONHASHSEED": "random", "PYTHONPATH": "/elsewhere"})
    assert env == {"HOME": "/h", "PYTHONHASHSEED": "0", "PYTHONPATH": "."}


def test_subprocess_runner_runs_an_argv_list_at_the_repo_root_with_a_temp_out_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, object] = {}

    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        seen.update(kwargs, argv=argv)
        out_dir = tmp_path / argv[argv.index("-d") + 1]
        (out_dir / "classes_shared.mmd").write_text("classDiagram\n")
        return subprocess.CompletedProcess(argv, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    call = pyreverse_call("class/shared", "shared", ["app/shared"], "classes")
    assert subprocess_runner(tmp_path)(call) == "classDiagram\n"
    argv = seen["argv"]
    assert isinstance(argv, list)
    out_dir = argv[argv.index("-d") + 1]
    assert not Path(out_dir).is_absolute()
    assert not (tmp_path / out_dir).exists()
    assert seen["cwd"] == tmp_path
    assert seen.get("shell") is None
    env = seen["env"]
    assert isinstance(env, dict)
    assert env["PYTHONPATH"] == "." and env["PYTHONHASHSEED"] == "0"


def test_subprocess_runner_turns_a_nonzero_exit_into_a_tool_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(argv, 32, "", "boom\nusage: pyreverse")

    monkeypatch.setattr(subprocess, "run", fake_run)
    with pytest.raises(ToolError, match="class/x: pyreverse exited 32: usage: pyreverse"):
        subprocess_runner(tmp_path)(pyreverse_call("class/x", "x", ["app/x"], "classes"))


def test_run_all_gathers_in_sorted_name_order_whatever_finishes_first() -> None:
    calls = [pyreverse_call(f"c/{n}", n, [f"app/{n}"], "classes") for n in "dacb"]

    def slow_a(call: ToolCall) -> str:
        time.sleep(0.05 if call.label == "a" else 0.0)
        return call.label

    result = run_all(calls, slow_a)
    assert list(result) == ["c/a", "c/b", "c/c", "c/d"]
    assert list(result.values()) == ["a", "b", "c", "d"]


def test_run_all_refuses_duplicate_names() -> None:
    call = pyreverse_call("c/a", "a", ["app/a"], "classes")
    with pytest.raises(ValueError, match="duplicate tool call names"):
        run_all([call, call], lambda c: "")


def test_parse_node_output_reads_problems_and_the_count_line() -> None:
    a, b = Path("/stage/a.md"), Path("/stage/b.md")
    shown = {"../s/a.md": a, "../s/b.md": b}
    out = "../s/b.md: block 2: Parse error on line 3\nchecked 5 blocks in 2 files\n"
    report = parse_node_output(out, shown)
    assert report == ParseReport((ParseProblem(b, 2, "Parse error on line 3"),), 5)


def test_parse_node_output_without_a_count_line_has_no_count() -> None:
    assert parse_node_output("", {}).blocks_checked is None
    assert parse_node_output("../a.md: block 1: x\n", {}).blocks_checked is None
    assert (
        parse_node_output("checked 5 blocks in 2 files\nlater noise\n", {}).blocks_checked is None
    )


def test_node_validator_runs_the_parser_script_with_relative_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, object] = {}

    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        seen.update(kwargs, argv=argv)
        return subprocess.CompletedProcess(argv, 0, "checked 3 blocks in 1 files\n", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    repo = tmp_path / "repo"
    repo.mkdir()
    staged = tmp_path / "stage" / "a.md"
    report = node_validator(repo)([staged])
    assert report == ParseReport((), 3)
    assert seen["argv"] == ["node", "web/scripts/docs/mermaidParse.ts", "../stage/a.md"]
    assert seen["cwd"] == repo


def test_node_validator_reports_a_parser_that_cannot_start(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        raise FileNotFoundError("node")

    monkeypatch.setattr(subprocess, "run", fake_run)
    report = node_validator(tmp_path)([tmp_path / "a.md"])
    assert report.blocks_checked is None
    assert report.problems[0].message == "could not start node: node"


def test_a_packages_diagram_defines_each_module_node_once(tmp_path: Path) -> None:
    repo = _fake_repo(tmp_path)
    packages = (
        "classDiagram\n  class alpha {\n  }\n  class domain {\n  }\n  class errors {\n  }\n"
        "  class application {\n  }\n  class errors {\n  }\n  application --> errors"
    )
    out = produce(repo, FakeTools({"class/alpha/packages": packages}), Limits(), _openapi)
    alpha = out[GEN / "classes" / "alpha.md"]
    assert alpha.count("class errors {") == 1
    assert "application --> errors" in alpha
    assert duplicate_classes(alpha) == []
