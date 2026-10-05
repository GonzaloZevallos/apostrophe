"""Pins the two `tokens.css` copies to the theme rule (Tech Lead's plan, subtask
`light-by-default`, seam 1's fallback): a vitest test reading both files with
`?raw` cannot reach `docs/product/design-system/tokens.css` from `web/src` (Vite's
dev-server `server.fs.allow` denies a path outside the web root), so this guard
lives here instead, over the same two files read with `pathlib`.

Both copies must still carry the light paper token, agree byte-for-byte from the
first `:root {` to the end, never pick the theme from `prefers-color-scheme` or
recognise `claro`, and each copy must expose exactly one `data-tema` attribute
selector, matching `oscuro` exactly.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WEB_TOKENS = REPO_ROOT / "web" / "src" / "styles" / "tokens.css"
DOCS_TOKENS = REPO_ROOT / "docs" / "product" / "design-system" / "tokens.css"

_ROOT_RULE = re.compile(r"^:root \{", re.MULTILINE)

# Every attribute selector named `data-tema`, whatever follows the name: exact match,
# presence, `~=`, `^=`, the ` i` flag, and so on. `(?![\w-])` keeps `[data-tema-x]` out.
_DATA_TEMA_SELECTOR = re.compile(r"\[\s*data-tema(?![\w-])[^\]]*\]", re.IGNORECASE)

# The exact-`=` shape only, case-sensitive: the value, quoted or not.
_DATA_TEMA_VALUE = re.compile(r"\[\s*data-tema\s*=\s*(?:'([^']*)'|\"([^\"]*)\"|([^\]\s'\"]+))\s*\]")


def data_tema_values(css: str) -> list[str]:
    """Every `data-tema` attribute selector's value, or its raw text when it isn't
    an exact-`=` match (a presence selector, `~=`, `^=`, `|=`, `*=`, `$=`, the ` i`
    flag)."""
    values: list[str] = []
    for selector in _DATA_TEMA_SELECTOR.findall(css):
        parsed = _DATA_TEMA_VALUE.fullmatch(selector)
        if parsed is None:
            values.append(selector)
        else:
            values.append(next(group for group in parsed.groups() if group is not None))
    return values


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
    for path in (WEB_TOKENS, DOCS_TOKENS):
        assert data_tema_values(path.read_text()) == ["oscuro"]


_BASE_CSS = ":root[data-tema='oscuro'] {}"


def test_a_second_double_quoted_selector_breaks_the_single_oscuro_value() -> None:
    css = _BASE_CSS + "\n:root[data-tema=\"claro\"] {}"
    assert data_tema_values(css) != ["oscuro"]


def test_a_second_unquoted_selector_breaks_the_single_oscuro_value() -> None:
    css = _BASE_CSS + "\n:root[data-tema=claro] {}"
    assert data_tema_values(css) != ["oscuro"]


def test_a_second_presence_selector_breaks_the_single_oscuro_value() -> None:
    css = _BASE_CSS + "\n:root[data-tema] {}"
    assert data_tema_values(css) != ["oscuro"]


def test_a_second_prefix_match_selector_breaks_the_single_oscuro_value() -> None:
    css = _BASE_CSS + "\n:root[data-tema^='o'] {}"
    assert data_tema_values(css) != ["oscuro"]


def test_a_comment_mention_with_no_brackets_does_not_count() -> None:
    css = _BASE_CSS + '\n/* data-tema="oscuro" */'
    assert data_tema_values(css) == ["oscuro"]


def test_double_quoted_selector_alone_parses_to_oscuro() -> None:
    assert data_tema_values('[data-tema="oscuro"]') == ["oscuro"]


def test_unquoted_selector_alone_parses_to_oscuro() -> None:
    assert data_tema_values("[data-tema=oscuro]") == ["oscuro"]
