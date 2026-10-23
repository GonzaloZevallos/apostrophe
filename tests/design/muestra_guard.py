"""Checks a design screen against `docs/product/design-system/muestra.md` (docs/adr/0035).

A screen is read as visible text: comments, `<script>` and `<style>` are dropped, every tag
becomes a break, and a line is split at ` · `, so each figure and each label is a "part".
This is regexes over the text, not an HTML parser. A period is keyed on the range string it
shows ("Hoy 07/10", "05/10 – 11/10"), the label next to a value is paired with the value,
and the pair is compared with the row `muestra.md` has for that period and label.

Every check returns a list of problems, each naming the screen; empty means it passes. A
`muestra.md` that lacks a table or a row a check needs raises `MuestraError`, which
`check_screen` reports as a problem too.
"""

import html
import re
from collections.abc import Callable
from dataclasses import dataclass

HEADLINE = ("Vendiste", "Ventas", "Promedio", "Gramos vendidos")
LINES = (
    "Regalaste",
    "Costo de lo vendido",
    "Faltante de stock",
    "Promoción",
    "Consumo propio",
    "Gastos",
    "Compras de flores",
    "Ganancia",
    "Caja",
)
PERIOD_TABS = ("Hoy", "Semana", "Mes")
STATUSES = ("ok", "baja", "agotada", "sin entradas")
DETAIL_KINDS = (
    "Sin gramos desde el ",
    "Avisás abajo de ",
    "Al ritmo de los últimos",
    "Cargale la primera entrada",
)
PENDING_NOTE = "incluye costo pendiente"
WEEKDAYS = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")
GROUPED_SECTION = "Desde el primer registro"

MONEY = re.compile(r"^[−-]?\$ \d[\d.]*$")
GRAMS = re.compile(r"^[−-]?\d+(?:,\d+)? g$")
DATE_PART = re.compile(r"^\d\d/\d\d$")
DATE_LITERAL = re.compile(r"(?<![\d/])\d{1,2}/\d{1,2}(?![\d/])")
FULL_DATE_LITERAL = re.compile(r"(?<![\d/])\d{1,2}/\d{1,2}/\d{4}(?!\d)")
NOTE_PART = re.compile(r"^(?:incluye costo pendiente|y \d+(?:,\d+)? g sin costo)$")
DESDE = re.compile(r"\bdesde (?:el )?(\d\d/\d\d)\b")


class MuestraError(Exception):
    """`muestra.md` lacks a table or a row the guard needs."""


# --- muestra.md -------------------------------------------------------------------------


@dataclass(frozen=True)
class Section:
    rows: tuple[dict[str, str], ...]
    lines: tuple[str, ...]


@dataclass(frozen=True)
class Muestra:
    captured: str
    sections: dict[str, Section]
    dates: frozenset[str]

    def section(self, heading: str) -> Section:
        if heading not in self.sections:
            raise MuestraError(f"muestra.md has no table '{heading}'")
        return self.sections[heading]

    def table(self, heading: str) -> tuple[dict[str, str], ...]:
        return self.section(heading).rows


def _cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def parse_muestra(text: str) -> Muestra:
    """The tables and loose lines of every `###` section of `muestra.md`."""
    captured = re.search(r"^Capturada: (\d{4})-(\d\d)-(\d\d)$", text, flags=re.MULTILINE)
    if captured is None:
        raise MuestraError("muestra.md has no 'Capturada:' line")
    body = text.split("## Cómo se obtuvo", 1)[0]
    sections: dict[str, Section] = {}
    heading = ""
    header: list[str] = []
    rows: list[dict[str, str]] = []
    lines: list[str] = []

    def close() -> None:
        if heading:
            sections[heading] = Section(rows=tuple(rows), lines=tuple(lines))

    for line in body.splitlines():
        if line.startswith("### "):
            close()
            heading, header, rows, lines = line[4:].strip(), [], [], []
        elif line.startswith("|") and heading:
            cells = _cells(line)
            if not header:
                header = cells
            elif not all(set(cell) <= {"-", ":", " "} for cell in cells):
                rows.append(dict(zip(header, cells, strict=False)))
        elif line.strip() and heading:
            lines.append(line.strip())
    close()
    year, month, day = captured.groups()
    return Muestra(
        captured=f"{day}/{month}/{year}",
        sections=sections,
        dates=frozenset(re.findall(r"\d\d/\d\d", body)),
    )


# --- the screen as text -----------------------------------------------------------------

_TAB_BAR = re.compile(
    r"<span([^>]*)>\s*(Hoy)\s*</span>\s*<span([^>]*)>\s*(Semana)\s*</span>"
    r"\s*<span([^>]*)>\s*(Mes)\s*</span>"
)
_TAB_MARK = "@@TAB:"


def _is_selected(attributes: str) -> bool:
    return (
        "font-weight: 600" in attributes
        or 'aria-selected="true"' in attributes
        or "aria-current" in attributes
    )


