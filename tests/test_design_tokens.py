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
        assert "--papel: #f6f7f5;" in path.read_text()


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
    css = _BASE_CSS + '\n:root[data-tema="claro"] {}'
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


# --- tokens.ts <-> web tokens.css: the same colour, in both themes ---------------

DOCS_TOKENS_TS = REPO_ROOT / "docs" / "product" / "design-system" / "tokens.ts"

_TS_PALETTE = re.compile(r"export const (claro|oscuro): Paleta = \{(.*?)\n\};", re.DOTALL)
_TS_COLOUR = re.compile(r"^\s*([A-Za-z0-9]+): '(#[0-9a-fA-F]{6})'", re.MULTILINE)
_CSS_BLOCKS = {
    "claro": re.compile(r"^:root \{(.*?)^\}", re.DOTALL | re.MULTILINE),
    "oscuro": re.compile(r"^:root\[data-tema='oscuro'\] \{(.*?)^\}", re.DOTALL | re.MULTILINE),
}
_CSS_COLOUR = re.compile(r"^\s*(--[a-z0-9-]+): (#[0-9a-fA-F]{6});", re.MULTILINE)


def _kebab(key: str) -> str:
    return "--" + re.sub(r"([A-Z])", lambda m: "-" + m.group(1).lower(), key)


def ts_colours(ts: str) -> dict[str, dict[str, str]]:
    """The colour of each theme in `tokens.ts`, by CSS name (`navInactivo` ->
    `--nav-inactivo`), lowercase."""
    return {
        theme: {_kebab(key): value.lower() for key, value in _TS_COLOUR.findall(body)}
        for theme, body in _TS_PALETTE.findall(ts)
    }


def css_colours(css: str) -> dict[str, dict[str, str]]:
    colours: dict[str, dict[str, str]] = {}
    for theme, block in _CSS_BLOCKS.items():
        match = block.search(css)
        colours[theme] = (
            {name: value.lower() for name, value in _CSS_COLOUR.findall(match.group(1))}
            if match
            else {}
        )
    return colours


def colour_mismatches(ts: str, css: str) -> list[str]:
    """Every theme and token where `tokens.ts` and the CSS differ, or exists in one only."""
    from_ts, from_css = ts_colours(ts), css_colours(css)
    problems: list[str] = []
    for theme in ("claro", "oscuro"):
        ts_theme, css_theme = from_ts.get(theme, {}), from_css.get(theme, {})
        if not ts_theme or not css_theme:
            problems.append(f"{theme}: no colour found in one of the files")
        for name in sorted(ts_theme.keys() | css_theme.keys()):
            if ts_theme.get(name) != css_theme.get(name):
                problems.append(
                    f"{theme} {name}: ts {ts_theme.get(name)} css {css_theme.get(name)}"
                )
    return problems


def test_tokens_ts_and_the_web_tokens_have_the_same_colours_in_both_themes() -> None:
    assert colour_mismatches(DOCS_TOKENS_TS.read_text(), WEB_TOKENS.read_text()) == []


_FIXTURE_TS = """
export const claro: Paleta = {
  papel: '#FCFBF8',
  navInactivo: '#7A7064',
};
export const oscuro: Paleta = {
  papel: '#10131A',
  navInactivo: '#7B8780',
};
"""
_FIXTURE_CSS = """
:root {
  color-scheme: light;
  --papel: #fcfbf8;
  --nav-inactivo: #7a7064;
  --espacio-xs: 4px;
}

:root[data-tema='oscuro'] {
  --papel: #10131a;
  --nav-inactivo: #7b8780;
}
"""


def test_the_colour_comparison_ignores_hex_case_and_non_colour_tokens() -> None:
    assert colour_mismatches(_FIXTURE_TS, _FIXTURE_CSS) == []


def test_a_different_colour_in_one_theme_is_a_mismatch() -> None:
    css = _FIXTURE_CSS.replace("--nav-inactivo: #7b8780", "--nav-inactivo: #7b8781")
    assert colour_mismatches(_FIXTURE_TS, css) == ["oscuro --nav-inactivo: ts #7b8780 css #7b8781"]


def test_a_token_missing_from_one_file_is_a_mismatch() -> None:
    css = _FIXTURE_CSS.replace("  --nav-inactivo: #7a7064;\n", "")
    assert colour_mismatches(_FIXTURE_TS, css) == ["claro --nav-inactivo: ts #7a7064 css None"]
    ts = _FIXTURE_TS.replace("  papel: '#10131A',\n", "")
    assert colour_mismatches(ts, _FIXTURE_CSS) == ["oscuro --papel: ts None css #10131a"]
