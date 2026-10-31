"""The checks of `muestra_guard.py` over small inline pages: each one passes on a page that
matches a small `muestra.md` and fails, naming the screen, on a page that does not."""

import pytest

from tests.design.muestra_guard import (
    MuestraError,
    check_screen,
    date_problems,
    denylist_problems,
    parse_muestra,
    read_screen,
)


def table(header: str, *rows: str) -> str:
    cols = header.count("|") - 1
    divider = "|" + " --- |" * cols
    return "\n".join([header, divider, *rows]) + "\n"


def muestra_text(*, drop: str = "") -> str:
    sections = {
        "Variedades": table(
            "| Variedad | Gramos | Estado | Detalle | Días restantes | Precio hoy |",
            "| 24K Gold | 133 g | ok | Al ritmo de los últimos 30 días | 266 días | $ 12.000 x g |",
            "| Sir Jack | −1 g | agotada | Sin gramos desde el 07/10 | — | $ 11.000 x g |",
        ),
        "Movimientos": table(
            "| Variedad | Fecha | Tipo | Gramos |",
            "| 24K Gold | 07/10 | Ajuste | −2 g |",
            "| 24K Gold | 28/08 | Compra | 120 g |",
        ),
        "Clientes": table(
            "| Cliente | Saldo | Desde | Estado |",
            "| Lu Fernández | $ 0 | — | al día |",
            "| Nico Parra | $ 20.000 | 18/09 | debe |",
        ),
        "Te deben": "Total: $ 20.000\n1 venta debiendo\n",
        "Periodos": table(
            "| Período | Rango | Etiqueta | Valor | Pendiente |",
            "| Hoy | Hoy 07/10 | Vendiste | $ 194.000 | no |",
            "| Hoy | Hoy 07/10 | Ventas | 3 | no |",
            "| Hoy | Hoy 07/10 | Promedio | $ 64.667 | no |",
            "| Hoy | Hoy 07/10 | Gramos vendidos | 17 g | no |",
            "| Semana | 05/10 – 11/10 | Vendiste | $ 206.000 | no |",
            "| Semana | 05/10 – 11/10 | Ventas | 4 | no |",
            "| Semana | 05/10 – 11/10 | Promedio | $ 51.500 | no |",
            "| Semana | 05/10 – 11/10 | Gramos vendidos | 18 g | no |",
            "| Semana | 05/10 – 11/10 | Costo de lo vendido | $ 93.000 | no |",
            "| Semana | 05/10 – 11/10 | Faltante de stock | $ 10.000 | no |",
            "| Semana | 05/10 – 11/10 | Consumo propio | $ 14.000 | sí |",
            "| Semana | 05/10 – 11/10 | Gastos | $ 12.500 | no |",
            "| Semana | 05/10 – 11/10 | Ganancia | $ 41.500 | sí |",
            "| Mes | 01/10 – 31/10 | Vendiste | $ 369.000 | no |",
            "| Mes | 01/10 – 31/10 | Ventas | 6 | no |",
        ),
        "Ventas": table(
            "| Fecha | Cliente | Total | Te debe | Cómo se pagó |",
            "| 07/10 | Lu Fernández | $ 28.000 | no | Efectivo |",
            "| 07/10 | — | $ 36.000 | no | Efectivo |",
            "| 18/09 | Nico Parra | $ 25.000 | sí | Debiendo |",
        ),
        "Líneas de venta": table(
            "| Venta | Variedad | Gramos | Precio x g | Regla | Total |",
            "| 18/09 · Nico Parra · $ 25.000 | 24K Gold | 2 g | $ 12.000 x g | Lista | $ 24.000 |",
        ),
        "Cuentas": table(
            "| Cliente | Fecha | Concepto | Monto | Detalle | Saldo |",
            "| Nico Parra | 18/09 | Venta | $ 25.000 | Debiendo | $ 25.000 |",
            "| Nico Parra | 05/10 | Pago | $ 5.000 | Efectivo | $ 20.000 |",
        ),
        "Análisis · Octubre 2026": table(
            "| Etiqueta | Valor | Pendiente |",
            "| Vendiste en el mes | $ 369.000 | no |",
            "| Gramos vendidos | 32 g | no |",
            "| Margen promedio | 57% | no |",
            "| Faltante de stock | $ 10.000 | no |",
            "| Consumo propio | $ 14.000 | y 1 g sin costo |",
        ),
        "Análisis · variedades del mes": table(
            "| Variedad | Ventas | Gramos vendidos | Costo | % del mes | Margen % |",
            "| 24K Gold | $ 136.000 | 13 g | $ 65.000 | 38% | 52% |",
        ),
        "Análisis · gastos del mes": table(
            "| Categoría | Total |", "| Envíos | $ 4.500 |", "| Compras de flores | $ 150.000 |"
        ),
        "Análisis · gastos desde el primer registro": table(
            "| Categoría | Total |", "| Envíos | $ 4.500 |", "| Compras de flores | $ 1.030.000 |"
        ),
        "Análisis · semanas": table(
            "| Período | Rango | Etiqueta | Valor | Pendiente |",
            "| Semana | 28/09 – 04/10 | Ventas | $ 163.000 | no |",
            "| Semana | 05/10 – 11/10 | Ventas | $ 206.000 | no |",
            "| Semana | 05/10 – 11/10 | Consumo propio | $ 14.000 | y 1 g sin costo |",
            "| Semana | 05/10 – 11/10 | Mejor semana | sí | no |",
        ),
        "Análisis · meses": table(
            "| Período | Rango | Etiqueta | Valor | Pendiente |",
            "| Mes | 01/10 – 31/10 | Ventas | $ 369.000 | no |",
        ),
        "Análisis · días de la semana": table(
            "| Día | Ventas | # ventas | Mejor |",
            *(
                f"| {d} | $ {i}.000 | 1 | no |"
                for i, d in enumerate(("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"), start=1)
            ),
        ),
        "Análisis · desde el primer registro": table(
            "| Período | Rango | Etiqueta | Valor | Pendiente |",
            "| Desde el primer registro | 28/08 – 07/10 | Ventas | $ 537.000 | no |",
        ),
        "Archivadas": table(
            "| Variedad | Gramos | Precio hoy | Oculta |",
            "| Blue Dream | 25 g | $ 13.000 x g | sí |",
            "| Old Kush | 4 g | $ 9.000 x g | no |",
        ),
    }
    body = "".join(f"### {h}\n\n{t}\n" for h, t in sections.items() if h != drop)
    return (
        f"# Muestra\n\n## Cifras capturadas\n\nCapturada: 2026-10-07\n\n{body}## Cómo se obtuvo\n"
    )