@dataclass(frozen=True)
class TabBar:
    index: int  # where it sits among the parts
    selected: str | None  # None when no tab, or more than one, is drawn as selected


@dataclass(frozen=True)
class Screen:
    parts: tuple[str, ...]
    text: str
    tabs: tuple[TabBar, ...]


def _strip(page: str) -> str:
    return re.sub(
        r"<!--.*?-->|<(script|style)\b.*?</\1>", "", page, flags=re.DOTALL | re.IGNORECASE
    )


def read_screen(page: str) -> Screen:
    page = _strip(page)

    def mark(found: re.Match[str]) -> str:
        groups = found.groups()
        chosen = [groups[i + 1] for i in (0, 2, 4) if _is_selected(groups[i])]
        selected = chosen[0] if len(chosen) == 1 else ""
        return f"<p>{_TAB_MARK}{selected}@@</p>{found.group(0)}"

    marked = _TAB_BAR.sub(mark, page)
    lines = html.unescape(re.sub(r"<[^>]*>", "\n", marked)).split("\n")
    parts: list[str] = []
    tabs: list[TabBar] = []
    for line in lines:
        for piece in line.split(" · "):
            piece = " ".join(piece.split())
            if piece.startswith(_TAB_MARK):
                tabs.append(TabBar(len(parts), piece[len(_TAB_MARK) : -2] or None))
            elif piece:
                parts.append(piece)
    plain = " ".join(html.unescape(re.sub(r"<[^>]*>", " ", _TAB_BAR.sub("", page))).split())
    return Screen(parts=tuple(parts), text=plain, tabs=tuple(tabs))


# --- helpers ----------------------------------------------------------------------------


def minus(value: str) -> str:
    """The screen may type a hyphen where `muestra.md` has the minus sign."""
    return value.replace("-", "−")


def indexes(parts: tuple[str, ...], wanted: str) -> list[int]:
    return [i for i, part in enumerate(parts) if part == wanted]


def first_matching(parts: tuple[str, ...] | list[str], pattern: re.Pattern[str]) -> str | None:
    return next((p for p in parts if pattern.search(p)), None)


def expected_note(pending: str) -> str | None:
    """What sits under a value: Inicio says it as a sentence, Análisis as its own text."""
    if pending == "no":
        return None
    return PENDING_NOTE if pending == "sí" else pending


@dataclass(frozen=True)
class Found:
    label: str
    value: str
    note: str | None
    index: int


def labelled(parts: tuple[str, ...], start: int, end: int, labels: tuple[str, ...]) -> list[Found]:
    """Each label part in `parts[start:end]` with the value part that follows it (a money or
    a grams figure; a label with none, like a menu entry, is not a figure) and the note under
    that value."""
    found: list[Found] = []
    for i in range(start, end):
        if parts[i] not in labels or i + 1 >= len(parts):
            continue
        value = parts[i + 1]
        if not (MONEY.match(value) or GRAMS.match(value)):
            continue
        after = parts[i + 2] if i + 2 < len(parts) else ""
        note = after if NOTE_PART.match(after) else None
        found.append(Found(parts[i], minus(value), note, i))
    return found


def _problem(screen_name: str, message: str) -> str:
    return f"{screen_name}: {message}"


# --- periods (Inicio, Ventas) -----------------------------------------------------------


@dataclass(frozen=True)
class PeriodRow:
    label: str
    value: str
    pending: str


def _period_rows(muestra: Muestra) -> tuple[dict[str, str], dict[str, list[PeriodRow]]]:
    ranges: dict[str, str] = {}
    rows: dict[str, list[PeriodRow]] = {}
    for row in muestra.table("Periodos"):
        ranges[row["Rango"]] = row["Período"]
        rows.setdefault(row["Período"], []).append(
            PeriodRow(row["Etiqueta"], row["Valor"], row["Pendiente"])
        )
    for tab in PERIOD_TABS:
        if tab not in rows or not any(r.label == "Vendiste" for r in rows[tab]):
            raise MuestraError(f"muestra.md has no 'Vendiste' for the period {tab}")
    return ranges, rows


def _headline(parts: tuple[str, ...], start: int, end: int) -> list[Found]:
    """What a period says at its top: the total sold (with or without its label), the
    number of sales, the average and the grams."""
    found: list[Found] = []
    count_at: int | None = None
    for i in range(start, end):
        part = parts[i]
        nxt = parts[i + 1] if i + 1 < len(parts) else ""
        if re.match(r"^Vendiste\b", part) and MONEY.match(nxt):
            found.append(Found("Vendiste", nxt, None, i))
        elif re.match(r"^\d+ ventas?$", part):
            found.append(Found("Ventas", part.split()[0], None, i))
            count_at = i
        elif (average := re.match(r"^promedio (\$ [\d.]+)$", part)) is not None:
            found.append(Found("Promedio", average.group(1), None, i))
            if GRAMS.match(nxt):
                found.append(Found("Gramos vendidos", nxt, None, i + 1))
    if count_at is not None and not any(f.label == "Vendiste" for f in found):
        following = parts[count_at + 1] if count_at + 1 < len(parts) else ""
        if MONEY.match(following):
            found.append(Found("Vendiste", following, None, count_at + 1))
    return found


