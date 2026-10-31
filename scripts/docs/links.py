"""The one reader of Markdown links and Mermaid blocks for the hand-written docs.

`extract_links` returns every `[text](target)` of a page with the backticked names that
follow it on the same line (`[file](path)` then `` `Symbol` ``, or the cells of a table row), and
skips everything inside a fenced code block. `mermaid_blocks` returns the text of each
```` ```mermaid ```` block, and `participant_aliases` the `Y` of each `participant X as Y`
line of one block. `tests/docs/` reads pages only through these three; it defines no link
or Mermaid pattern of its own. Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# One alternative per token: a code span, or a link. A link inside a code span is code, and
# a code span inside a link's text belongs to the text, because the scan goes left to right.
_TOKEN = re.compile(r"`([^`]*)`|\[([^\]]*)\]\(([^)\s]*)(?:\s+\"[^\"]*\")?\)")


@dataclass(frozen=True)
class Link:
    """`target` is as written (fragment included). `symbols` are the identifiers in code
    spans between this link and the next one on its line."""

    text: str
    target: str
    symbols: tuple[str, ...]


def _lines_outside_fences(markdown: str) -> list[str]:
    """The lines of `markdown` that are neither inside a fenced block nor a fence line."""
    kept: list[str] = []
    marker: str | None = None
    for line in markdown.splitlines():
        stripped = line.strip()
        if marker is None:
            marker = _fence(stripped)
            if marker is None:
                kept.append(line)
        elif _closes(stripped, marker):
            marker = None
    return kept


def _fence(stripped: str) -> str | None:
    """The opening marker (a run of 3 or more backticks or tildes), or None."""
    if not stripped or stripped[0] not in "`~":
        return None
    run = len(stripped) - len(stripped.lstrip(stripped[0]))
    return stripped[:run] if run >= 3 else None


def _closes(stripped: str, marker: str) -> bool:
    return bool(stripped) and stripped.strip(marker[0]) == "" and len(stripped) >= len(marker)


def extract_links(markdown: str) -> list[Link]:
    links: list[Link] = []
    for line in _lines_outside_fences(markdown):
        current: tuple[str, str] | None = None
        names: list[str] = []
        for token in _TOKEN.finditer(line):
            code, text, target = token.groups()
            if code is None:
                if current is not None:
                    links.append(Link(current[0], current[1], tuple(names)))
                current, names = (text, target), []
            elif current is not None and code.isidentifier():
                names.append(code)
        if current is not None:
            links.append(Link(current[0], current[1], tuple(names)))
    return links


def mermaid_blocks(markdown: str) -> list[str]:
    """The text inside each fenced block whose info string is `mermaid`, in page order."""
    blocks: list[list[str]] = []
    marker: str | None = None
    current: list[str] | None = None
    for line in markdown.splitlines():
        stripped = line.strip()
        if marker is None:
            marker = _fence(stripped)
            if marker is not None:
                current = [] if stripped[len(marker) :].strip() == "mermaid" else None
        elif _closes(stripped, marker):
            if current is not None:
                blocks.append(current)
            marker, current = None, None
        elif current is not None:
            current.append(line)
    return ["\n".join(block) for block in blocks]


def participant_aliases(block: str) -> list[str]:
    """The `Y` of each `participant X as Y` or `actor X as Y` line of one Mermaid block."""
    aliases: list[str] = []
    for line in block.splitlines():
        words = line.split()
        if len(words) >= 4 and words[0] in ("participant", "actor") and words[2] == "as":
            aliases.append(" ".join(words[3:]))
    return aliases