MUESTRA = parse_muestra(muestra_text())


def tabs(selected: str) -> str:
    def one(label: str) -> str:
        style = ' style="font-weight: 600"' if label == selected else ""
        return f"<span{style}>{label}</span>"

    return "<div>" + "".join(one(label) for label in ("Hoy", "Semana", "Mes")) + "</div>"


def page(*items: str) -> str:
    return (
        "<body>"
        + "".join(i if i.startswith("<") else f"<span>{i}</span>" for i in items)
        + "</body>"
    )


HOY = [tabs("Hoy"), "Hoy 07/10", "Vendiste hoy", "$ 194.000", "3 ventas · promedio $ 64.667 · 17 g"]
SEMANA = [
    tabs("Semana"),
    "05/10 – 11/10",
    "Vendiste esta semana",
    "$ 206.000",
    "4 ventas · promedio $ 51.500 · 18 g",
    "Costo de lo vendido",
    "$ 93.000",
    "Faltante de stock",
    "$ 10.000",
    "Consumo propio",
    "$ 14.000",
    "incluye costo pendiente",
    "Gastos",
    "$ 12.500",
    "Ganancia",
    "$ 41.500",
    "incluye costo pendiente",
]
MES = [tabs("Mes"), "01/10 – 31/10", "Vendiste este mes", "$ 369.000", "6 ventas"]


def inicio_problems(*items: str) -> list[str]:
    return check_screen("inicio", "Inicio", page(*items), MUESTRA, ())


