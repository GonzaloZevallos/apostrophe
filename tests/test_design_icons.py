"""Pins the drawn icon set to the design contract (GH-97, subtask `icon-names`).

`web/src/components/Icono.tsx` draws the icons and `docs/product/design-system/componentes.ts`
names them for the design. A vitest test cannot read `docs/` (Vite's `server.fs.allow`
denies a path outside the web root, ADR-0029), so this guard is a pytest over both files
read with `pathlib`, like `test_design_tokens.py`.

It fails when:
- a name is in one list and not the other (both directions);
- `Icono`'s `<svg>` does not state 22 px, stroke 1.6, `currentColor` and `fill="none"`,
  or either file still lets a caller pass `size` or `strokeWidth`;
- a glyph (a `TRAZOS` entry and what it is built from) sets its own stroke, a fill
  other than `none`, a transform, or nests an `<svg>`.

Every check is a function over text, so its tests feed it input it must reject too.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ICONO = REPO_ROOT / "web" / "src" / "components" / "Icono.tsx"
COMPONENTES = REPO_ROOT / "docs" / "product" / "design-system" / "componentes.ts"

_BLOCK_COMMENT = re.compile(r"/\*[\s\S]*?\*/")
_LINE_COMMENT = re.compile(r"^\s*//.*$", re.MULTILINE)
_NAME = re.compile(r"'([A-Za-z]+)'")


def _strip_comments(source: str) -> str:
    return _LINE_COMMENT.sub("", _BLOCK_COMMENT.sub("", source))


def drawn_names(icono_source: str) -> list[str]:
    """The names in `ICON_NAMES = [...] as const` of `Icono.tsx`."""
    match = re.search(r"export const ICON_NAMES = \[([\s\S]*?)\] as const", _strip_comments(icono_source))
    assert match is not None, "Icono.tsx has no `export const ICON_NAMES = [...] as const`"
    return _NAME.findall(match.group(1))


def contract_names(componentes_source: str) -> list[str]:
    """The names in `export type NombreIcono = | '...' ...;` of `componentes.ts`."""
    match = re.search(r"export type NombreIcono =([^;]*);", _strip_comments(componentes_source))
    assert match is not None, "componentes.ts has no `export type NombreIcono = ...;`"
    return _NAME.findall(match.group(1))


def name_mismatches(drawn: list[str], contract: list[str]) -> list[str]:
    problems = [f"{name} is drawn in Icono.tsx but missing from componentes.ts" for name in drawn if name not in contract]
    problems += [f"{name} is in componentes.ts but not drawn in Icono.tsx" for name in contract if name not in drawn]
    for label, names in (("Icono.tsx", drawn), ("componentes.ts", contract)):
        problems += [f"{name} is listed twice in {label}" for name in sorted(set(names)) if names.count(name) > 1]
    return problems


def svg_problems(icono_source: str) -> list[str]:
    """What `Icono`'s own `<svg>` must say once, for every icon."""
    source = _strip_comments(icono_source)
    match = re.search(r"export default function Icono[\s\S]*?<svg([\s\S]*?)>", source)
    if match is None:
        return ["Icono.tsx has no `export default function Icono` drawing an <svg>"]
    tag = match.group(1)
    problems = []
    for needle, why in (
        ("width={22}", "width 22"),
        ("height={22}", "height 22"),
        ("strokeWidth={1.6}", "stroke width 1.6"),
        ('stroke="currentColor"', "stroke currentColor"),
        ('fill="none"', 'fill "none"'),
    ):
        if needle not in tag:
            problems.append(f"Icono's <svg> does not state {why} ({needle})")
    return problems


def prop_problems(label: str, source: str) -> list[str]:
    """`IconoProps` lets no caller choose a size or a stroke."""
    match = re.search(r"export interface IconoProps \{([\s\S]*?)\n\}", _strip_comments(source))
    if match is None:
        return [f"{label} has no `export interface IconoProps`"]
    return [
        f"{label}'s IconoProps still has `{prop}`"
        for prop in ("size", "strokeWidth")
        if re.search(rf"\b{prop}\s*\??:", match.group(1))
    ]


