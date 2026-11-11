"""Rules the Spanish architecture pages obey (GH-461), as pure functions.

Links and Mermaid blocks are read only through `scripts/docs/links.py` (`page_problems`
feeds its output to the rules); this file defines no link or Mermaid pattern of its own. The rules:
`defined_symbol_problems` (a cited symbol is defined in its linked file),
`adr_index_problems` (the ADR index equals `docs/adr/` and its marks equal the ADRs' own
`status:` lines) and `reach_problems` (every page is within two clicks of the entry).
Nothing imports from `app`.
"""

from __future__ import annotations

import posixpath
import re
from collections import Counter, deque
from collections.abc import Callable, Iterable, Mapping, Sequence
from pathlib import PurePosixPath

from scripts.docs.adr_ids import superseded_by
from scripts.docs.links import extract_links, mermaid_blocks, participant_aliases


def _is_defined(name: str, source: str) -> bool:
    escaped = re.escape(name)
    definition = rf"(?:class|def|async[ \t]+def)[ \t]+{escaped}\b"
    assignment = rf"{escaped}[ \t]*(?::[^=\n]+)?=(?!=)"
    pattern = rf"^[ \t]*(?:{definition}|{assignment})"
    return re.search(pattern, source, re.MULTILINE) is not None


def defined_symbol_problems(
    citations: Iterable[tuple[str, str]], read_source: Callable[[str], str]
) -> list[str]:
    """One message per `(path, symbol)` citation whose symbol starts with `_` or has no
    line-start definition (`class`, `def`, `async def` or an assignment, indentation
    allowed) in the text of `path`. A `#` comment is not one; the text is not parsed, so a docstring
    line shaped like a definition would be."""
    problems: list[str] = []
    for path, symbol in citations:
        if symbol.startswith("_"):
            problems.append(f"{path}: `{symbol}` starts with an underscore")
        elif not _is_defined(symbol, read_source(path)):
            problems.append(f"{path}: `{symbol}` is not defined there")
    return problems


def alias_problems(mermaid_source: str, linked_sources: Iterable[str]) -> list[str]:
    """One message per `participant X as Y` / `actor X as Y` alias of one Mermaid block (cut out
    and read by `scripts/docs/links.py`) that starts with `_` or has no line-start definition
    in any of the texts of the files linked on the same page."""
    sources = list(linked_sources)
    problems: list[str] = []
    for alias in participant_aliases(mermaid_source):
        if alias.startswith("_"):
            problems.append(f"alias `{alias}` starts with an underscore")
        elif not any(_is_defined(alias, source) for source in sources):
            problems.append(f"alias `{alias}` is not defined in a file linked on the page")
    return problems


def adr_status(adr_markdown: str) -> str | None:
    """The value of the `status:` line in an ADR's front matter, or None without one."""
    lines = adr_markdown.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            return None
        key, _, value = line.partition(":")
        if key.strip() == "status":
            return value.strip()
    return None


def adr_index_problems(
    linked_rows: Sequence[tuple[str, str | None]], adr_statuses: Mapping[str, str | None]
) -> list[str]:
    """`linked_rows` is one `(file, mark)` per index table row that links an ADR, in page
    order: the mark is the id named by `reemplazada por <id>` on that row (None for no
    mark). A file on N > 1 rows is reported, and then the first row decides its mark.
    `adr_statuses` maps each file in `docs/adr/` to its front-matter `status:` value. The
    linked set equals the listing, and a mark equals `superseded by <id>` (read through
    `scripts/docs/adr_ids.py`, so legacy and dated ids both work), in both directions."""
    problems: list[str] = []
    rows = Counter(name for name, _ in linked_rows)
    problems += [f"{name}: linked on {n} rows" for name, n in sorted(rows.items()) if n > 1]
    linked_marks: dict[str, str | None] = {}
    for name, mark in linked_rows:
        linked_marks.setdefault(name, mark)
    for name in sorted(set(adr_statuses) - set(linked_marks)):
        problems.append(f"{name} is in docs/adr/ but not in the index")
    for name in sorted(set(linked_marks) - set(adr_statuses)):
        problems.append(f"{name} is in the index but not in docs/adr/")
    for name in sorted(set(linked_marks) & set(adr_statuses)):
        status = adr_statuses[name]
        expected = superseded_by(status)
        if status is not None and status.startswith("superseded") and expected is None:
            problems.append(f"{name}: status {status!r} names no ADR id")
        elif linked_marks[name] != expected:
            problems.append(
                f"{name}: index mark {linked_marks[name]!r} does not match status {status!r}"
            )
    return problems