def test_a_page_that_matches_muestra_has_no_problems() -> None:
    assert inicio_problems(*HOY, *SEMANA, *MES) == []


def test_read_screen_drops_comments_scripts_and_styles_and_splits_at_tags_and_dots() -> None:
    screen = read_screen(
        "<!-- 99 g --><style>.a{}</style><script>var x = '88 g'</script>"
        "<span>3 ventas · 17&nbsp;g</span><b>Caja</b>$ 5"
    )
    assert screen.parts == ("3 ventas", "17 g", "Caja", "$ 5")
    assert "99 g" not in screen.text and "88 g" not in screen.text


# --- periods ----------------------------------------------------------------------------


def test_a_right_figure_under_the_wrong_period_fails() -> None:
    wrong = [*HOY[:3], "$ 206.000", *HOY[4:]]  # Semana's total under Hoy's range

    problems = inicio_problems(*wrong, *SEMANA, *MES)

    assert any("Hoy 07/10" in p and "$ 206.000" in p and p.startswith("Inicio:") for p in problems)


def test_a_known_label_with_no_range_before_it_fails() -> None:
    problems = inicio_problems("Gastos", "$ 12.500", *HOY, *SEMANA, *MES)

    assert any("'Gastos' $ 12.500 has no range before it" in p for p in problems)


def test_a_menu_entry_named_like_a_label_is_not_a_figure() -> None:
    assert inicio_problems("Gastos", "Análisis", *HOY, *SEMANA, *MES) == []


def test_an_expected_range_that_is_missing_fails() -> None:
    stale = ["05/10" if part == "Hoy 07/10" else part for part in HOY]

    problems = inicio_problems(*stale, *SEMANA, *MES)

    assert any("range 'Hoy 07/10' of the tab Hoy is missing" in p for p in problems)


def test_a_screen_with_no_range_at_all_fails() -> None:
    assert any("no period range" in p for p in inicio_problems("Vendiste hoy", "$ 1"))


def test_a_range_under_a_tab_other_than_the_selected_one_fails() -> None:
    wrong_tab = [tabs("Mes") if part == tabs("Semana") else part for part in SEMANA]

    problems = inicio_problems(*HOY, *wrong_tab, *MES)

    assert any("'05/10 – 11/10' (Semana) sits under the tab Mes" in p for p in problems)


def test_a_range_before_any_tab_bar_fails() -> None:
    assert any("sits under no tab bar" in p for p in inicio_problems("Hoy 07/10"))


def test_a_cost_line_muestra_has_and_the_screen_lacks_fails() -> None:
    without = [p for p in SEMANA if p not in ("Faltante de stock", "$ 10.000")]

    problems = inicio_problems(*HOY, *without, *MES)

    assert any("'Faltante de stock' is missing" in p for p in problems)


def test_a_cost_line_muestra_has_no_row_for_fails() -> None:
    problems = inicio_problems(*HOY, "Gastos", "$ 12.500", *SEMANA, *MES)

    assert any("Hoy 07/10: 'Gastos' is drawn and muestra.md has no row" in p for p in problems)


def test_cost_lines_out_of_muestra_order_fail() -> None:
    swapped = list(SEMANA)
    a, b = swapped.index("Costo de lo vendido"), swapped.index("Faltante de stock")
    swapped[a : a + 2], swapped[b : b + 2] = swapped[b : b + 2], swapped[a : a + 2]

    assert any("lines run" in p for p in inicio_problems(*HOY, *swapped, *MES))


def test_the_pending_note_sits_under_exactly_the_pending_lines() -> None:
    no_note = list(SEMANA)
    del no_note[no_note.index("Consumo propio") + 2]
    spurious = list(SEMANA)
    spurious.insert(spurious.index("Gastos") + 2, "incluye costo pendiente")

    assert any("'Consumo propio' note is None" in p for p in inicio_problems(*HOY, *no_note, *MES))
    assert any("'Gastos' note is" in p for p in inicio_problems(*HOY, *spurious, *MES))


