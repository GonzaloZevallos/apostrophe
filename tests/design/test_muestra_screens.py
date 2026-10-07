"""The design screens of every active family agree with `docs/product/design-system/muestra.md`
(docs/adr/0033). A family is switched on by the piece that redraws it, listing its screens in
`muestra_families.py`; with none listed there is nothing to read and the test passes."""

from pathlib import Path

import pytest

from tests.design.muestra_families import FAMILIES, OTRAS, Family
from tests.design.muestra_guard import CHECKS, Muestra, check_screen, parse_muestra

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "docs" / "product" / "design-system"
SCREENS = DESIGN / "pantallas"


def real_muestra() -> Muestra:
    return parse_muestra((DESIGN / "muestra.md").read_text(encoding="utf-8"))


def test_the_five_families_are_declared_once_each() -> None:
    names = [family.name for family in FAMILIES]

    assert names == ["inicio", "variedades", "ventas", "analisis", "otras"]
    assert set(CHECKS) == set(names)


def test_otras_is_reserved_and_no_piece_fills_it() -> None:
    assert OTRAS.screens == () and OTRAS.denylist == ()


def test_no_screen_is_listed_in_two_families() -> None:
    listed = [screen for family in FAMILIES for screen in family.screens]

    assert len(listed) == len(set(listed))


def test_the_real_muestra_has_every_table_each_check_needs() -> None:
    muestra = real_muestra()
    for family in FAMILIES:
        problems = check_screen(family.name, "probe", "<span>x</span>", muestra, family.denylist)

        assert [p for p in problems if "muestra.md has no" in p or "not exactly" in p] == []


@pytest.mark.parametrize("family", [f for f in FAMILIES if f.active], ids=lambda f: f.name)
def test_each_listed_screen_agrees_with_muestra(family: Family) -> None:
    muestra = real_muestra()
    problems: list[str] = []
    for screen in family.screens:
        page = (SCREENS / screen).read_text(encoding="utf-8")
        problems += check_screen(family.name, screen, page, muestra, family.denylist)

    assert problems == []


def test_the_ventas_family_rejects_a_screen_that_kept_the_old_figures() -> None:
    muestra = real_muestra()
    page = (SCREENS / "Ventas.dc.html").read_text(encoding="utf-8")
    stale = page.replace("4 ventas", "3 ventas").replace("$ 206.000", "$ 194.000")
    stale = stale.replace("07/10", "05/10")

    problems = check_screen("ventas", "Ventas.dc.html", stale, muestra, ())

    assert any("'Ventas' reads 3" in p for p in problems)
    assert any("05/10" in p and "not in muestra.md" in p for p in problems)


ANALISIS_SCREENS = ("Analisis.dc.html", "AnalisisCompu.dc.html")
ANALISIS_STALE = (
    ("the old month", "Octubre 2026", "Septiembre 2026"),
    ("the old month total", "$ 369.000", "$ 2.684.000"),
    ("a line muestra.md has, dropped", "Faltante de stock", "Faltante"),
    ("a stale pending note", "y 1 g sin costo", "incluye costo pendiente"),
    ("a week that muestra.md lacks", "24/08", "11/08"),
    ("an old category", "Envíos", "Envíos y traslados"),
)


@pytest.mark.parametrize("screen", ANALISIS_SCREENS)
@pytest.mark.parametrize(("what", "right", "wrong"), ANALISIS_STALE, ids=lambda v: str(v)[:24])
def test_the_analisis_guard_rejects_a_screen_that_drifts(
    screen: str, what: str, right: str, wrong: str
) -> None:
    page = (SCREENS / screen).read_text(encoding="utf-8")
    assert right in page, what

    problems = check_screen(
        "analisis",
        screen,
        page.replace(right, wrong),
        real_muestra(),
        next(f for f in FAMILIES if f.name == "analisis").denylist,
    )

    assert problems != [], what


def test_the_analisis_denylist_keeps_the_figures_muestra_has() -> None:
    denylist = next(f for f in FAMILIES if f.name == "analisis").denylist
    body = (DESIGN / "muestra.md").read_text(encoding="utf-8")

    assert [literal for literal in denylist if literal in body] == []