def glyph_problems(icono_source: str) -> list[str]:
    """Every glyph is bare geometry: the `<svg>` above it sets the stroke and the fill."""
    source = _strip_comments(icono_source)
    start = re.search(r"\] as const", source)
    end = re.search(r"export default function Icono", source)
    if start is None or end is None:
        return ["Icono.tsx: cannot find where the glyphs are"]
    glyphs = source[start.end() : end.start()]
    problems = []
    if re.search(r"\bstroke[\w-]*\s*=", glyphs):
        problems.append("a glyph sets its own stroke")
    if re.search(r"\bfill\s*=\s*(?!\"none\")", glyphs):
        problems.append('a glyph sets a fill other than "none"')
    if re.search(r"\btransform\s*=", glyphs):
        problems.append("a glyph sets a transform")
    if "<svg" in glyphs:
        problems.append("a glyph nests an <svg>")
    return problems


# --- the real files ------------------------------------------------------------------


def test_icono_and_the_design_contract_name_the_same_icons() -> None:
    assert name_mismatches(drawn_names(ICONO.read_text()), contract_names(COMPONENTES.read_text())) == []


def test_every_icon_is_drawn_once_at_22_px_and_stroke_1_6() -> None:
    assert svg_problems(ICONO.read_text()) == []


def test_no_caller_can_choose_a_size_or_a_stroke() -> None:
    assert prop_problems("Icono.tsx", ICONO.read_text()) == []
    assert prop_problems("componentes.ts", COMPONENTES.read_text()) == []


def test_no_glyph_sets_its_own_stroke_fill_or_transform() -> None:
    assert glyph_problems(ICONO.read_text()) == []


# --- the checks themselves, on input they must reject --------------------------------

_ICONO_OK = """
export const ICON_NAMES = ['a', 'b'] as const
export type NombreIcono = (typeof ICON_NAMES)[number]
export interface IconoProps {
  nombre: NombreIcono
  label?: string
}
const TRAZOS = { a: <path d="M0 0" />, b: <circle r="1" /> }
export default function Icono({ nombre }: IconoProps) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      {TRAZOS[nombre]}
    </svg>
  )
}
"""


def test_a_name_in_only_one_list_is_a_mismatch_in_both_directions() -> None:
    assert name_mismatches(["a", "b"], ["a", "b"]) == []
    assert name_mismatches(["a", "b"], ["a"]) == ["b is drawn in Icono.tsx but missing from componentes.ts"]
    assert name_mismatches(["a"], ["a", "c"]) == ["c is in componentes.ts but not drawn in Icono.tsx"]
    assert name_mismatches(["a", "a"], ["a"]) == ["a is listed twice in Icono.tsx"]


def test_the_name_parsers_read_the_two_declarations() -> None:
    assert drawn_names(_ICONO_OK) == ["a", "b"]
    assert contract_names("export type NombreIcono =\n  | 'a'\n  | 'b';") == ["a", "b"]


def test_a_clean_icono_passes_every_check() -> None:
    assert svg_problems(_ICONO_OK) == []
    assert prop_problems("x", _ICONO_OK) == []
    assert glyph_problems(_ICONO_OK) == []


def test_an_svg_without_the_one_size_and_stroke_is_refused() -> None:
    wrong = _ICONO_OK.replace("strokeWidth={1.6}", "strokeWidth={2}").replace("width={22}", "width={size}")
    assert svg_problems(wrong) == [
        "Icono's <svg> does not state width 22 (width={22})",
        "Icono's <svg> does not state stroke width 1.6 (strokeWidth={1.6})",
    ]


def test_a_size_or_stroke_prop_is_refused() -> None:
    wrong = _ICONO_OK.replace("label?: string", "size?: number\n  strokeWidth?: number")
    assert prop_problems("x", wrong) == ["x's IconoProps still has `size`", "x's IconoProps still has `strokeWidth`"]


def test_a_glyph_that_sets_stroke_fill_transform_or_nests_an_svg_is_refused() -> None:
    for glyph, expected in (
        ('<path d="M0 0" strokeWidth="2" />', "a glyph sets its own stroke"),
        ('<path d="M0 0" stroke-width="2" />', "a glyph sets its own stroke"),
        ('<circle r="1" stroke="none" />', "a glyph sets its own stroke"),
        ('<circle r="1" fill="currentColor" />', 'a glyph sets a fill other than "none"'),
        ('<path d="M0 0" transform="scale(2)" />', "a glyph sets a transform"),
        ('<svg><path d="M0 0" /></svg>', "a glyph nests an <svg>"),
    ):
        wrong = _ICONO_OK.replace('<path d="M0 0" />', glyph)
        assert expected in glyph_problems(wrong), glyph


def test_a_glyph_may_say_fill_none() -> None:
    assert glyph_problems(_ICONO_OK.replace('<path d="M0 0" />', '<path d="M0 0" fill="none" />')) == []