def _period_ranges(
    name: str, screen: Screen, ranges: dict[str, str]
) -> tuple[list[tuple[int, str]], list[str]]:
    """Each range part with its index, and the problems of the tab bars around them."""
    problems: list[str] = []
    hits = sorted((i, part) for i, part in enumerate(screen.parts) if part in ranges)
    if not hits:
        problems.append(_problem(name, "no period range is drawn"))
    owners: dict[int, list[tuple[int, str]]] = {k: [] for k in range(len(screen.tabs))}
    for index, shown in hits:
        if not screen.tabs:
            problems.append(_problem(name, f"range '{shown}' sits under no tab bar"))
            continue
        nearest = min(range(len(screen.tabs)), key=lambda k: abs(screen.tabs[k].index - index))
        owners[nearest].append((index, shown))
    for k, bar in enumerate(screen.tabs):
        if bar.selected is None:
            problems.append(_problem(name, "a tab bar has no single selected tab"))
            continue
        for _, shown in owners[k]:
            if ranges[shown] != bar.selected:
                problems.append(
                    _problem(
                        name,
                        f"range '{shown}' ({ranges[shown]}) sits under the tab {bar.selected}",
                    )
                )
        if not any(ranges[shown] == bar.selected for _, shown in owners[k]):
            expected = next((r for r, tab in ranges.items() if tab == bar.selected), "?")
            problems.append(
                _problem(name, f"the range '{expected}' of the tab {bar.selected} is missing")
            )
    return hits, problems


def _labels_before_a_range(name: str, screen: Screen, first_range: int | None) -> list[str]:
    stop = len(screen.parts) if first_range is None else first_range
    early = labelled(screen.parts, 0, stop, LINES)
    return [_problem(name, f"'{f.label}' {f.value} has no range before it") for f in early]


def period_problems(name: str, screen: Screen, muestra: Muestra, *, lines: bool) -> list[str]:
    """Each period block holds the figures `muestra.md` gives for that period. With `lines`
    (Inicio) the cost lines are exactly the ones it has a row for, in its order, with the
    pending note under exactly the ones it marks pending."""
    ranges, expected = _period_rows(muestra)
    if not lines and not screen.tabs and not any(p in ranges for p in screen.parts):
        return []  # a detail page, not a period screen
    hits, problems = _period_ranges(name, screen, ranges)
    if lines:
        problems += _labels_before_a_range(name, screen, hits[0][0] if hits else None)
    for k, (index, shown) in enumerate(hits):
        period = ranges[shown]
        end = hits[k + 1][0] if k + 1 < len(hits) else len(screen.parts)
        rows = {r.label: r for r in expected[period]}
        found = _headline(screen.parts, index + 1, end)
        if lines:
            found += labelled(screen.parts, index + 1, end, LINES)
        problems += _compare_found(name, f"{period} {shown}", found, rows, lines, HEADLINE)
        if lines:
            problems += _order_and_presence(name, f"{period} {shown}", found, list(rows), LINES)
    return problems


def _compare_found(
    name: str,
    where: str,
    found: list[Found],
    rows: dict[str, PeriodRow],
    notes: bool,
    optional: tuple[str, ...],
) -> list[str]:
    problems: list[str] = []
    for item in found:
        row = rows.get(item.label)
        if row is None:
            if item.label not in optional:
                problems.append(
                    _problem(name, f"{where}: '{item.label}' is drawn and muestra.md has no row")
                )
            continue
        if item.value != row.value:
            problems.append(
                _problem(
                    name,
                    f"{where}: '{item.label}' reads {item.value}, muestra.md says {row.value}",
                )
            )
        if notes and item.label not in HEADLINE and item.note != expected_note(row.pending):
            problems.append(
                _problem(
                    name,
                    f"{where}: '{item.label}' note is {item.note!r}, "
                    f"muestra.md says {expected_note(row.pending)!r}",
                )
            )
    return problems


def _order_and_presence(
    name: str, where: str, found: list[Found], expected: list[str], lines: tuple[str, ...]
) -> list[str]:
    problems: list[str] = []
    drawn = [f.label for f in found if f.label in lines]
    wanted = [label for label in expected if label in lines]
    for label in wanted:
        if label not in drawn:
            problems.append(_problem(name, f"{where}: '{label}' is missing, muestra.md has it"))
    if len(set(drawn)) != len(drawn):
        problems.append(_problem(name, f"{where}: a line is drawn twice"))
    common = [label for label in drawn if label in wanted]
    if common != [label for label in wanted if label in common]:
        problems.append(_problem(name, f"{where}: lines run {common}, muestra.md orders {wanted}"))
    return problems


# --- varieties --------------------------------------------------------------------------


def _window(parts: tuple[str, ...], index: int, stops: set[str], size: int = 8) -> list[str]:
    window: list[str] = []
    for part in parts[index + 1 : index + 1 + size]:
        if part in stops:
            break
        window.append(part)
    return window


