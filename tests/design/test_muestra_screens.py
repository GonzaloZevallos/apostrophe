"""The design screens of every active family agree with `docs/product/design-system/muestra.md`
(docs/adr/0035). A family is switched on by the piece that redraws it, listing its screens in
`muestra_families.py`; with none listed there is nothing to read and the test passes."""

from pathlib import Path

import pytest

from tests.design.muestra_families import (
    FAMILIES,
    OTRAS,
    PAUSED,
    PAUSED_CEILING,
    REDESIGN_SPANISH,
    Family,
    pause_problems,
)
from tests.design.muestra_guard import (
    CHECKS,
    Muestra,
    check_screen,
    date_problems,
    denylist_problems,
    parse_muestra,
    read_screen,
    spanish_label_problems,
)

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "docs" / "product" / "design-system"
SCREENS = DESIGN / "pantallas"


def real_muestra() -> Muestra:
    return parse_muestra((DESIGN / "muestra.md").read_text(encoding="utf-8"))


def screen_problems(family: Family, screen: str, page: str, muestra: Muestra) -> list[str]:
    """What the real-registry test holds a drawing to. A `PAUSED` drawing skips the figure
    agreement (`check_screen`'s `CHECKS` of its family) and nothing else: its dates, its denylist
    and, on Análisis, the English-label check still apply. The English-label check (GH-333)
    exempts only the files in `REDESIGN_SPANISH`, the drawings of the 2026-10-29 redesign,
    whose Spanish labels are the target. `check_screen` itself is never changed."""
    problems: list[str] = []
    if screen in PAUSED:
        read = read_screen(page)
        problems += date_problems(screen, read, muestra)
        problems += denylist_problems(screen, read, family.denylist)
    else:
        problems += check_screen(family.name, screen, page, muestra, family.denylist)
    if family.name == "analisis" and screen not in REDESIGN_SPANISH:
        problems += spanish_label_problems(screen, read_screen(page))
    return problems


def test_the_six_families_are_declared_once_each() -> None:
    names = [family.name for family in FAMILIES]

    assert names == ["inicio", "variedades", "ventas", "analisis", "archived", "otras"]
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
        problems += screen_problems(family, screen, page, muestra)

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
# The drawings whose figures are checked; a paused one has none of the old figures to drift.
ANALISIS_CHECKED = tuple(s for s in ANALISIS_SCREENS if s not in PAUSED)


def test_the_analisis_drift_tests_have_no_drawing_while_both_are_paused() -> None:
    # The drift, label, Own use and faltante tests below loop over ANALISIS_CHECKED. They hold
    # zero assertions while it is empty, so that state is pinned here, in the open: when a
    # drawing leaves the pause this fails, and the loops start asserting on it.
    assert ANALISIS_CHECKED == ()
    assert set(ANALISIS_SCREENS) <= set(PAUSED)


ANALISIS_STALE = (
    ("the old month", "October 2026", "September 2026"),
    ("the old month total", "$ 369.000", "$ 2.684.000"),
    ("a line muestra.md has, dropped", "Stock shortfall", "Shortfall"),
    ("a stale pending note", "and 1 g without cost", "includes pending cost"),
    ("a week that muestra.md lacks", "24/08", "11/08"),
    ("an old category", "Envíos", "Envíos y traslados"),
)


@pytest.mark.parametrize(("what", "right", "wrong"), ANALISIS_STALE, ids=lambda v: str(v)[:24])
def test_the_analisis_guard_rejects_a_screen_that_drifts(what: str, right: str, wrong: str) -> None:
    for screen in ANALISIS_CHECKED:
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


ANALISIS_SPANISH = (
    ("a cost line", "Stock shortfall", "Faltante de stock"),
    ("a best week", "Best week", "Mejor semana"),
    ("the grams given away", " g given away", " g regalado"),
    ("the pending note", "and 1 g without cost", "y 1 g sin costo"),
    ("the month heading", "October 2026", "Octubre 2026"),
    (
        "the grouped heading",
        "Moved since your first record, not the money you have in cash",
        "Desde el primer registro",
    ),
)


@pytest.mark.parametrize(
    ("what", "english", "spanish"), ANALISIS_SPANISH, ids=lambda v: str(v)[:24]
)
def test_the_analisis_guard_rejects_a_spanish_product_label(
    what: str, english: str, spanish: str
) -> None:
    for screen in ANALISIS_CHECKED:
        page = (SCREENS / screen).read_text(encoding="utf-8")
        assert english in page, what

        assert spanish_label_problems(screen, read_screen(page)) == []
        left_spanish = page.replace(english, spanish)

        assert spanish_label_problems(screen, read_screen(left_spanish)) != [], what