def doubled_prose_lines(markdown: str) -> list[str]:
    """The lines outside the table rows (a line whose stripped start is not `|`) that occur
    twice or more, blank lines aside, one message per such line: `merge=union` can double a
    line both branches wrote, and a table row is checked by `adr_index_problems` instead."""
    seen: set[str] = set()
    reported: set[str] = set()
    problems: list[str] = []
    for line in markdown.splitlines():
        text = line.strip()
        if not text or text.startswith("|"):
            continue
        if text in seen and text not in reported:
            reported.add(text)
            problems.append(f"decisiones.md: line repeated outside the table: {text[:60]}")
        seen.add(text)
    return problems


def _normalise(source: str, target: str) -> str | None:
    """The page a link reaches, or None for a link that is a leaf (a directory, a non-.md
    file, a path outside docs/) or a self-link."""
    path = target.split("#", 1)[0]
    if not path:
        return None
    parts: list[str] = []
    for part in (PurePosixPath(source).parent / path).parts:
        if part == "..":
            if parts:
                parts.pop()
        elif part != ".":
            parts.append(part)
    resolved = "/".join(parts)
    if not resolved.startswith("docs/") or not resolved.endswith(".md") or resolved == source:
        return None
    return resolved


def reach_problems(
    start: str, pages: Iterable[str], links: Mapping[str, list[str]], depth: int = 2
) -> list[str]:
    """Pages not reached from `start` within `depth` clicks. `links` maps a page to the raw
    targets the extractor found on it; `#fragment` is stripped and leaves are ignored."""
    seen = {start}
    queue: deque[tuple[str, int]] = deque([(start, 0)])
    while queue:
        page, clicks = queue.popleft()
        if clicks == depth:
            continue
        for target in links.get(page, []):
            reached = _normalise(page, target)
            if reached is not None and reached not in seen:
                seen.add(reached)
                queue.append((reached, clicks + 1))
    return [
        f"{page} is more than {depth} clicks from {start}" for page in sorted(set(pages) - seen)
    ]


def page_problems(page: str, markdown: str, read_source: Callable[[str], str | None]) -> list[str]:
    """Every rule applied to one page. `page` is its repo-relative path, `read_source` returns
    the text of a repo-relative path or None when there is no such file. A relative link must
    resolve to a file or directory in the repo; the symbols after a link to a source file must be
    defined in it; each Mermaid alias must be defined in a source file linked on the page."""
    problems: list[str] = []
    sources: list[str] = []
    citations: list[tuple[str, str]] = []
    for link in extract_links(markdown):
        target = link.target.split("#", 1)[0]
        if not target or "://" in target or target.startswith("mailto:"):
            continue
        path = posixpath.normpath(posixpath.join(posixpath.dirname(page), target))
        text = read_source(path)
        if path.startswith("..") or text is None:
            problems.append(f"{page}: link to {link.target} does not resolve in the repo")
            continue
        if path.endswith(".md"):
            continue
        sources.append(text)
        citations.extend((path, symbol) for symbol in link.symbols)
    problems += [
        f"{page}: {p}"
        for p in defined_symbol_problems(citations, read_source_or_empty(read_source))
    ]
    for block in mermaid_blocks(markdown):
        problems += [f"{page}: {p}" for p in alias_problems(block, sources)]
    return problems


def read_source_or_empty(read: Callable[[str], str | None]) -> Callable[[str], str]:
    return lambda path: read(path) or ""


def test_a_symbol_defined_at_line_start_passes() -> None:
    source = "class Sale:\n    def total(self): ...\nasync def record(): ...\nLIMIT: int = 3\n"
    citations = [("a.py", "Sale"), ("a.py", "total"), ("a.py", "record"), ("a.py", "LIMIT")]

    assert defined_symbol_problems(citations, lambda path: source) == []


def test_a_symbol_only_in_a_comment_or_missing_is_rejected() -> None:
    source = "# def ghost(): ...\nx = 1  # Ghost = 2\n"

    problems = defined_symbol_problems([("a.py", "ghost"), ("a.py", "Ghost")], lambda p: source)

    assert len(problems) == 2


def test_a_comparison_is_not_an_assignment() -> None:
    assert defined_symbol_problems([("a.py", "x")], lambda p: "x == 1\n") != []


def test_an_underscore_name_is_rejected_even_when_defined() -> None:
    problems = defined_symbol_problems([("a.py", "_hidden")], lambda p: "def _hidden(): ...\n")

    assert problems == ["a.py: `_hidden` starts with an underscore"]


def test_an_index_equal_to_the_listing_with_matching_marks_passes() -> None:
    statuses = {"0030-a.md": "superseded by 0033", "0033-b.md": "accepted"}

    assert adr_index_problems([("0030-a.md", "0033"), ("0033-b.md", None)], statuses) == []


