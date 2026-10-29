"""The front module graph: the `flow` canonical form, folder discovery, the depcruise plan,
the one-level split, the resolver and the guards over `web/src`.

Everything is in-memory text or `tmp_path`; nothing reads the committed generated paths.
"""

from __future__ import annotations

import json
import random
from pathlib import Path, PurePosixPath

from scripts.docs.front import (
    excluded,
    front_folders,
    imports_test_libraries,
    load_patterns,
    orphans_of_excluded,
    plan_calls,
    relative_imports,
    resolve,
    root_has_files,
    split_calls,
    subfolders,
)
from scripts.docs.generate import GENERATED, Limits, produce, run
from scripts.docs.text import HEADER, Problem, block_problems, finalize
from scripts.docs.tools import REPO_ROOT
from scripts.docs.validate import ParseReport
from tests.docs.test_generate import FakeTools


def _flow(*lines: str) -> str:
    return "# T\n\n```mermaid\n" + "\n".join(lines) + "\n```\n"


def _body(text: str) -> list[str]:
    return text.split("```mermaid\n")[1].split("\n```")[0].split("\n")


# A real depcruise capture (`--output-type mermaid`, `--include-only "^src/flash/"`).
FLASH = [
    "flowchart LR",
    "",
    'subgraph src["src"]',
    '  subgraph src_flash["flash"]',
    '    src_flash_useFlash_ts["useFlash.ts"]',
    '    src_flash_FlashProvider_tsx["FlashProvider.tsx"]',
    '    src_flash_flashReducer_ts["flashReducer.ts"]',
    '    src_flash_flashContext_ts["flashContext.ts"]',
    "  end",
    "end",
    "src_flash_useFlash_ts-->src_flash_flashContext_ts",
    "src_flash_FlashProvider_tsx-->src_flash_flashReducer_ts",
    "src_flash_FlashProvider_tsx-->src_flash_flashContext_ts",
]


def test_flow_keeps_every_subgraph_with_its_end_and_sorts_each_level() -> None:
    out = finalize("flow", _flow(*FLASH))
    assert _body(out) == [
        "flowchart LR",
        'subgraph src["src"]',
        '  subgraph src_flash["flash"]',
        '    src_flash_FlashProvider_tsx["FlashProvider.tsx"]',
        '    src_flash_flashContext_ts["flashContext.ts"]',
        '    src_flash_flashReducer_ts["flashReducer.ts"]',
        '    src_flash_useFlash_ts["useFlash.ts"]',
        "  end",
        "end",
        "src_flash_FlashProvider_tsx-->src_flash_flashContext_ts",
        "src_flash_FlashProvider_tsx-->src_flash_flashReducer_ts",
        "src_flash_useFlash_ts-->src_flash_flashContext_ts",
    ]
    assert out.startswith(HEADER + "\n")


def test_flow_nested_groups_come_before_nodes_at_every_level() -> None:
    out = finalize(
        "flow",
        _flow(
            "flowchart LR",
            'subgraph src["src"]',
            '  src_z_ts["z.ts"]',
            '  subgraph src_b["b"]',
            '    b2["b2"]',
            '    subgraph src_b_deep["deep"]',
            '      d["d"]',
            "    end",
            '    b1["b1"]',
            "  end",
            '  subgraph src_a["a"]',
            '    a1["a1"]',
            "  end",
            "end",
        ),
    )
    assert _body(out) == [
        "flowchart LR",
        'subgraph src["src"]',
        '  subgraph src_a["a"]',
        '    a1["a1"]',
        "  end",
        '  subgraph src_b["b"]',
        '    subgraph src_b_deep["deep"]',
        '      d["d"]',
        "    end",
        '    b1["b1"]',
        '    b2["b2"]',
        "  end",
        '  src_z_ts["z.ts"]',
        "end",
    ]


def test_flow_is_the_same_for_any_input_order_and_is_idempotent() -> None:
    expected = finalize("flow", _flow(*FLASH))
    rng = random.Random(7)
    for _ in range(20):
        # shuffle inside the innermost group and among the edges, keeping the nesting
        nodes = FLASH[4:8]
        edges = FLASH[10:]
        rng.shuffle(nodes)
        rng.shuffle(edges)
        shuffled = [*FLASH[:4], *nodes, *FLASH[8:10], *edges]
        assert finalize("flow", _flow(*shuffled)) == expected
    assert finalize("flow", expected) == expected