def _price_per_gram(value: str) -> str:
    return re.sub(r" (?:por gramo|el gramo)$", " x g", value)


def variety_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    """A variety's name, followed by its status, is a stock row: its grams, detail, days
    left and price are the ones `muestra.md` gives. Its movement rows (date, kind, grams)
    must exist for it."""
    rows = {r["Variedad"]: r for r in muestra.table("Variedades")}
    movements = muestra.table("Movimientos")
    problems: list[str] = []
    page_variety: str | None = None
    for i, part in enumerate(screen.parts):
        if part not in rows:
            continue
        window = _window(screen.parts, i, set(rows))
        status = next((p for p in window if p in STATUSES), None)
        if status is None:
            continue
        page_variety = page_variety or part
        row = rows[part]
        where = f"'{part}'"
        if status != row["Estado"]:
            problems.append(_problem(name, f"{where} is {status}, muestra.md says {row['Estado']}"))
        details = [p for p in window if p.startswith(DETAIL_KINDS)]
        for detail in details:
            if detail != row["Detalle"]:
                problems.append(
                    _problem(name, f"{where} says '{detail}', muestra.md says '{row['Detalle']}'")
                )
        rest = [p for p in window if p not in details]
        grams = first_matching(rest, GRAMS)
        if grams is None or minus(grams) != row["Gramos"]:
            problems.append(_problem(name, f"{where} has {grams}, muestra.md says {row['Gramos']}"))
        days = first_matching(rest, re.compile(r"^\d+ días$"))
        want_days = None if row["Días restantes"] == "—" else row["Días restantes"]
        if days != want_days:
            problems.append(
                _problem(name, f"{where} has days left {days}, muestra.md says {want_days}")
            )
        price = first_matching(rest, re.compile(r"^\$ [\d.]+ (?:x g|por gramo)$"))
        if price is not None and _price_per_gram(price) != row["Precio hoy"]:
            problems.append(
                _problem(name, f"{where} costs {price}, muestra.md says {row['Precio hoy']}")
            )
    if page_variety is not None:
        problems += _movement_problems(name, screen, page_variety, movements)
    return problems


def _movement_problems(
    name: str, screen: Screen, variety: str, movements: tuple[dict[str, str], ...]
) -> list[str]:
    kinds = {m["Tipo"] for m in movements}
    problems: list[str] = []
    for i, part in enumerate(screen.parts):
        if not DATE_PART.match(part):
            continue
        near = screen.parts[i + 1 : i + 4]
        kind = next((p for p in near if p in kinds), None)
        grams = first_matching(near, GRAMS)
        if kind is None or grams is None:
            continue
        if not any(
            m["Variedad"] == variety
            and m["Fecha"] == part
            and m["Tipo"] == kind
            and m["Gramos"] == minus(grams)
            for m in movements
        ):
            problems.append(
                _problem(
                    name,
                    f"movement {part} {kind} {grams} of '{variety}' is not in muestra.md",
                )
            )
    return problems


# --- customers, debtors, sales ----------------------------------------------------------


def customer_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    """A customer's name followed by a 'desde dd/mm' is a balance row: the first amount
    before it is their balance and the date is the one `muestra.md` gives. The total owed
    and the number of sales owing are the ones of 'Te deben'."""
    customers = {r["Cliente"].removesuffix(" (VIP)"): r for r in muestra.table("Clientes")}
    problems: list[str] = []
    for i, part in enumerate(screen.parts):
        if part not in customers:
            continue
        window = _window(screen.parts, i, set(customers), size=10)
        since = next((m for p in window if (m := DESDE.search(p)) is not None), None)
        if since is None:
            continue
        row = customers[part]
        if since.group(1) != row["Desde"]:
            problems.append(
                _problem(
                    name, f"'{part}' is owed since {since.group(1)}, muestra.md says {row['Desde']}"
                )
            )
        balance = first_matching(window, MONEY)
        if balance != row["Saldo"]:
            problems.append(
                _problem(name, f"'{part}' owes {balance}, muestra.md says {row['Saldo']}")
            )
    problems += _debtors_problems(name, screen, muestra)
    return problems


def _debtors_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    lines = muestra.section("Te deben").lines
    total = next((m.group(1) for line in lines if (m := re.match(r"^Total: (.+)$", line))), None)
    count = next((line for line in lines if re.match(r"^\d+ ventas? debiendo$", line)), None)
    if total is None or count is None:
        raise MuestraError("muestra.md 'Te deben' has no total or count")
    problems: list[str] = []
    for i in indexes(screen.parts, "Te deben"):
        shown = first_matching(screen.parts[i + 1 : i + 3], MONEY)
        if shown is not None and shown != total:
            problems.append(_problem(name, f"Te deben reads {shown}, muestra.md says {total}"))
    for part in screen.parts:
        if re.match(r"^\d+ ventas? debiendo$", part) and part != count:
            problems.append(_problem(name, f"'{part}' but muestra.md says '{count}'"))
    return problems