def test_a_stale_period_value_fails() -> None:
    stale = ["$ 93.000" if part == "$ 41.500" else part for part in SEMANA]

    assert any("'Ganancia' reads $ 93.000" in p for p in inicio_problems(*HOY, *stale, *MES))


def test_the_ventas_screens_check_the_total_and_count_without_the_lines() -> None:
    ok = page(tabs("Semana"), "05/10 – 11/10 · 4 ventas", "$ 206.000")
    stale = page(tabs("Semana"), "05/10 – 11/10 · 3 ventas", "$ 194.000")

    assert check_screen("ventas", "Ventas", ok, MUESTRA, ()) == []
    problems = check_screen("ventas", "Ventas", stale, MUESTRA, ())
    assert any("'Ventas' reads 3" in p for p in problems)
    assert any("'Vendiste' reads $ 194.000" in p for p in problems)


def test_a_detail_page_with_no_period_is_no_period_screen_for_ventas() -> None:
    assert check_screen("ventas", "VentaDetalle", page("Total", "$ 25.000"), MUESTRA, ()) == []


# --- varieties --------------------------------------------------------------------------

GOLD = ["24K Gold", "133 g", "ok", "266 días", "Al ritmo de los últimos 30 días"]
JACK = ["Sir Jack", "−1 g", "agotada", "Sin gramos desde el 07/10"]


def variedades_problems(*items: str) -> list[str]:
    return check_screen("variedades", "Variedades", page(*items), MUESTRA, ())


def test_a_stock_row_matching_muestra_passes() -> None:
    assert variedades_problems(*GOLD, *JACK) == []
    assert variedades_problems("24K Gold", "ok", "133 g · 266 días", "$ 12.000 x g") == []


@pytest.mark.parametrize(
    ("stale", "message"),
    [
        (["135 g" if p == "133 g" else p for p in GOLD], "has 135 g, muestra.md says 133 g"),
        (["270 días" if p == "266 días" else p for p in GOLD], "days left 270 días"),
        (["Sin gramos desde el 05/10" if p.startswith("Sin") else p for p in JACK], "05/10"),
        (["0 g" if p == "−1 g" else p for p in JACK], "has 0 g, muestra.md says −1 g"),
        (["ok" if p == "agotada" else p for p in JACK], "is ok, muestra.md says agotada"),
    ],
)
def test_a_stock_row_with_a_stale_figure_fails(stale: list[str], message: str) -> None:
    assert any(message in p for p in variedades_problems(*stale))


def test_a_sold_out_variety_with_days_left_fails() -> None:
    assert any("days left 3 días" in p for p in variedades_problems(*JACK, "3 días"))


def test_a_variety_in_a_sale_line_is_not_a_stock_row() -> None:
    assert variedades_problems("24K Gold", "2 g", "$ 12.000 por gramo") == []


def test_a_movement_of_the_variety_must_be_in_muestra() -> None:
    ok = variedades_problems(*GOLD, "07/10", "Ajuste", "−2 g")
    stale = variedades_problems(*GOLD, "07/10", "Compra", "40 g")

    assert ok == []
    assert any("movement 07/10 Compra 40 g of '24K Gold'" in p for p in stale)


# --- customers and sales ----------------------------------------------------------------


def ventas_problems(*items: str) -> list[str]:
    return check_screen("ventas", "Ventas", page(*items), MUESTRA, ())


def test_a_customer_balance_and_since_date_match_muestra() -> None:
    assert ventas_problems("Nico Parra", "$ 20.000 · desde 18/09") == []
    assert ventas_problems("Nico Parra", "Te debe", "$ 20.000", "desde el 18/09") == []


def test_a_customer_with_a_stale_balance_or_since_date_fails() -> None:
    assert any(
        "owed since 16/09" in p for p in ventas_problems("Nico Parra", "$ 20.000 · desde 16/09")
    )
    assert any(
        "owes $ 12.000" in p for p in ventas_problems("Nico Parra", "$ 12.000 · desde 18/09")
    )