def test_a_dated_id_in_a_mark_and_a_status_is_compared_whole() -> None:
    statuses = {"0030-a.md": "superseded by 20261111-x", "20261111-x.md": "accepted"}
    rows: list[tuple[str, str | None]] = [("0030-a.md", "20261111-x"), ("20261111-x.md", None)]

    assert adr_index_problems(rows, statuses) == []
    assert adr_index_problems([("0030-a.md", "2026"), ("20261111-x.md", None)], statuses) == [
        "0030-a.md: index mark '2026' does not match status 'superseded by 20261111-x'"
    ]


def test_a_superseded_status_that_names_no_id_is_reported() -> None:
    statuses = {"0030-a.md": "superseded by someone"}

    assert adr_index_problems([("0030-a.md", None)], statuses) == [
        "0030-a.md: status 'superseded by someone' names no ADR id"
    ]


def test_a_file_linked_on_two_rows_is_reported() -> None:
    statuses = {"0033-b.md": "accepted"}

    assert adr_index_problems([("0033-b.md", None), ("0033-b.md", None)], statuses) == [
        "0033-b.md: linked on 2 rows"
    ]


def test_a_file_linked_on_two_rows_with_different_marks_is_reported_too() -> None:
    statuses = {"0033-b.md": "superseded by 0034", "0034-c.md": "accepted"}
    rows: list[tuple[str, str | None]] = [
        ("0033-b.md", "0034"),
        ("0034-c.md", None),
        ("0033-b.md", None),
    ]

    assert adr_index_problems(rows, statuses) == ["0033-b.md: linked on 2 rows"]


def test_a_repeated_prose_line_is_reported_and_distinct_lines_are_clean() -> None:
    table = "| ADR | Qué |\n| --- | --- |\n| a | b |\n| a | b |\n"
    twice = "# Decisiones\n\nUna frase.\n\n  Una frase.  \n\n" + table

    assert doubled_prose_lines(twice) == [
        "decisiones.md: line repeated outside the table: Una frase."
    ]
    assert doubled_prose_lines("# Decisiones\n\nUna frase.\n\nOtra frase.\n\n" + table) == []


def test_a_line_repeated_three_times_is_reported_once_with_its_first_60_characters() -> None:
    line = "x" * 80

    assert doubled_prose_lines(f"{line}\n{line}\n{line}\n") == [
        f"decisiones.md: line repeated outside the table: {'x' * 60}"
    ]


def test_a_missing_extra_unmarked_or_wrongly_marked_adr_is_rejected() -> None:
    statuses = {"0030-a.md": "superseded by 0033", "0033-b.md": "accepted", "0034-c.md": "accepted"}
    marks: list[tuple[str, str | None]] = [
        ("0030-a.md", None),
        ("0033-b.md", "0034"),
        ("0099-z.md", None),
    ]

    problems = adr_index_problems(marks, statuses)

    assert len(problems) == 4


def test_reach_follows_two_clicks_and_no_further() -> None:
    links = {
        "docs/README.md": ["architecture/README.md"],
        "docs/architecture/README.md": ["contexto.md"],
        "docs/architecture/contexto.md": ["deep.md"],
    }
    pages = [
        "docs/architecture/README.md",
        "docs/architecture/contexto.md",
        "docs/architecture/deep.md",
    ]

    assert reach_problems("docs/README.md", pages, links) == [
        "docs/architecture/deep.md is more than 2 clicks from docs/README.md"
    ]


def test_reach_strips_fragments_and_ignores_self_links_and_leaves() -> None:
    links = {
        "docs/README.md": [
            "a.md#section",
            "#top",
            "README.md",
            "adr/",
            "../app/main.py",
            "api/index.html",
            "../README.md",
        ]
    }

    assert reach_problems("docs/README.md", ["docs/a.md"], links) == []
    assert reach_problems("docs/README.md", ["docs/adr/x.md"], links) != []


def test_aliases_defined_in_a_linked_file_pass() -> None:
    block = "sequenceDiagram\n    participant U as SignIn\n    actor A as Session\n    U->>A: go\n"

    assert alias_problems(block, ["class SignIn: ...\n", "Session = 1\n"]) == []


def test_an_alias_undefined_underscored_or_only_in_a_comment_is_rejected() -> None:
    block = "participant U as Ghost\nparticipant V as _Hidden\nparticipant W as Noted\n"

    problems = alias_problems(block, ["class _Hidden: ...\n# class Noted\n"])

    assert problems == [
        "alias `Ghost` is not defined in a file linked on the page",
        "alias `_Hidden` starts with an underscore",
        "alias `Noted` is not defined in a file linked on the page",
    ]