def _plain_amount(value: str) -> str:
    return re.sub(r"^[−-]\s*", "", value)


def sale_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    """Each sale row (a date, its customer and the total after it), each 'Venta del dd/mm'
    with its total, each account row (date, amount, 'saldo') and each sale line (variety,
    grams, price, total) must be one `muestra.md` has."""
    sales = muestra.table("Ventas")
    customers = {r["Cliente"].removesuffix(" (VIP)") for r in muestra.table("Clientes")}
    problems: list[str] = []
    problems += _sale_row_problems(name, screen, sales, customers)
    problems += _account_problems(name, screen, muestra, customers)
    problems += _line_problems(name, screen, muestra)
    return problems


def _sale_row_problems(
    name: str, screen: Screen, sales: tuple[dict[str, str], ...], customers: set[str]
) -> list[str]:
    parts = screen.parts
    problems: list[str] = []
    for i, part in enumerate(parts):
        heading = re.match(r"^Venta del (\d\d/\d\d)$", part)
        if DATE_PART.match(part):
            window = _window(parts, i, set(), size=6)
            for k, other in enumerate(window):
                if DATE_PART.match(other):
                    window = window[:k]
                    break
            if any(p.startswith("saldo ") for p in window):
                continue
            who = next((p for p in window if p in customers or p == "Sin cliente"), None)
            if who is None:
                continue
            date = part
            customer: str | None = "—" if who == "Sin cliente" else who
        elif heading is not None:
            window = list(parts[i + 1 : i + 6])
            date = heading.group(1)
            customer = next((p for p in window if p in customers), None)
        else:
            continue
        total = first_matching(window, MONEY)
        if not any(
            s["Fecha"] == date
            and (customer is None or s["Cliente"] == customer)
            and s["Total"] == total
            for s in sales
        ):
            problems.append(
                _problem(
                    name,
                    f"sale of {date} ({customer or 'any customer'}) with total {total} "
                    "is not in muestra.md",
                )
            )
    return problems


def _account_problems(
    name: str, screen: Screen, muestra: Muestra, customers: set[str]
) -> list[str]:
    accounts = muestra.table("Cuentas")
    parts = screen.parts
    owner = next((p for p in parts if p in customers), None)
    problems: list[str] = []
    for i, part in enumerate(parts):
        if not DATE_PART.match(part):
            continue
        window = _window(parts, i, set(), size=7)
        for k, other in enumerate(window):
            if DATE_PART.match(other):
                window = window[:k]
                break
        balance = next(
            (m.group(1) for p in window if (m := re.match(r"^saldo (\$ [\d.]+)$", p))), None
        )
        if balance is None:
            continue
        amount = first_matching(window, re.compile(r"^[−-]? ?\$ [\d.]+$"))
        if owner is None or amount is None:
            problems.append(_problem(name, f"account row of {part} has no customer or amount"))
        elif not any(
            a["Cliente"].removesuffix(" (VIP)") == owner
            and a["Fecha"] == part
            and a["Monto"] == _plain_amount(amount)
            and a["Saldo"] == balance
            for a in accounts
        ):
            problems.append(
                _problem(
                    name,
                    f"account row of {owner} on {part}: {amount}, saldo {balance} "
                    "is not in muestra.md",
                )
            )
    return problems


def _line_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    lines = muestra.table("Líneas de venta")
    varieties = {r["Variedad"] for r in muestra.table("Variedades")}
    parts = screen.parts
    problems: list[str] = []
    for i, part in enumerate(parts):
        if i < 2 or not re.match(r"^\$ [\d.]+ (?:por gramo|x g)$", part):
            continue
        variety, grams = parts[i - 2], parts[i - 1]
        if variety not in varieties or not GRAMS.match(grams):
            continue
        total = first_matching(parts[i + 1 : i + 4], MONEY)
        if not any(
            line["Variedad"] == variety
            and line["Gramos"] == grams
            and line["Precio x g"] == _price_per_gram(part)
            and line["Total"] == total
            for line in lines
        ):
            problems.append(
                _problem(name, f"line {variety} {grams} {part} {total} is not in muestra.md")
            )
    return problems


# --- Análisis, drawn in English ---------------------------------------------------------
# The two Analysis drawings carry the English the built app shows (GH-333), while muestra.md
# and the checks above keep their Spanish table headings. `in_spanish` puts a drawn part back
# into the muestra's words before the Analysis checks compare it; a part it does not know is
# left as drawn, so a label missing or wrong still reads as a problem.

