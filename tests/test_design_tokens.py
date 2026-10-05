"""Pins the two `tokens.css` copies to the theme rule (Tech Lead's plan, subtask
`light-by-default`, seam 1's fallback): a vitest test reading both files with
`?raw` cannot reach `docs/product/design-system/tokens.css` from `web/src` (Vite's
dev-server `server.fs.allow` denies a path outside the web root), so this guard
lives here instead, over the same two files read with `pathlib`.

Both copies must still carry the light paper token, agree byte-for-byte from the
first `:root {` to the end, never pick the theme from `prefers-color-scheme` or
recognise `claro`, and each expose exactly one `data-tema` selector —
`[data-tema='oscuro']`.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WEB_TOKENS = REPO_ROOT / "web" / "src" / "styles" / "tokens.css"
DOCS_TOKENS = REPO_ROOT / "docs" / "product" / "design-system" / "tokens.css"

_ROOT_RULE = re.compile(r"^:root \{", re.MULTILINE)


def _from_first_root(css: str) -> str:
    match = _ROOT_RULE.search(css)
    assert match is not None, "no :root { block found"
    return css[match.start() :]


def test_each_raw_file_keeps_the_light_papel_value() -> None:
    for path in (WEB_TOKENS, DOCS_TOKENS):
        assert "--papel: #fcfbf8;" in path.read_text()


def test_both_files_agree_from_the_first_root_rule_to_the_end() -> None:
    assert _from_first_root(WEB_TOKENS.read_text()) == _from_first_root(DOCS_TOKENS.read_text())


def test_neither_file_reaches_dark_from_the_system() -> None:
    for path in (WEB_TOKENS, DOCS_TOKENS):
        text = path.read_text()
        assert "prefers-color-scheme" not in text
        assert "claro" not in text


def test_each_file_has_exactly_one_data_tema_selector() -> None:
    selector = re.compile(r"\[data-tema='[^']*'\]")
    for path in (WEB_TOKENS, DOCS_TOKENS):
        text = path.read_text()
        assert selector.findall(text) == ["[data-tema='oscuro']"]