def test_a_customer_in_a_sale_row_is_not_a_balance() -> None:
    assert ventas_problems("07/10", "Lu Fernández", "$ 28.000") == []


def test_te_deben_total_and_count_match_muestra() -> None:
    assert ventas_problems("Te deben", "$ 20.000", "1 venta debiendo") == []
    problems = ventas_problems("Te deben", "$ 32.000", "2 ventas debiendo")
    assert any("Te deben reads $ 32.000" in p for p in problems)
    assert any("'2 ventas debiendo' but muestra.md says '1 venta debiendo'" in p for p in problems)


def test_a_sale_row_is_paired_with_its_date_and_customer() -> None:
    assert ventas_problems("07/10", "Sin cliente", "24K Gold · 3 g", "$ 36.000") == []
    problems = ventas_problems("07/10", "Lu Fernández", "Golden Cookies · 2 g", "$ 30.000")
    assert any("sale of 07/10 (Lu Fernández) with total $ 30.000" in p for p in problems)


def test_venta_del_is_paired_with_the_total() -> None:
    assert ventas_problems("Venta del 18/09", "te debe", "$ 25.000") == []
    problems = ventas_problems("Venta del 18/09", "te debe", "$ 26.000")
    assert any("sale of 18/09" in p and "$ 26.000" in p for p in problems)


def test_an_account_row_is_paired_with_the_customer_date_amount_and_balance() -> None:
    ok = ["Nico Parra", "05/10", "Cobro · efectivo", "− $ 5.000", "saldo $ 20.000"]
    stale = ["Nico Parra", "05/10", "Cobro · efectivo", "− $ 5.000", "saldo $ 25.000"]

    assert ventas_problems(*ok) == []
    assert any("account row of Nico Parra on 05/10" in p for p in ventas_problems(*stale))


def test_a_sale_line_is_paired_with_its_variety_grams_price_and_total() -> None:
    assert ventas_problems("24K Gold", "2 g", "$ 12.000 por gramo", "lista", "$ 24.000") == []
    problems = ventas_problems("24K Gold", "2 g", "$ 13.000 por gramo", "lista", "$ 26.000")
    assert any("line 24K Gold 2 g" in p for p in problems)


# --- dates and denylist -----------------------------------------------------------------


def test_every_dd_mm_must_be_in_muestra() -> None:
    assert date_problems("S", read_screen(page("desde 18/09")), MUESTRA) == []
    problems = date_problems("S", read_screen(page("desde 16/09", "y 1/9")), MUESTRA)
    assert [p for p in problems if "16/09" in p] and [p for p in problems if "1/9" in p]


def test_a_full_date_must_be_the_capture_date() -> None:
    assert date_problems("S", read_screen(page("capturadas el 07/10/2026")), MUESTRA) == []
    problems = date_problems("S", read_screen(page("capturadas el 05/10/2026")), MUESTRA)
    assert any("not the capture date 07/10/2026" in p for p in problems)


def test_a_denylisted_literal_fails_but_not_inside_a_longer_figure() -> None:
    deny = ("$ 93.000", "135 g")

    assert denylist_problems("S", read_screen(page("Costo", "$ 93.000")), deny)
    assert denylist_problems("S", read_screen(page("Hoy tiene 135 g.")), deny)
    assert denylist_problems("S", read_screen(page("$ 193.000", "1135 g", "$ 93.0000")), deny) == []


def test_check_screen_applies_the_denylist() -> None:
    problems = check_screen("otras", "X", page("Septiembre 2026"), MUESTRA, ("Septiembre 2026",))

    assert problems == ["X: the stale literal 'Septiembre 2026' is still drawn"]


# --- Análisis ---------------------------------------------------------------------------