_ANALYSIS_WORDS = {
    "Analysis": "Análisis",
    "You sold in the month": "Vendiste en el mes",
    "Stock shortfall": "Faltante de stock",
    "Promotion": "Promoción",
    "Own use": "Consumo propio",
    "Cost of goods sold": "Costo de lo vendido",
    "Expenses of the month": "Gastos del mes",
    "Expenses since the first record": "Gastos desde el primer registro",
    "Moved since your first record, not the money you have in cash": GROUPED_SECTION,
    "Flower purchases": "Compras de flores",
    "Sales": "Ventas",
    "Expenses": "Gastos",
    "Profit": "Ganancia",
    "Cash": "Caja",
    "Grams": "Gramos",
    "Mon": "Lun",
    "Tue": "Mar",
    "Wed": "Mié",
    "Thu": "Jue",
    "Fri": "Vie",
    "Sat": "Sáb",
    "Sun": "Dom",
    "Best week": "Mejor semana",
    "Your best day is Wednesday.": "Tu mejor día es el miércoles.",
    "best: Wednesday": "mejor: miércoles",
}
_ANALYSIS_MONTHS = {"October": "Octubre", "September": "Septiembre", "August": "Agosto"}
_ANALYSIS_PHRASES = (
    (re.compile(r"\band (\d+(?:,\d+)?) g without cost\b"), r"y \1 g sin costo"),
    (re.compile(r"^(\d+(?:,\d+)?) g sold$"), r"\1 g"),
    (re.compile(r"^(\d+(?:,\d+)?) g given away$"), r"\1 g regalado"),
    (re.compile(r"^(\d+)% of the month$"), r"\1% del mes"),
    (re.compile(r"^average margin\b"), "margen promedio"),
    (re.compile(r"^cost \$"), "costo $"),
    (re.compile(r"^margin (\d+%)$"), r"margen \1"),
    (re.compile(r"^Best week: "), "Mejor semana: "),
    (re.compile(r"^This one: "), "Esta: "),
)


def _in_spanish(part: str) -> str:
    if part in _ANALYSIS_WORDS:
        return _ANALYSIS_WORDS[part]
    month = re.fullmatch(r"([A-Z][a-z]+) (\d{4})", part)
    if month and month.group(1) in _ANALYSIS_MONTHS:
        return f"{_ANALYSIS_MONTHS[month.group(1)]} {month.group(2)}"
    for pattern, replacement in _ANALYSIS_PHRASES:
        part = pattern.sub(replacement, part)
    return part


def in_spanish(screen: Screen) -> Screen:
    return Screen(
        parts=tuple(_in_spanish(part) for part in screen.parts),
        text=screen.text,
        tabs=screen.tabs,
    )


# --- Análisis ---------------------------------------------------------------------------

HEADER_LABELS = ("Vendiste en el mes", "Faltante de stock", "Promoción", "Consumo propio")
COST_LINES = ("Faltante de stock", "Promoción", "Consumo propio")
ROW_LABELS = ("Ventas", "Gramos", "Gastos", "Ganancia", "Caja", *COST_LINES)


def _analysis_header_heading(muestra: Muestra) -> str:
    candidates = [h for h in muestra.sections if re.match(r"^Análisis · [^\W\d_]+ \d{4}$", h)]
    if len(candidates) != 1:
        raise MuestraError("muestra.md has not exactly one 'Análisis · <mes> <año>' table")
    return candidates[0]


def _block_bounds(parts: tuple[str, ...], starts: dict[int, str], index: int) -> int:
    later = [i for i in starts if i > index]
    return min([*later, len(parts), index + 31])


def analysis_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    parts = screen.parts
    problems: list[str] = []
    heading = _analysis_header_heading(muestra)
    problems += _header_problems(name, screen, muestra, heading)
    problems += _row_block_problems(name, screen, muestra)
    problems += _variety_row_problems(name, screen, muestra)
    problems += _weekday_problems(name, screen, muestra)
    problems += _best_week_problems(name, screen, muestra)
    problems += _expense_problems(name, screen, muestra, parts)
    return problems


def _header_problems(name: str, screen: Screen, muestra: Muestra, heading: str) -> list[str]:
    parts = screen.parts
    month = heading.split(" · ", 1)[1]
    where = indexes(parts, month)
    if not where:
        return [_problem(name, f"the month heading '{month}' is missing")]
    start = where[0]
    end = next((i for i in range(start + 1, len(parts)) if parts[i] == "Por variedad"), start + 21)
    rows = {r["Etiqueta"]: r for r in muestra.table(heading)}
    found = labelled(parts, start + 1, end, HEADER_LABELS)
    problems: list[str] = []
    expected_rows = {
        label: PeriodRow(label, r["Valor"], r["Pendiente"]) for label, r in rows.items()
    }
    problems += _compare_found(
        name, f"header {month}", found, expected_rows, True, ("Vendiste en el mes",)
    )
    problems += _order_and_presence(name, f"header {month}", found, list(expected_rows), COST_LINES)
    sold = next((f for f in found if f.label == "Vendiste en el mes"), None)
    if sold is not None:
        after = parts[sold.index + 2 : sold.index + 5]
        grams = first_matching(after, GRAMS)
        if grams is not None and minus(grams) != rows["Gramos vendidos"]["Valor"]:
            problems.append(
                _problem(
                    name,
                    f"header grams {grams}, muestra.md says {rows['Gramos vendidos']['Valor']}",
                )
            )
        margin = next(
            (m.group(1) for p in after if (m := re.match(r"^margen promedio (\d+%)$", p))), None
        )
        if margin is not None and margin != rows["Margen promedio"]["Valor"]:
            problems.append(
                _problem(
                    name,
                    f"header margin {margin}, muestra.md says {rows['Margen promedio']['Valor']}",
                )
            )
    return problems