def test_the_analisis_guard_still_requires_the_other_cost_lines_on_the_rows() -> None:
    for screen in ANALISIS_CHECKED:
        page = (SCREENS / screen).read_text(encoding="utf-8")
        # Every Own use the screen draws, rows included, loses its label.
        drawn = "<span>Own use</span>"
        assert drawn in page
        broken = page.replace(drawn, "<span>Consumption</span>")

        problems = check_screen("analisis", screen, broken, real_muestra(), ())

        assert any("'Consumo propio' is missing" in p for p in problems)


def test_the_analisis_guard_requires_faltante_in_the_since_the_first_record_block() -> None:
    for screen in ANALISIS_CHECKED:
        page = (SCREENS / screen).read_text(encoding="utf-8")
        label = "Stock shortfall</span>"
        # The header draws it first, then the current week's and month's rows; the last one is
        # the since-the-first-record block's.
        assert page.count(label) == 4
        head, last = page.rsplit(label, 1)
        broken = head + "Shortfall</span>" + last

        problems = check_screen("analisis", screen, broken, real_muestra(), ())

        assert any("since 28/08 – 07/10: 'Faltante de stock' is missing" in p for p in problems)


@pytest.mark.parametrize("cost", ["$ 93.000", "$ 156.000"])
def test_the_analisis_guard_requires_faltante_on_the_current_week_and_month_rows(
    cost: str,
) -> None:
    for screen in ANALISIS_CHECKED:
        page = (SCREENS / screen).read_text(encoding="utf-8")
        bold = '<span style="color: #231E18; font-weight: 600">'
        after = f"{cost}</span><span>Stock shortfall</span>{bold}$ 10.000</span>"
        assert page.count(after) == 1
        gone = page.replace(after, f"{cost}</span>")
        wrong = page.replace(after, after.replace("$ 10.000", "$ 9.000"))

        for broken, expected in ((gone, "'Faltante de stock' is missing"), (wrong, "$ 9.000")):
            problems = check_screen("analisis", screen, broken, real_muestra(), ())
            assert any(expected in p for p in problems)


def test_the_analisis_denylist_keeps_the_figures_muestra_has() -> None:
    denylist = next(f for f in FAMILIES if f.name == "analisis").denylist
    body = (DESIGN / "muestra.md").read_text(encoding="utf-8")

    assert [literal for literal in denylist if literal in body] == []


ARCHIVED_SCREENS = next(f for f in FAMILIES if f.name == "archived").screens


def test_the_archived_family_lists_the_four_drawings() -> None:
    assert ARCHIVED_SCREENS == (
        "VariedadArchivada.dc.html",
        "VariedadArchivadaCompu.dc.html",
        "Archivadas.dc.html",
        "ArchivadasCompu.dc.html",
    )


ARCHIVED_DRIFTS = [
    (screen, what, right, wrong)
    for screen in ARCHIVED_SCREENS
    for what, right, wrong in (
        ("the grams", "25 g", "30 g"),
        ("the Archivada mark", "Archivada", "Guardada"),
        ("the Oculta mark", "Oculta", "Visible"),
    )
    if right in (SCREENS / screen).read_text(encoding="utf-8")
]


@pytest.mark.parametrize(("screen", "what", "right", "wrong"), ARCHIVED_DRIFTS)
def test_the_archived_guard_rejects_a_drawing_that_drifts_from_muestra(
    screen: str, what: str, right: str, wrong: str
) -> None:
    page = (SCREENS / screen).read_text(encoding="utf-8")

    problems = check_screen("archived", screen, page.replace(right, wrong), real_muestra(), ())

    assert problems != [], what


def test_every_archived_drawing_is_checked_for_its_marks() -> None:
    assert {(s, w) for s, w, _, _ in ARCHIVED_DRIFTS} >= {
        (screen, what)
        for screen in ARCHIVED_SCREENS
        for what in ("the Archivada mark", "the Oculta mark")
    }


# --- The muestra pause ------------------------------------------------------------------


def test_the_pause_lists_are_sound() -> None:
    assert pause_problems(PAUSED, PAUSED_CEILING, SCREENS) == []