def test_flow_sorts_edges_then_style_lines_after_all_groups() -> None:
    out = finalize(
        "flow",
        _flow(
            "flowchart LR",
            "classDef hot fill:#f00",
            "b-->c",
            'a["a"]',
            "style a fill:#fff",
            "a-->b",
            'subgraph g["g"]',
            '  n["n"]',
            "end",
        ),
    )
    assert _body(out) == [
        "flowchart LR",
        'subgraph g["g"]',
        '  n["n"]',
        "end",
        'a["a"]',
        "a-->b",
        "b-->c",
        "classDef hot fill:#f00",
        "style a fill:#fff",
    ]


def test_flow_leaves_an_unclosed_subgraph_unclosed() -> None:
    out = finalize("flow", _flow("flowchart LR", 'subgraph g["g"]', '  n["n"]'))
    assert _body(out) == ["flowchart LR", 'subgraph g["g"]', '  n["n"]']


def test_flow_counts_every_arrow_style_and_ignores_arrows_in_labels() -> None:
    edges = ["a-->b", "a---c", "a-.->d", "a==>e", "a-->|uses| f", "a--|x|-->g"]
    body = _flow("flowchart LR", 'a["a --> not an edge"]', *edges)
    assert block_problems(body, max_edges=6, kind="flow") == [
        Problem(1, "block-edges", "6 edges, limit is 5")
    ]
    assert block_problems(body, max_edges=7, kind="flow") == []


def test_flow_counts_edges_inside_a_subgraph_too() -> None:
    body = _flow("flowchart LR", 'subgraph g["g"]', "  a-->b", "  b-->c", "end")
    assert block_problems(body, max_edges=2, kind="flow") == [
        Problem(1, "block-edges", "2 edges, limit is 1")
    ]


def test_flow_reports_a_linkstyle_line_and_never_reorders_it() -> None:
    body = _flow("flowchart LR", "b-->c", "a-->b", "linkStyle 0 stroke:#f00")
    assert block_problems(body, kind="flow") == [
        Problem(1, "flow-linkstyle", "linkStyle 0 stroke:#f00")
    ]
    out = finalize("flow", body)
    assert _body(out)[-3:] == ["a-->b", "b-->c", "linkStyle 0 stroke:#f00"]


def test_the_edge_count_of_a_real_capture() -> None:
    assert block_problems(_flow(*FLASH), max_edges=3, kind="flow") == [
        Problem(1, "block-edges", "3 edges, limit is 2")
    ]
    assert block_problems(_flow(*FLASH), max_edges=4, kind="flow") == []


def test_other_kinds_still_count_their_edges_as_before() -> None:
    body = _flow("classDiagram", "  A <|-- B", "  A --> C")
    assert block_problems(body, max_edges=2) == [Problem(1, "block-edges", "2 edges, limit is 1")]


# --- exclusions, discovery -------------------------------------------------------------

PATTERNS = [r"\.test\.tsx?$", r"^src/test/", r"^src/screens/renderX\.tsx$"]


def _touch(root: Path, *relatives: str) -> None:
    for relative in relatives:
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("export const x = 1\n")


def test_excluded_matches_a_pattern_anywhere_in_the_path() -> None:
    assert excluded("src/a/b.test.tsx", PATTERNS)
    assert excluded("src/test/helper.ts", PATTERNS)
    assert excluded("src/screens/renderX.tsx", PATTERNS)
    assert not excluded("src/screens/renderXY.tsx", PATTERNS)
    assert not excluded("src/a/b.tsx", PATTERNS)


def test_front_folders_are_the_sorted_folders_holding_a_non_excluded_source(
    tmp_path: Path,
) -> None:
    src = tmp_path / "src"
    _touch(
        src.parent,
        "src/zeta/z.ts",
        "src/alpha/deep/a.tsx",
        "src/test/helper.ts",
        "src/onlytests/a.test.ts",
        "src/styles/app.css",
        "src/empty/.keep",
        "src/main.tsx",
    )
    assert front_folders(src, PATTERNS) == ["alpha", "zeta"]
    assert root_has_files(src, PATTERNS)


