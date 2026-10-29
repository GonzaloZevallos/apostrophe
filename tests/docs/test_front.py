"""The front module graph: the `flow` canonical form, folder discovery, the depcruise plan,
the one-level split, the resolver and the guards over `web/src`.

Everything is in-memory text or `tmp_path`; nothing reads the committed generated paths.
"""

from __future__ import annotations

import random

from scripts.docs.text import HEADER, Problem, block_problems, finalize


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