def test_the_paused_figures_really_fail_and_the_other_checks_still_apply() -> None:
    muestra = real_muestra()
    for family in (f for f in FAMILIES if f.active):
        for screen in (s for s in family.screens if s in PAUSED):
            page = (SCREENS / screen).read_text(encoding="utf-8")

            # Pausing is only for a drawing whose figures fail; a fixed one leaves the list.
            assert check_screen(family.name, screen, page, muestra, family.denylist) != []
            # What is not the figure agreement still rejects a paused drawing.
            stale = page.replace("</body>", "<span>capturadas el 05/10/2026</span></body>")
            problems = screen_problems(family, screen, stale, muestra)
            assert any("not the capture date" in p for p in problems), screen
            denied = page.replace("</body>", f"<span>{family.denylist[0]}</span></body>")
            problems = screen_problems(family, screen, denied, muestra)
            assert any("the stale literal" in p for p in problems), screen


def test_a_paused_drawing_that_loses_its_figures_is_not_rejected_for_them() -> None:
    muestra = real_muestra()
    family = next(f for f in FAMILIES if f.name == "inicio")
    page = (SCREENS / "Inicio.dc.html").read_text(encoding="utf-8")

    assert "Inicio.dc.html" in PAUSED
    assert screen_problems(family, "Inicio.dc.html", page, muestra) == []


def test_the_redesign_drawings_are_exempt_from_the_english_label_rule_and_only_they() -> None:
    muestra = real_muestra()
    family = next(f for f in FAMILIES if f.name == "analisis")
    page = (SCREENS / "Analisis.dc.html").read_text(encoding="utf-8")
    spanish = "Spanish product label"

    # The exception names existing files of the family, and nothing else.
    assert set(REDESIGN_SPANISH) <= set(family.screens)
    for screen in REDESIGN_SPANISH:
        assert (SCREENS / screen).is_file(), screen
    # The redesign drawing really carries Spanish labels, and is not rejected for them.
    assert spanish_label_problems("Analisis.dc.html", read_screen(page)) != []
    assert not any(spanish in p for p in screen_problems(family, "Analisis.dc.html", page, muestra))
    # An older drawing with a Spanish label still fails.
    old = screen_problems(family, "AnalisisOscuro.dc.html", page, muestra)
    assert any("'Análisis' is a Spanish product label" in p for p in old)


PAUSE_OK: tuple[tuple[str, int], ...] = (("Inicio.dc.html", 497), ("Analisis.dc.html", 321))
PAUSE_REFUSED = (
    (
        "a name outside the ceiling",
        ("Inicio.dc.html", "InicioCompu.dc.html"),
        PAUSE_OK,
        "InicioCompu.dc.html is paused but is not in PAUSED_CEILING",
    ),
    (
        "a missing file",
        ("Inicio.dc.html", "Ghost.dc.html"),
        (*PAUSE_OK, ("Ghost.dc.html", 497)),
        "Ghost.dc.html has no file in pantallas/",
    ),
    (
        "a ceiling name outside the seven",
        ("Inicio.dc.html",),
        (*PAUSE_OK, ("Cobro.dc.html", 497)),
        "Cobro.dc.html in PAUSED_CEILING is not one of the seven pauseable drawings",
    ),
    (
        "a duplicate",
        ("Inicio.dc.html", "Inicio.dc.html"),
        PAUSE_OK,
        "Inicio.dc.html is paused twice",
    ),
    (
        "a zero issue",
        ("Inicio.dc.html",),
        (("Inicio.dc.html", 0), ("Analisis.dc.html", 321)),
        "Inicio.dc.html in PAUSED_CEILING has issue 0, not a positive integer",
    ),
    (
        "a negative issue",
        ("Inicio.dc.html",),
        (("Inicio.dc.html", -3), ("Analisis.dc.html", 321)),
        "Inicio.dc.html in PAUSED_CEILING has issue -3, not a positive integer",
    ),
)


def test_a_sound_pause_has_no_problems() -> None:
    assert pause_problems(("Inicio.dc.html",), PAUSE_OK, SCREENS) == []


@pytest.mark.parametrize(
    ("what", "paused", "ceiling", "expected"), PAUSE_REFUSED, ids=lambda v: str(v)[:24]
)
def test_the_pause_refuses_what_is_not_sound(
    what: str, paused: tuple[str, ...], ceiling: tuple[tuple[str, int], ...], expected: str
) -> None:
    assert expected in pause_problems(paused, ceiling, SCREENS), what