def test_root_has_no_files_when_src_holds_only_folders_and_tests(tmp_path: Path) -> None:
    src = tmp_path / "src"
    _touch(tmp_path, "src/a/a.ts", "src/x.test.ts")
    assert not root_has_files(src, PATTERNS)


def test_subfolders_are_found_one_level_down_with_their_nested_files(tmp_path: Path) -> None:
    _touch(
        tmp_path,
        "src/screens/Home.tsx",
        "src/screens/withdrawals/deep/W.tsx",
        "src/screens/varieties/V.tsx",
        "src/screens/varieties/V.test.tsx",
        "src/screens/onlytests/T.test.tsx",
    )
    assert subfolders(tmp_path / "src" / "screens", "src/screens", PATTERNS) == [
        "varieties",
        "withdrawals",
    ]


# --- the resolver -----------------------------------------------------------------------


def test_relative_imports_reads_every_static_form_and_skips_packages() -> None:
    source = """
import a from './a'
import { b } from "../b"
export { c } from './c'
import './side'
const d = await import('./d')
import react from 'react'
import e from '@/e'
"""
    assert relative_imports(source) == ["./a", "../b", "./c", "./side", "./d"]


def test_resolve_tries_the_exact_name_then_ts_tsx_and_index() -> None:
    existing = {
        "src/a/x.ts",
        "src/a/y.tsx",
        "src/a/dir/index.ts",
        "src/b/z.ts",
        "src/a/w.css.ts",
    }
    assert resolve("src/a/m.ts", "./x", existing) == "src/a/x.ts"
    assert resolve("src/a/m.ts", "./x.ts", existing) == "src/a/x.ts"
    assert resolve("src/a/m.ts", "./y", existing) == "src/a/y.tsx"
    assert resolve("src/a/m.ts", "./dir", existing) == "src/a/dir/index.ts"
    assert resolve("src/a/m.ts", "../b/z", existing) == "src/b/z.ts"
    assert resolve("src/a/m.ts", "./nope", existing) is None
    assert resolve("src/a/m.ts", "../../../x", existing) is None


def test_a_helper_only_an_excluded_file_imports_is_an_orphan() -> None:
    files = {
        "src/screens/buildX.ts": "export const buildX = 1",
        "src/screens/renderX.tsx": "import { buildX } from './buildX'",
        "src/screens/Screen.tsx": "import { shared } from './shared'",
        "src/screens/shared.ts": "export const shared = 1",
        "src/screens/Screen.test.tsx": "import { shared } from './shared'",
        "src/main.tsx": "import './screens/Screen'",
        "src/lonely.ts": "export const lonely = 1",
    }
    assert orphans_of_excluded(files, PATTERNS) == ["src/screens/buildX.ts"]


def test_a_file_one_non_excluded_file_imports_is_not_an_orphan() -> None:
    files = {
        "src/a.ts": "export const a = 1",
        "src/b.ts": "import { a } from './a'",
        "src/b.test.ts": "import { a } from './a'",
    }
    assert orphans_of_excluded(files, PATTERNS) == []


def test_a_non_excluded_file_importing_a_test_library_is_reported_by_name() -> None:
    files = {
        "src/ok.ts": "import { x } from './y'",
        "src/leak.ts": "import { it } from 'vitest'",
        "src/leak2.tsx": "import { screen } from '@testing-library/react'",
        "src/fine.test.ts": "import { it } from 'vitest'",
    }
    assert imports_test_libraries(files, PATTERNS) == ["src/leak.ts", "src/leak2.tsx"]


# --- the plan and the split -------------------------------------------------------------


def test_plan_has_one_cruise_per_folder_root_and_overview_all_in_web() -> None:
    calls = plan_calls(["alpha", "mobile-standard"], root=True)
    by_name = {c.name: c for c in calls}
    assert sorted(by_name) == [
        "front/alpha",
        "front/mobile-standard",
        "front/overview",
        "front/root",
    ]
    assert all(c.tool == "depcruise" and c.cwd == "web" for c in calls)
    assert by_name["front/alpha"].label == "^src/alpha/"
    assert by_name["front/alpha"].targets == ("src/alpha",)
    assert by_name["front/root"].label == "^src/[^/]+$"
    assert by_name["front/root"].targets == ("src",)
    assert by_name["front/overview"].label == "^src/"
    assert by_name["front/overview"].collapse == "^src/[^/]+"
    assert all(c.label.startswith("^src/") for c in calls)


