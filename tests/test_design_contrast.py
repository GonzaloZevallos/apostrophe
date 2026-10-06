"""Text contrast guard (ADR-0027): the design README's accessibility rule 5 (text on
its background, 4.5:1 at least) as a table that this test reads and computes.

The README table (between the `contraste:inicio` and `contraste:fin` markers) is the
only place with a policy: which tokens are surfaces, which text tokens are general (on
every surface), which are paired with one background, which are icon-only. Colour values
come only from `web/src/styles/tokens.css`, per theme block. This file holds no colour
and no pair of its own; its fixtures use made-up values on made-up tables.

It lives in pytest, not vitest, because Vite's `server.fs.allow` keeps a front test from
reading `docs/product/design-system/`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
README = REPO_ROOT / "docs" / "product" / "design-system" / "README.md"
TOKENS_CSS = REPO_ROOT / "web" / "src" / "styles" / "tokens.css"
APP_CSS = REPO_ROOT / "web" / "src" / "styles" / "app.css"

MINIMUM_RATIO = 4.5
THEMES = ("claro", "oscuro")
_THEME_SELECTORS = {"claro": ":root", "oscuro": ":root[data-tema='oscuro']"}

KIND_SURFACE = "superficie"
KIND_GENERAL = "general"
KIND_PAIRED = "par"
KIND_ICON = "ícono"
_KINDS = (KIND_SURFACE, KIND_GENERAL, KIND_PAIRED, KIND_ICON)

Tokens = dict[str, dict[str, str]]


# --- Parsing ---------------------------------------------------------------------


@dataclass(frozen=True)
class Row:
    token: str
    kind: str
    background: str | None
    light: str | None
    dark: str | None
    selectors: tuple[str, ...]


@dataclass(frozen=True)
class Rule:
    selectors: tuple[str, ...]
    declarations: tuple[tuple[str, str], ...]


@dataclass
class _OpenBlock:
    prelude: str
    body_start: int
    has_children: bool = field(default=False)


_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_VAR = re.compile(r"var\(\s*(--[a-z0-9-]+)")
_BACKTICKED = re.compile(r"`([^`]+)`")
_HEX = re.compile(r"#[0-9a-fA-F]{6}")
_CUSTOM_PROPERTY = re.compile(r"^--[a-z0-9-]+$")


def _normalise(selector: str) -> str:
    return " ".join(selector.split())


def css_rules(css: str) -> list[Rule]:
    """The innermost rule blocks of `css` (a rule inside `@media` is one, the `@media`
    itself is not), comments stripped."""
    css = _COMMENT.sub("", css)
    rules: list[Rule] = []
    stack: list[_OpenBlock] = []
    start = 0
    for index, char in enumerate(css):
        if char == "{":
            if stack:
                stack[-1].has_children = True
            stack.append(_OpenBlock(css[start:index].strip(), index + 1))
            start = index + 1
        elif char == "}" and stack:
            block = stack.pop()
            start = index + 1
            if not block.has_children:
                declarations = []
                for part in css[block.body_start : index].split(";"):
                    name, colon, value = part.partition(":")
                    if colon:
                        declarations.append((name.strip().lower(), value.strip()))
                selectors = tuple(_normalise(s) for s in block.prelude.split(",") if s.strip())
                rules.append(Rule(selectors, tuple(declarations)))
    return rules


def parse_tokens(css: str) -> Tokens:
    """Every `--name: #rrggbb` of each theme block, lowercase, by theme."""
    tokens: Tokens = {theme: {} for theme in THEMES}
    for rule in css_rules(css):
        for theme, selector in _THEME_SELECTORS.items():
            if rule.selectors == (selector,):
                for name, value in rule.declarations:
                    if _CUSTOM_PROPERTY.match(name) and _HEX.fullmatch(value):
                        tokens[theme][name] = value.lower()
    return tokens


def parse_table(readme: str) -> list[Row]:
    start = readme.index("<!-- contraste:inicio -->")
    end = readme.index("<!-- contraste:fin -->")
    rows: list[Row] = []
    for line in readme[start:end].splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if cells[0] == "Token" or set(cells[0]) <= {"-"}:
            continue
        token, kind, background, light, dark, selectors = cells
        rows.append(
            Row(
                token=token.strip("`"),
                kind=kind,
                background=background.strip("`") if background.startswith("`") else None,
                light=None if light == "—" else light,
                dark=None if dark == "—" else dark,
                selectors=tuple(_normalise(s) for s in _BACKTICKED.findall(selectors)),
            )
        )
    return rows


# --- Contrast --------------------------------------------------------------------


def _channel(value: int) -> float:
    unit = value / 255
    return unit / 12.92 if unit <= 0.03928 else ((unit + 0.055) / 1.055) ** 2.4


def relative_luminance(colour: str) -> float:
    red, green, blue = (int(colour[i : i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * _channel(red) + 0.7152 * _channel(green) + 0.0722 * _channel(blue)


def contrast_ratio(first: str, second: str) -> float:
    lighter, darker = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def _printed(ratio: float) -> str:
    return f"{ratio:.2f}".replace(".", ",")


# --- The table's own policy ------------------------------------------------------


def check_table(rows: list[Row], tokens: Tokens) -> list[str]:
    problems: list[str] = []
    surfaces = [row.token for row in rows if row.kind == KIND_SURFACE]
    if not surfaces:
        problems.append("the table lists no surface")
    for row in rows:
        if row.kind not in _KINDS:
            problems.append(f"{row.token}: unknown kind {row.kind!r}")
    for surface in surfaces:
        for theme in THEMES:
            if surface not in tokens[theme]:
                problems.append(f"surface {surface} has no value in {theme}")

    for row in rows:
        if row.kind not in (KIND_GENERAL, KIND_PAIRED):
            if row.background is not None or row.light is not None or row.dark is not None:
                problems.append(f"{row.token} ({row.kind}): carries a background or a ratio")
            continue
        if row.background is None or row.light is None or row.dark is None:
            problems.append(f"{row.token} on {row.background}: background or ratio missing")
            continue
        if row.kind == KIND_GENERAL and row.background not in surfaces:
            problems.append(f"{row.token}: {row.background} is not a listed surface")
        for theme, printed in (("claro", row.light), ("oscuro", row.dark)):
            theme_tokens = tokens[theme]
            if row.token not in theme_tokens or row.background not in theme_tokens:
                problems.append(f"{row.token} on {row.background}: no value in {theme}")
                continue
            ratio = contrast_ratio(theme_tokens[row.token], theme_tokens[row.background])
            if ratio < MINIMUM_RATIO:
                problems.append(f"{row.token} on {row.background} in {theme}: {ratio:.2f} < 4.5")
            if printed != _printed(ratio):
                problems.append(
                    f"{row.token} on {row.background} in {theme}: README says {printed}, "
                    f"computed {_printed(ratio)}"
                )

    for token in sorted({row.token for row in rows if row.kind == KIND_GENERAL}):
        covered = [r.background for r in rows if r.token == token and r.kind == KIND_GENERAL]
        for surface in surfaces:
            if covered.count(surface) != 1:
                problems.append(f"general token {token} needs exactly one row on {surface}")
    for token in sorted({row.token for row in rows if row.kind == KIND_PAIRED}):
        if sum(1 for r in rows if r.token == token and r.kind == KIND_PAIRED) != 1:
            problems.append(f"paired token {token} needs exactly one row")
    return problems


# --- The rule check --------------------------------------------------------------


def _last_var(rule: Rule, properties: tuple[str, ...]) -> str | None:
    found = None
    for name, value in rule.declarations:
        if name in properties:
            match = _VAR.search(value)
            found = match.group(1) if match else None
    return found


def check_rules(rules: list[Rule], rows: list[Row]) -> list[str]:
    """(a) every `color: var(--X)` is a general or paired text token, or an icon-only
    token on a selector its row names; (b) a paired token's rule declares its
    background unless its selector is listed; (c) a colour and a surface or paired
    background in one rule are a pair the table allows."""
    general = {r.token for r in rows if r.kind == KIND_GENERAL}
    paired = {r.token: r for r in rows if r.kind == KIND_PAIRED}
    icons = {r.token: r.selectors for r in rows if r.kind == KIND_ICON}
    backgrounds = {r.token for r in rows if r.kind == KIND_SURFACE}
    backgrounds |= {r.background for r in rows if r.kind == KIND_PAIRED and r.background}
    allowed = {(r.token, r.background) for r in rows if r.background is not None}

    problems: list[str] = []
    for rule in rules:
        colour = _last_var(rule, ("color",))
        if colour is None:
            continue
        where = ", ".join(rule.selectors)
        if colour in paired:
            background = _last_var(rule, ("background", "background-color"))
            listed = all(s in paired[colour].selectors for s in rule.selectors)
            if background is None and not listed:
                problems.append(
                    f"{where}: {colour} without its background {paired[colour].background}"
                )
        elif colour in icons:
            if not all(s in icons[colour] for s in rule.selectors):
                problems.append(f"{where}: {colour} is icon-only and this selector is not listed")
        elif colour not in general:
            problems.append(f"{where}: {colour} is not a text token of the README table")
        background = _last_var(rule, ("background", "background-color"))
        if background in backgrounds and (colour, background) not in allowed:
            problems.append(f"{where}: {colour} on {background} is not in the README table")
    return problems


# --- The product's own files -----------------------------------------------------


def test_the_readme_table_holds_for_both_themes() -> None:
    rows = parse_table(README.read_text())
    assert rows, "the README table has no rows"
    assert check_table(rows, parse_tokens(TOKENS_CSS.read_text())) == []


def test_every_text_colour_in_the_stylesheets_is_in_the_table() -> None:
    rows = parse_table(README.read_text())
    for path in (APP_CSS, TOKENS_CSS):
        rules = css_rules(path.read_text())
        assert rules, f"{path.name} parsed to no rule"
        assert check_rules(rules, rows) == [], path.name


def test_only_the_bottom_bar_label_skips_its_paired_background() -> None:
    rows = parse_table(README.read_text())
    exempt = {(r.token, s) for r in rows if r.kind == KIND_PAIRED for s in r.selectors}
    assert exempt == {("--nav-inactivo", ".bar-inferior__item")}


# --- The guard bites: fixtures ---------------------------------------------------

_TOKENS: Tokens = {
    "claro": {
        "--fondo": "#ffffff",
        "--texto": "#000000",
        "--gris": "#777777",
        "--boton": "#000000",
        "--sobre-boton": "#ffffff",
    },
    "oscuro": {
        "--fondo": "#000000",
        "--texto": "#ffffff",
        "--gris": "#888888",
        "--boton": "#ffffff",
        "--sobre-boton": "#000000",
    },
}


def _table(*lines: str) -> list[Row]:
    return parse_table(
        "<!-- contraste:inicio -->\n"
        "| Token | Tipo | Fondo | Claro | Oscuro | Selectores |\n"
        "|---|---|---|---|---|---|\n" + "\n".join(lines) + "\n<!-- contraste:fin -->"
    )


_GOOD = (
    "| `--fondo` | superficie | — | — | — | |",
    "| `--texto` | general | `--fondo` | 21,00 | 21,00 | |",
    "| `--sobre-boton` | par | `--boton` | 21,00 | 21,00 | `.sin-fondo` |",
    "| `--gris` | ícono | — | — | — | `.flecha`, `.fila > svg` |",
)


def test_a_known_ratio_and_the_parsers() -> None:
    assert round(contrast_ratio("#000000", "#ffffff"), 2) == 21.0
    assert contrast_ratio("#123456", "#123456") == 1.0
    assert parse_tokens(
        ":root { --a: #ABCDEF; --b: 4px; }\n:root[data-tema='oscuro'] { --a: #000000; }"
    ) == {
        "claro": {"--a": "#abcdef"},
        "oscuro": {"--a": "#000000"},
    }
    rows = _table(*_GOOD)
    assert [r.kind for r in rows] == [KIND_SURFACE, KIND_GENERAL, KIND_PAIRED, KIND_ICON]
    assert rows[3].selectors == (".flecha", ".fila > svg")


def test_a_good_table_has_no_problem() -> None:
    assert check_table(_table(*_GOOD), _TOKENS) == []


def test_a_row_with_a_wrong_printed_ratio_fails() -> None:
    rows = _table(_GOOD[0], "| `--texto` | general | `--fondo` | 20,99 | 21,00 | |")
    assert any("README says 20,99" in p for p in check_table(rows, _TOKENS))


def test_a_row_under_four_and_a_half_fails() -> None:
    low: Tokens = {"claro": {**_TOKENS["claro"], "--texto": "#888888"}, "oscuro": _TOKENS["oscuro"]}
    rows = _table(_GOOD[0], "| `--texto` | general | `--fondo` | 3,54 | 21,00 | |")
    problems = check_table(rows, low)
    assert any("< 4.5" in p for p in problems)
    assert not any("README says" in p for p in problems)


def test_a_general_token_missing_a_surface_fails() -> None:
    rows = _table(*_GOOD, "| `--boton` | superficie | — | — | — | |")
    assert any("--texto needs exactly one row on --boton" in p for p in check_table(rows, _TOKENS))


def test_a_general_token_on_something_that_is_not_a_surface_fails() -> None:
    rows = _table(*_GOOD, "| `--texto` | general | `--boton` | 21,00 | 21,00 | |")
    assert any("--boton is not a listed surface" in p for p in check_table(rows, _TOKENS))


def test_an_icon_row_with_a_ratio_and_an_unknown_kind_fail() -> None:
    rows = _table(_GOOD[0], "| `--gris` | ícono | `--fondo` | 4,48 | 3,66 | `.flecha` |")
    assert any("carries a background or a ratio" in p for p in check_table(rows, _TOKENS))
    assert any(
        "unknown kind" in p
        for p in check_table(_table("| `--gris` | texto | — | — | — | |"), _TOKENS)
    )


def _rules(css: str) -> list[str]:
    return check_rules(css_rules(css), _table(*_GOOD))


def test_allowed_uses_pass() -> None:
    css = """
    /* color: var(--linea) in a comment is not a rule */
    .a { color: var(--texto); background: var(--fondo); border-color: var(--linea); }
    .b { color: var(--sobre-boton); background-color: var(--boton); }
    .sin-fondo { color: var(--sobre-boton); }
    .flecha, .fila > svg { color: var(--gris); }
    .c { color: currentColor; }
    .d { color: inherit; background: var(--boton); }
    """
    assert _rules(css) == []


def test_a_colour_that_is_not_a_listed_text_token_fails() -> None:
    assert any("--linea is not a text token" in p for p in _rules(".x { color: var(--linea); }"))


def test_an_icon_only_token_on_an_unlisted_selector_fails() -> None:
    assert any("icon-only" in p for p in _rules(".x { color: var(--gris); }"))
    assert any("icon-only" in p for p in _rules(".flecha, .otra { color: var(--gris); }"))


def test_a_paired_token_without_its_background_fails() -> None:
    assert any("without its background" in p for p in _rules(".x { color: var(--sobre-boton); }"))


def test_a_paired_token_on_a_selector_its_row_does_not_list_fails() -> None:
    assert _rules(".sin-fondo { color: var(--sobre-boton); }") == []
    for css in (
        ".sin-fondo__texto { color: var(--sobre-boton); }",
        ".sin-fondo, .otro { color: var(--sobre-boton); }",
    ):
        assert any("without its background" in p for p in _rules(css)), css
    declared = (
        ".contenedor { background: var(--boton); color: var(--sobre-boton); }"
        " .contenedor__texto { font-size: 15px; }"
    )
    assert _rules(declared) == []


def test_a_rule_inside_a_media_query_is_checked() -> None:
    css = "@media (min-width: 900px) { .x { color: var(--gris); } }"
    assert any("icon-only" in p for p in _rules(css))


def test_a_colour_on_a_background_the_table_does_not_allow_fails() -> None:
    assert any(
        "is not in the README table" in p
        for p in _rules(".x { color: var(--texto); background: var(--boton); }")
    )
    assert any(
        "is not in the README table" in p
        for p in _rules(".flecha { color: var(--gris); background: var(--fondo); }")
    )