DAYS = [
    x
    for i, d in enumerate(("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"), 1)
    for x in (d, f"$ {i}.000")
]
ANALISIS = [
    "Octubre 2026",
    "Vendiste en el mes",
    "$ 369.000",
    "32 g · margen promedio 57%",
    "Faltante de stock",
    "$ 10.000",
    "Consumo propio",
    "$ 14.000",
    "y 1 g sin costo",
    "Por variedad",
    "24K Gold",
    "$ 136.000",
    "38% del mes",
    "13 g",
    "costo $ 65.000",
    "margen 52%",
    "Semana a semana",
    "28/09",
    "05/10 – 11/10",
    "Ventas",
    "$ 206.000",
    "Consumo propio",
    "$ 14.000",
    "y 1 g sin costo",
    "Mejor semana: 05/10 · $ 206.000",
    "Esta: $ 206.000",
    "01/10 – 31/10",
    "Ventas",
    "$ 369.000",
    *DAYS,
    "Gastos del mes",
    "Envíos",
    "$ 4.500",
    "Compras de flores",
    "Van aparte",
    "$ 150.000",
    "Desde el primer registro",
    "Ventas",
    "$ 537.000",
    "Compras de flores",
    "$ 1.030.000",
]


def analisis_problems(items: list[str]) -> list[str]:
    return check_screen("analisis", "Analisis", page(*items), MUESTRA, ())


def replaced(items: list[str], old: str, new: str, nth: int = 0) -> list[str]:
    at = [i for i, p in enumerate(items) if p == old][nth]
    return [*items[:at], new, *items[at + 1 :]]


def test_an_analysis_screen_matching_muestra_passes() -> None:
    assert analisis_problems(ANALISIS) == []


def test_the_month_heading_and_its_lines_are_checked() -> None:
    assert any(
        "month heading 'Octubre 2026' is missing" in p
        for p in analisis_problems(replaced(ANALISIS, "Octubre 2026", "Septiembre 2026"))
    )
    no_shortfall = [p for p in ANALISIS if p not in ("Faltante de stock",)]
    no_shortfall.remove("$ 10.000")
    assert any("'Faltante de stock' is missing" in p for p in analisis_problems(no_shortfall))
    assert any(
        "'Vendiste en el mes' reads $ 2.684.000" in p
        for p in analisis_problems(replaced(ANALISIS, "$ 369.000", "$ 2.684.000"))
    )
    assert any(
        "header margin 41%" in p
        for p in analisis_problems(
            replaced(ANALISIS, "32 g · margen promedio 57%", "32 g · margen promedio 41%")
        )
    )


def test_the_pending_text_of_a_header_line_is_the_one_muestra_gives() -> None:
    problems = analisis_problems(replaced(ANALISIS, "y 1 g sin costo", "incluye costo pendiente"))

    assert any("'Consumo propio' note is 'incluye costo pendiente'" in p for p in problems)


def test_each_week_month_and_the_total_since_the_start_must_be_drawn() -> None:
    assert any(
        "the week '28/09 – 04/10' is missing" in p
        for p in analisis_problems(replaced(ANALISIS, "28/09", "21/09"))
    )
    assert any(
        "the month '01/10 – 31/10' is missing" in p
        for p in analisis_problems(replaced(ANALISIS, "01/10 – 31/10", "01/09 – 30/09"))
    )
    assert any(
        "the since" in p
        for p in analisis_problems(replaced(ANALISIS, "Desde el primer registro", "Desde siempre"))
    )


def test_a_right_figure_under_the_wrong_week_or_month_fails() -> None:
    problems = analisis_problems(replaced(ANALISIS, "$ 206.000", "$ 369.000", nth=0))

    assert any("week 05/10 – 11/10: 'Ventas' reads $ 369.000" in p for p in problems)


def test_a_week_that_draws_lines_draws_the_ones_muestra_has() -> None:
    lines = [p for p in ANALISIS if p != "y 1 g sin costo"]  # drops the notes of both
    problems = analisis_problems(lines)
    assert any("week 05/10 – 11/10: 'Consumo propio' note is None" in p for p in problems)