def test_plan_leaves_the_root_cruise_out_when_src_has_no_root_files() -> None:
    names = [c.name for c in plan_calls(["alpha"], root=False)]
    assert names == ["front/alpha", "front/overview"]


def test_plan_escapes_regex_characters_of_a_folder_name() -> None:
    call = next(c for c in plan_calls(["a.b"], root=False) if c.name == "front/a.b")
    assert call.label == "^src/a\\.b/"


def test_split_cruises_each_subfolder_and_the_files_directly_in_the_folder() -> None:
    calls = split_calls("screens", ["varieties", "withdrawals"], direct=True)
    assert sorted((c.name, c.label, c.targets) for c in calls) == [
        ("front/screens/(files)", "^src/screens/[^/]+$", ("src/screens",)),
        ("front/screens/varieties", "^src/screens/varieties/", ("src/screens/varieties",)),
        ("front/screens/withdrawals", "^src/screens/withdrawals/", ("src/screens/withdrawals",)),
    ]
    assert all(c.cwd == "web" for c in calls)
    assert [c.name for c in split_calls("screens", ["v"], direct=False)] == ["front/screens/v"]


# --- produce and run, with a fake depcruise ---------------------------------------------


def _write_front(root: Path) -> None:
    (root / "app").mkdir()
    (root / "web/scripts/docs").mkdir(parents=True)
    (root / "web/scripts/docs/front-exclude.json").write_text(json.dumps(PATTERNS))
    _touch(
        root / "web",
        "src/main.tsx",
        "src/alpha/a.ts",
        "src/big/one/o.ts",
        "src/big/two/t.ts",
        "src/big/b.ts",
        "src/test/helper.ts",
    )


def _cruise(*edges: str) -> str:
    nodes = sorted({n for e in edges for n in e.split("-->")})
    return "flowchart LR\n\n" + "\n".join(f'{n}["{n}"]' for n in nodes) + "\n" + "\n".join(edges)


SMALL = {
    "front/alpha": _cruise("a-->b"),
    "front/big": _cruise("x-->y"),
    "front/root": _cruise("m-->n"),
    "front/overview": _cruise("alpha-->big"),
}


def _front_only(root: Path, tools: FakeTools, limits: Limits | None = None) -> dict[str, str]:
    out = produce(root, tools, limits or Limits(), lambda: "{}\n")
    prefix = GENERATED / "front-modules"
    return {str(p.relative_to(GENERATED)): text for p, text in out.items() if p.parent == prefix}


def test_front_section_writes_one_file_per_folder_root_and_overview(tmp_path: Path) -> None:
    _write_front(tmp_path)
    tools = FakeTools(SMALL)
    out = _front_only(tmp_path, tools)
    assert sorted(out) == [
        "front-modules/alpha.md",
        "front-modules/big.md",
        "front-modules/overview.md",
        "front-modules/root.md",
    ]
    assert sorted(c.name for c in tools.calls if c.tool == "depcruise") == sorted(SMALL)
    alpha = out["front-modules/alpha.md"]
    assert alpha.startswith(HEADER + "\n")
    assert "Only edges between files inside `alpha/`" in alpha
    assert "[overview.md](overview.md)" in alpha
    assert alpha.count("```mermaid") == 1
    assert out["front-modules/overview.md"].count("```mermaid") == 1


def test_a_folder_with_an_empty_graph_says_so_instead_of_drawing_a_block(
    tmp_path: Path,
) -> None:
    _write_front(tmp_path)
    tools = FakeTools({**SMALL, "front/alpha": "flowchart LR\n\n"})
    alpha = _front_only(tmp_path, tools)["front-modules/alpha.md"]
    assert "No modules in this folder." in alpha
    assert "```mermaid" not in alpha