def _row_block_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    """Weeks (by range or start date), months (by range) and the total since the first
    record (by its label): each block that draws labelled figures draws the ones
    `muestra.md` has."""
    parts = screen.parts
    wanted: list[tuple[str, list[PeriodRow], tuple[str, ...], str]] = []
    for heading, kind in (
        ("Análisis · semanas", "week"),
        ("Análisis · meses", "month"),
        ("Análisis · desde el primer registro", "since"),
    ):
        by_range: dict[str, list[PeriodRow]] = {}
        for row in muestra.table(heading):
            by_range.setdefault(row["Rango"], []).append(
                PeriodRow(row["Etiqueta"], row["Valor"], row["Pendiente"])
            )
        for shown, rows in by_range.items():
            keys: tuple[str, ...] = (shown,)
            if kind == "week":
                keys = (shown, shown.split(" – ")[0])
            elif kind == "since":
                keys = (GROUPED_SECTION,)
            wanted.append((shown, rows, keys, kind))
    starts: dict[int, str] = {}
    located: list[tuple[int, str, list[PeriodRow], str]] = []
    problems: list[str] = []
    for shown, rows, keys, kind in wanted:
        hit = next((i for i, p in enumerate(parts) if p in keys), None)
        if hit is None:
            problems.append(_problem(name, f"the {kind} '{shown}' is missing"))
            continue
        starts[hit] = shown
        located.append((hit, shown, rows, kind))
    for index, shown, rows, kind in located:
        end = _block_bounds(parts, starts, index)
        found = labelled(parts, index + 1, end, ROW_LABELS)
        table = {r.label: r for r in rows if r.label in ROW_LABELS}
        where = f"{kind} {shown}"
        problems += _compare_found(name, where, found, table, True, ())
        if found:
            problems += _order_and_presence(name, where, found, list(table), COST_LINES)
    return problems


def _variety_row_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    rows = {r["Variedad"]: r for r in muestra.table("Análisis · variedades del mes")}
    parts = screen.parts
    problems: list[str] = []
    for i, part in enumerate(parts):
        if part not in rows:
            continue
        row = rows[part]
        window = _window(parts, i, set(rows) | {"Semana a semana"}, size=8)
        checks = (
            ("sales", first_matching(window, MONEY), row["Ventas"]),
            ("grams", first_matching(window, GRAMS), row["Gramos vendidos"]),
            (
                "share",
                next((m.group(1) for p in window if (m := re.match(r"^(\d+%) del mes$", p))), None),
                row["% del mes"],
            ),
            (
                "cost",
                next(
                    (m.group(1) for p in window if (m := re.match(r"^costo (\$ [\d.]+)$", p))), None
                ),
                row["Costo"],
            ),
            (
                "margin",
                next((m.group(1) for p in window if (m := re.match(r"^margen (\d+%)$", p))), None),
                row["Margen %"],
            ),
        )
        for what, shown, wanted in checks:
            if shown is not None and minus(shown) != wanted:
                problems.append(
                    _problem(name, f"'{part}' {what} is {shown}, muestra.md says {wanted}")
                )
    return problems


def _weekday_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    days = {r["Día"]: r["Ventas"] for r in muestra.table("Análisis · días de la semana")}
    problems: list[str] = []
    for day in WEEKDAYS:
        where = indexes(screen.parts, day)
        if not where:
            problems.append(_problem(name, f"the weekday '{day}' is missing"))
            continue
        shown = screen.parts[where[0] + 1] if where[0] + 1 < len(screen.parts) else ""
        if shown != days[day]:
            problems.append(_problem(name, f"'{day}' reads {shown}, muestra.md says {days[day]}"))
    return problems


def _best_week_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    weeks = muestra.table("Análisis · semanas")
    best = next((w for w in weeks if w["Etiqueta"] == "Mejor semana" and w["Valor"] == "sí"), None)
    sales = {w["Rango"]: w["Valor"] for w in weeks if w["Etiqueta"] == "Ventas"}
    problems: list[str] = []
    for i, part in enumerate(screen.parts):
        shown = re.match(r"^Mejor semana: (\d\d/\d\d)$", part)
        if shown is not None:
            total = first_matching(screen.parts[i + 1 : i + 3], MONEY)
            ok = best is not None and (
                best["Rango"].startswith(shown.group(1)) and sales[best["Rango"]] == total
            )
            if not ok:
                problems.append(
                    _problem(name, f"'{part}' {total} is not the best week of muestra.md")
                )
        elif part.startswith("Esta: "):
            last = list(sales.values())[-1]
            if part.removeprefix("Esta: ") != last:
                problems.append(_problem(name, f"'{part}' but this week sold {last}"))
    return problems