def test_adr_status_reads_only_the_front_matter() -> None:
    assert (
        adr_status("---\nstatus: superseded by 0033\ndate: 1\n---\n# T\n") == "superseded by 0033"
    )
    assert adr_status("---\ndate: 1\n---\nstatus: accepted\n") is None
    assert adr_status("# T\nstatus: accepted\n") is None


def test_an_adr_without_a_status_line_carries_no_mark() -> None:
    assert adr_index_problems([("0032-a.md", None)], {"0032-a.md": None}) == []
    assert adr_index_problems([("0032-a.md", "0033")], {"0032-a.md": None}) != []


def _reads(files: dict[str, str]) -> Callable[[str], str | None]:
    return files.get


def test_a_page_whose_links_and_symbols_hold_has_no_problems() -> None:
    page = (
        "| step | file | symbol |\n|---|---|---|\n"
        "| 1 | [deps](../../app/deps.py) | `require_session` |\n"
        "\n```mermaid\nsequenceDiagram\n    participant U as require_session\n```\n"
    )
    files = {"app/deps.py": "def require_session(): ...\n"}

    assert page_problems("docs/architecture/x.md", page, _reads(files)) == []


def test_a_page_with_a_dead_link_an_undefined_symbol_or_a_bad_alias_is_rejected() -> None:
    page = (
        "[gone](../../app/gone.py) `x`\n"
        "[deps](../../app/deps.py) `ghost` `_hidden`\n"
        "```mermaid\nsequenceDiagram\n    participant U as Browser\n```\n"
    )
    files = {"app/deps.py": "def _hidden(): ...\n"}

    problems = page_problems("docs/architecture/x.md", page, _reads(files))

    assert len(problems) == 4
    assert any("gone.py" in p for p in problems)
    assert any("`ghost`" in p for p in problems)
    assert any("`_hidden` starts" in p for p in problems)
    assert any("alias `Browser`" in p for p in problems)


def test_a_link_to_a_path_outside_the_repo_is_rejected() -> None:
    assert page_problems("docs/x.md", "[a](../../../etc/passwd)", _reads({})) != []


def test_extractor_keeps_a_fragment_as_written_and_reach_strips_it() -> None:
    links = {"docs/README.md": [link.target for link in extract_links("[s](a.md#section)")]}

    assert links == {"docs/README.md": ["a.md#section"]}
    assert reach_problems("docs/README.md", ["docs/a.md"], links) == []


def test_extractor_skips_links_inside_fenced_and_mermaid_code() -> None:
    markdown = (
        "```\n[a](a.md)\n```\n~~~\n[t](t.md)\n~~~\n"
        "```mermaid\nflowchart LR\n  A-->B\n  [m](m.md)\n```\n[real](real.md)\n"
    )
    targets = [link.target for link in extract_links(markdown)]

    assert targets == ["real.md"]
    links = {"docs/README.md": targets}
    assert reach_problems("docs/README.md", ["docs/real.md"], links) == []
    assert reach_problems("docs/README.md", ["docs/a.md"], links) != []


def test_extractor_gives_directory_non_md_and_outside_targets_that_reach_treats_as_leaves() -> None:
    markdown = "[d](adr/) [h](api/index.html) [c](../app/main.py)"
    links = {"docs/README.md": [link.target for link in extract_links(markdown)]}

    assert links["docs/README.md"] == ["adr/", "api/index.html", "../app/main.py"]
    assert reach_problems("docs/README.md", ["docs/README.md"], links) == []
    assert reach_problems("docs/README.md", ["docs/adr/x.md"], links) != []


def test_extractor_gives_a_self_link_that_reach_drops() -> None:
    links = {
        "docs/README.md": [link.target for link in extract_links("[me](README.md) [up](#top)")]
    }

    assert links["docs/README.md"] == ["README.md", "#top"]
    assert reach_problems("docs/README.md", ["docs/README.md"], links) == []


def test_extractor_attaches_symbols_to_the_link_before_them_and_ignores_code_links() -> None:
    markdown = (
        "| 1 | [a](a.py) | `Alpha` | [b](b.py) | `Beta`, `not-a-name` |\n"
        "see `[c](c.py)` and [d](d.md)"
    )

    found = [(link.target, link.symbols) for link in extract_links(markdown)]

    assert found == [("a.py", ("Alpha",)), ("b.py", ("Beta",)), ("d.md", ())]


def test_mermaid_blocks_are_cut_out_and_aliases_read_from_them() -> None:
    markdown = "```python\nx = 1\n```\n```mermaid\nsequenceDiagram\n  actor A as Sale\n```\n"

    blocks = mermaid_blocks(markdown)

    assert len(blocks) == 1
    assert participant_aliases(blocks[0]) == ["Sale"]