def test_an_oversized_folder_is_split_by_subfolder_in_a_second_batch(tmp_path: Path) -> None:
    _write_front(tmp_path)
    answers = {
        **SMALL,
        "front/big": _cruise("x-->y", "y-->z"),
        "front/big/(files)": _cruise("b-->c"),
        "front/big/one": _cruise("o-->p"),
        "front/big/two": _cruise("t-->u"),
    }
    tools = FakeTools(answers)
    out = _front_only(tmp_path, tools, Limits(max_edges=2))
    big = out["front-modules/big.md"]
    assert "Edges between subfolders are not drawn; see overview.md." in big
    assert big.index("#### one") < big.index("#### two") < big.index("#### files directly in big/")
    assert big.count("```mermaid") == 3
    assert "x-->y" not in big
    assert "front/big/one" in {c.name for c in tools.calls}
    assert out["front-modules/alpha.md"].count("```mermaid") == 1


def test_a_section_still_over_the_limit_after_the_split_fails_the_run(tmp_path: Path) -> None:
    _write_front(tmp_path)
    answers = {
        **SMALL,
        "front/big": _cruise("x-->y", "y-->z"),
        "front/big/(files)": _cruise("b-->c"),
        "front/big/one": _cruise("o-->p", "p-->q"),
        "front/big/two": _cruise("t-->u"),
    }
    lines: list[str] = []
    code = run(
        tmp_path,
        run_tool=FakeTools(answers),
        validate=lambda files: ParseReport(
            (), sum(f.read_text().count("```mermaid") for f in files)
        ),
        limits=Limits(max_edges=2),
        openapi=lambda: "{}\n",
        report=lines.append,
    )
    assert code == 1
    assert any(
        line.startswith("docs/architecture/generated/front-modules/big.md: block 1: block-edges")
        for line in lines
    )
    assert not (tmp_path / "docs").exists()


def test_a_linkstyle_line_in_a_cruise_fails_the_run_and_writes_nothing(tmp_path: Path) -> None:
    _write_front(tmp_path)
    answers = {**SMALL, "front/alpha": SMALL["front/alpha"] + "\nlinkStyle 0 stroke:red"}
    lines: list[str] = []
    code = run(
        tmp_path,
        run_tool=FakeTools(answers),
        validate=lambda files: ParseReport(
            (), sum(f.read_text().count("```mermaid") for f in files)
        ),
        openapi=lambda: "{}\n",
        report=lines.append,
    )
    assert code == 1
    assert any("flow-linkstyle" in line for line in lines)
    assert not (tmp_path / "docs").exists()


def test_produce_links_every_front_file_from_the_index(tmp_path: Path) -> None:
    _write_front(tmp_path)
    _touch(tmp_path, "app/__init__.py")
    out = produce(tmp_path, FakeTools(SMALL), Limits(), lambda: "{}\n")
    index = out[GENERATED / "README.md"]
    for name in ("alpha", "big", "overview", "root"):
        assert f"- [front-modules/{name}.md](front-modules/{name}.md)" in index
    assert PurePosixPath("docs/architecture/generated/front-modules/root.md") in out


# --- guards over the real web/src (source only, never generated output) -----------------


def _real_sources() -> dict[str, str]:
    web = REPO_ROOT / "web"
    return {
        path.relative_to(web).as_posix(): path.read_text(encoding="utf-8")
        for path in sorted((web / "src").rglob("*"))
        if path.is_file() and path.suffix in (".ts", ".tsx")
    }


def test_every_exclusion_pattern_compiles_in_python() -> None:
    import re

    patterns = load_patterns(REPO_ROOT)
    assert patterns
    for pattern in patterns:
        re.compile(pattern)


def test_no_non_excluded_source_imports_a_test_library() -> None:
    offenders = imports_test_libraries(_real_sources(), load_patterns(REPO_ROOT))
    assert offenders == [], f"test-only files missing from front-exclude.json: {offenders}"


def test_no_non_excluded_source_is_imported_only_by_excluded_files() -> None:
    orphans = orphans_of_excluded(_real_sources(), load_patterns(REPO_ROOT))
    assert orphans == [], f"files only tests import, add them to front-exclude.json: {orphans}"
