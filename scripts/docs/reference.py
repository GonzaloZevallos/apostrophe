"""The offline Redocly page: pure rules over its HTML.

`offline_problems` says what keeps a page from being offline or from being the same on every
machine. `strip_attribution` removes the one link the page cannot be built without (Redocly's
own attribution anchor, whose `href` points at redocly.com) and nothing else. `reference_file`
gives the final bytes with `HEADER` first.

Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

import re
import tempfile
from html.parser import HTMLParser
from pathlib import Path

from scripts.docs.text import HEADER, Problem

_EXTERNAL = ("http://", "https://", "//")
ATTRIBUTION_TEXT = "API docs by"
_ATTRIBUTE = re.compile(r"""\s([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?""")
# `/home/` only where it starts a path (`/home/<user>/`), not inside a route like `/api/home/x`.
_HOME = re.compile(r"(?<![\w/.-])/home/[^/\s\"'<>]+/")


class _Links(HTMLParser):
    """Collects the `src` and `href` of every tag; script and style bodies are not tags."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in ("src", "href") and value is not None:
                self.links.append((name, value.strip()))


class _Anchors(HTMLParser):
    """Finds the attribution anchor: the `<a>` with an external `href` and exactly its text."""

    def __init__(self, html: str) -> None:
        super().__init__(convert_charrefs=True)
        self._starts = [0]
        for line in html.split("\n")[:-1]:
            self._starts.append(self._starts[-1] + len(line) + 1)
        self._open: tuple[int, str, str] | None = None
        self._text: list[str] = []
        self.found: list[tuple[int, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        line, column = self.getpos()
        raw = self.get_starttag_text() or ""
        self._open = (self._starts[line - 1] + column, raw, href.strip().lower())
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._open is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._open is None:
            return
        offset, raw, href = self._open
        self._open = None
        if href.startswith(_EXTERNAL) and "".join(self._text).strip() == ATTRIBUTION_TEXT:
            self.found.append((offset, raw))


def strip_attribution(html: str) -> str:
    """Remove the `href` attribute of Redocly's attribution anchor; every other byte stays.

    The anchor is an `<a>` whose `href` is external and whose text is exactly "API docs by".
    Only the `href="..."` text inside that start tag is spliced out. The content of `<script>`
    and `<style>` is never parsed as markup, so it passes through unchanged.
    """
    parser = _Anchors(html)
    parser.feed(html)
    parser.close()
    for offset, raw in reversed(parser.found):
        for attribute in _ATTRIBUTE.finditer(raw[2:]):
            if attribute.group(1).lower() == "href":
                start = offset + 2 + attribute.start() + 1
                end = offset + 2 + attribute.end()
                html = html[:start] + html[end:]
                break
    return html


def offline_problems(html: str, repo_root: Path) -> list[Problem]:
    """Every external `src`/`href` and every machine path in `html`, as block-0 problems."""
    parser = _Links()
    parser.feed(html)
    parser.close()
    problems: list[Problem] = []
    seen: set[tuple[str, str]] = set()
    for name, value in parser.links:
        if value.lower().startswith(_EXTERNAL) and (name, value) not in seen:
            seen.add((name, value))
            problems.append(Problem(0, "external-link", f"{name}={value}"))
    for root in (str(repo_root), tempfile.gettempdir()):
        if root and root in html:
            problems.append(Problem(0, "machine-path", f"found {root}"))
    home = _HOME.search(html)
    if home:
        problems.append(Problem(0, "machine-path", f"found {home.group(0)}"))
    return problems


def reference_file(html: str) -> str:
    """`HEADER` at byte 0, then the page, with `\\n` line endings and one trailing newline."""
    body = html.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")
    return f"{HEADER}\n{body}\n"