def test_the_variety_rows_the_weekdays_and_the_expenses_are_checked() -> None:
    assert any(
        "'24K Gold' share is 48%" in p
        for p in analisis_problems(replaced(ANALISIS, "38% del mes", "48% del mes"))
    )
    assert any(
        "'Vie' reads $ 392.000" in p
        for p in analisis_problems(replaced(ANALISIS, "$ 5.000", "$ 392.000"))
    )
    assert any(
        "'Envíos' reads $ 41.800 under 'Gastos del mes'" in p
        for p in analisis_problems(replaced(ANALISIS, "$ 4.500", "$ 41.800"))
    )
    assert any(
        "'Compras de flores' reads $ 537.500 under 'Desde el primer registro'" in p
        for p in analisis_problems(replaced(ANALISIS, "$ 1.030.000", "$ 537.500"))
    )


def test_the_best_week_and_this_week_are_checked() -> None:
    assert any(
        "is not the best week" in p
        for p in analisis_problems(
            replaced(ANALISIS, "Mejor semana: 05/10 · $ 206.000", "Mejor semana: 15/09 · $ 512.000")
        )
    )
    assert any(
        "this week sold $ 206.000" in p
        for p in analisis_problems(replaced(ANALISIS, "Esta: $ 206.000", "Esta: $ 486.000"))
    )


# --- loud failures on muestra.md --------------------------------------------------------


@pytest.mark.parametrize(
    ("family", "dropped"),
    [
        ("inicio", "Periodos"),
        ("inicio", "Te deben"),
        ("variedades", "Variedades"),
        ("ventas", "Líneas de venta"),
        ("analisis", "Análisis · días de la semana"),
    ],
)
def test_a_muestra_without_a_table_the_check_needs_fails_naming_the_screen(
    family: str, dropped: str
) -> None:
    muestra = parse_muestra(muestra_text(drop=dropped))

    problems = check_screen(family, "Pantalla", page("x"), muestra, ())

    assert any(p.startswith("Pantalla: muestra.md has no table") for p in problems)


def test_a_muestra_without_a_vendiste_row_for_a_period_fails() -> None:
    text = muestra_text().replace("| Mes | 01/10 – 31/10 | Vendiste | $ 369.000 | no |\n", "")

    problems = check_screen("inicio", "Inicio", page("x"), parse_muestra(text), ())

    assert any("no 'Vendiste' for the period Mes" in p for p in problems)


def test_a_muestra_without_its_capture_line_is_refused() -> None:
    with pytest.raises(MuestraError):
        parse_muestra("### Variedades\n")


# --- archived varieties -----------------------------------------------------------------


def archived_problems(*items: str) -> list[str]:
    return check_screen("archived", "Archivada", page(*items), MUESTRA, ())


def test_an_archived_page_with_its_own_grams_and_marks_has_no_problems() -> None:
    assert (
        archived_problems("Blue Dream", "Archivada", "Oculta", "25 g", "$ 13.000 por gramo") == []
    )
    assert archived_problems("Old Kush", "Archivada", "4 g") == []
    # A list row has no grams: the marks are what it must carry.
    assert archived_problems("Blue Dream", "Archivada", "Oculta", "Old Kush", "Archivada") == []


@pytest.mark.parametrize(
    ("items", "message"),
    [
        (("Blue Dream", "Archivada", "Oculta", "30 g"), "'Blue Dream' has 30 g"),
        (("Blue Dream", "Oculta", "25 g"), "'Blue Dream' lacks Archivada"),
        (("Blue Dream", "Archivada", "25 g"), "'Blue Dream' lacks Oculta"),
        (("Old Kush", "Archivada", "Oculta", "4 g"), "'Old Kush' says Oculta"),
        (
            ("Blue Dream", "Archivada", "Oculta", "25 g", "$ 12.000 por gramo"),
            "'Blue Dream' costs $ 12.000 x g",
        ),
    ],
)
def test_an_archived_screen_that_disagrees_with_muestra_is_rejected(
    items: tuple[str, ...], message: str
) -> None:
    problems = archived_problems(*items)

    assert any(p.startswith("Archivada:") and message in p for p in problems), problems


def test_a_muestra_without_the_archived_table_fails_naming_the_screen() -> None:
    muestra = parse_muestra(muestra_text(drop="Archivadas"))

    problems = check_screen("archived", "Pantalla", page("x"), muestra, ())

    assert any(p.startswith("Pantalla: muestra.md has no table") for p in problems)