def _expense_problems(
    name: str, screen: Screen, muestra: Muestra, parts: tuple[str, ...]
) -> list[str]:
    month = {r["Categoría"]: r["Total"] for r in muestra.table("Análisis · gastos del mes")}
    since = {
        r["Categoría"]: r["Total"]
        for r in muestra.table("Análisis · gastos desde el primer registro")
    }
    problems: list[str] = []
    sections = [i for i, p in enumerate(parts) if p in ("Gastos del mes", GROUPED_SECTION)]
    for k, start in enumerate(sections):
        table = month if parts[start] == "Gastos del mes" else since
        end = min(sections[k + 1] if k + 1 < len(sections) else len(parts), start + 15)
        for j in range(start + 1, end):
            if parts[j] in table:
                shown = first_matching(parts[j + 1 : j + 4], MONEY)
                if shown is not None and shown != table[parts[j]]:
                    problems.append(
                        _problem(
                            name,
                            f"'{parts[j]}' reads {shown} under '{parts[start]}', "
                            f"muestra.md says {table[parts[j]]}",
                        )
                    )
    if "Gastos del mes" not in parts:
        problems.append(_problem(name, "the section 'Gastos del mes' is missing"))
    return problems


# --- dates, denylist, one screen --------------------------------------------------------


def date_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    """Every dd/mm on the screen is one `muestra.md` has; a full date is the capture date."""
    problems = [
        _problem(name, f"the date {found} is not in muestra.md")
        for found in dict.fromkeys(DATE_LITERAL.findall(screen.text))
        if found not in muestra.dates
    ]
    problems += [
        _problem(name, f"the date {found} is not the capture date {muestra.captured}")
        for found in dict.fromkeys(FULL_DATE_LITERAL.findall(screen.text))
        if found != muestra.captured
    ]
    return problems


def denylist_problems(name: str, screen: Screen, denylist: tuple[str, ...]) -> list[str]:
    problems: list[str] = []
    for literal in denylist:
        pattern = rf"(?<![\w.,]){re.escape(literal)}(?!\w)"
        if re.search(pattern, screen.text):
            problems.append(_problem(name, f"the stale literal '{literal}' is still drawn"))
    return problems


def archived_problems(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    """An archived variety's name is followed by its own marks: "Archivada" always, "Oculta"
    when `muestra.md` says it is hidden and never when it is not, and the grams and list
    price it gives wherever the screen shows them (a list row may show neither)."""
    rows = {r["Variedad"]: r for r in muestra.table("Archivadas")}
    problems: list[str] = []
    for i, part in enumerate(screen.parts):
        if part not in rows:
            continue
        row = rows[part]
        where = f"'{part}'"
        window = _window(screen.parts, i, set(rows))
        if "Archivada" not in window:
            problems.append(_problem(name, f"{where} lacks Archivada"))
        hidden = row["Oculta"] == "sí"
        if hidden and "Oculta" not in window:
            problems.append(_problem(name, f"{where} lacks Oculta, muestra.md says it is hidden"))
        if not hidden and "Oculta" in window:
            problems.append(_problem(name, f"{where} says Oculta, muestra.md says it is shown"))
        grams = first_matching(window, GRAMS)
        if grams is not None and minus(grams) != row["Gramos"]:
            problems.append(_problem(name, f"{where} has {grams}, muestra.md says {row['Gramos']}"))
        price = first_matching(window, re.compile(r"^\$ [\d.]+ (?:x g|por gramo)$"))
        if price is not None and _price_per_gram(price) != row["Precio hoy"]:
            problems.append(
                _problem(
                    name,
                    f"{where} costs {_price_per_gram(price)}, muestra.md says {row['Precio hoy']}",
                )
            )
    return problems


Check = Callable[[str, Screen, Muestra], list[str]]


def _inicio_periods(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    return period_problems(name, screen, muestra, lines=True)


def _ventas_periods(name: str, screen: Screen, muestra: Muestra) -> list[str]:
    return period_problems(name, screen, muestra, lines=False)


CHECKS: dict[str, tuple[Check, ...]] = {
    "inicio": (_inicio_periods, customer_problems, variety_problems),
    "variedades": (variety_problems,),
    "ventas": (_ventas_periods, customer_problems, sale_problems),
    "analisis": (analysis_problems,),
    "archived": (archived_problems,),
    "otras": (),
}


def check_screen(
    family: str, name: str, page: str, muestra: Muestra, denylist: tuple[str, ...]
) -> list[str]:
    """Every problem of one screen of `family`, or one problem for what `muestra.md` lacks."""
    screen = read_screen(page)
    checked = in_spanish(screen) if family == "analisis" else screen
    problems: list[str] = []
    try:
        for check in CHECKS[family]:
            problems += check(name, checked, muestra)
    except MuestraError as error:
        problems.append(_problem(name, str(error)))
    problems += date_problems(name, screen, muestra)
    problems += denylist_problems(name, screen, denylist)
    return problems
