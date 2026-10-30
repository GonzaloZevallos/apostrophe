"""The capture of La Huerta (docs/product/design-system/muestra.md): the only author of
its figures.

    uv run --no-project python scripts/design/capture_muestra.py [--date AAAA-MM-DD]

Builds the app over a throwaway in-memory SQLite and a clock pinned at the given day (as
`tests/conftest.py` builds it), opens a business and signs in through the API, seeds it
with `sample_app.seed` unchanged and prints the generated section of `muestra.md`. Every
value is read from an API answer; this module only formats it (`$ 11.000`, `3,5 g`,
`−1 g` with U+2212, `dd/mm`), it never computes a figure.
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
from datetime import UTC, date, datetime, time
from pathlib import Path
from types import ModuleType
from typing import Any

REPO = Path(__file__).resolve().parents[2]
DEFAULT_DAY = date(2026, 10, 7)
# The generated section of muestra.md sits between these two lines.
SECTION_START = "## Cifras capturadas\n\n"
SECTION_END = "\n## Cómo se obtuvo"

_EMAIL = "vos@lahuerta.com"
_PASSWORD = "muestra-de-la-huerta"
_MONTHS = (
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
)
_WEEKDAYS = {1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom"}
_STATUS = {"ok": "ok", "low": "baja", "sold_out": "agotada", "no_entries": "sin entradas"}
_STANDING = {"owes": "debe", "settled": "al día"}
_HOW_PAID = {"cash": "Efectivo", "transfer": "Transferencia", "owing": "Debiendo"}
_RULE = {
    "list": "Lista",
    "bulk": "Por mayor",
    "vip": "VIP",
    "gift": "Regalo",
    "special": "Especial",
}
_ENTRY_KIND = {"purchase": "Compra", "harvest": "Cosecha", "adjustment": "Ajuste"}
_WITHDRAWAL_KIND = {"promotion": "Promoción", "own_use": "Consumo propio"}
_MINUS = "\N{MINUS SIGN}"
_NONE = "—"

Json = Any


# --- formatting only ------------------------------------------------------------------


def money(amount: int) -> str:
    text = f"$ {abs(amount):,}".replace(",", ".")
    return f"{_MINUS}${text[1:]}" if amount < 0 else text


def grams(value: float) -> str:
    text = f"{abs(value):.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{_MINUS}{text} g" if value < 0 else f"{text} g"


def day_month(iso: str) -> str:
    return f"{iso[8:10]}/{iso[5:7]}"


def span(start: str, end: str) -> str:
    return f"{day_month(start)} – {day_month(end)}"


def yes_no(flag: bool) -> str:
    return "sí" if flag else "no"


def pending_grams(value: float) -> str:
    return f"y {grams(value)} sin costo" if value > 0 else "no"


def row_cost(line: Json) -> str:
    """The Valor of an Análisis cost line. Everything behind it pending reads as grams
    alone (`formatRowCost`), never `$ 0`; otherwise the amount, with a partly pending
    figure's grams in the Pendiente column."""
    if line["all_pending"]:
        return f"{grams(line['pending_quantity'])} sin costo"
    return money(line["amount"])


def days(count: int | None) -> str:
    if count is None:
        return _NONE
    return "1 día" if count == 1 else f"{count} días"


def count_of(count: int, one: str, many: str) -> str:
    return f"{count} {one if count == 1 else many}"


def table(header: list[str], rows: list[list[str]]) -> list[str]:
    def line(cells: list[str]) -> str:
        return "| " + " | ".join(cells) + " |"

    return [line(header), line(["---"] * len(header)), *(line(row) for row in rows), ""]


# --- the seeded app -------------------------------------------------------------------


def _load_sample_app() -> ModuleType:
    path = Path(__file__).resolve().with_name("sample_app.py")
    spec = importlib.util.spec_from_file_location("sample_app", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Registered first: a dataclass resolves its annotations through `sys.modules`.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class _ClientApi:
    """The seed's `Api`, and the capture's reader, over a signed-in TestClient."""

    def __init__(self, client: Any) -> None:
        self.client = client

    def call(self, method: str, path: str, body: object | None = None) -> Json:
        response = self.client.request(method, path, json=body)
        assert response.is_success, f"{method} {path}: {response.status_code}"
        return response.json() if response.content else None

    def get(self, path: str) -> Json:
        return self.call("GET", path)


def _seeded(day: date) -> _ClientApi:
    """A signed-in client of a business seeded at `day`, over an in-memory database."""
    if str(REPO) not in sys.path:
        sys.path.insert(0, str(REPO))
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import Session

    from app.accounts.adapters.sql_accounts import SqlAccounts
    from app.accounts.application.invitations import invite_new_business
    from app.accounts.domain.password import PasswordHasher, ScryptParams
    from app.db import make_engine
    from app.main import create_app
    from app.settings import Settings

    instant = datetime.combine(day, time(18, 0), tzinfo=UTC)
    engine = make_engine("sqlite://")
    app = create_app(
        Settings(secret_key="muestra-secret-key", database_url="sqlite://"),
        engine=engine,
        clock=lambda: instant,
        hasher=PasswordHasher(ScryptParams(n=16, r=1, p=1)),
        upkeep_ticker=False,
    )
    client = TestClient(app)
    client.__enter__()
    with Session(engine) as session:
        token = invite_new_business(SqlAccounts(session), session, instant).token
    accepted = client.post(
        f"/invitations/{token}/accept",
        json={"business_name": "La Huerta", "email": _EMAIL, "password": _PASSWORD},
    )
    assert accepted.status_code == 201, accepted.status_code
    client.headers["Authorization"] = f"Bearer {accepted.json()['token']}"
    api = _ClientApi(client)
    _load_sample_app().seed(api, day)
    return api


# --- the tables -----------------------------------------------------------------------


def _varieties(api: _ClientApi) -> list[str]:
    names = {v["id"]: v for v in api.get("/api/products")}
    rows = []
    for row in api.get("/stock")["products"]:
        variety = names[row["product_id"]]
        status = row["status"]
        if status == "low":
            detail = f"Avisás abajo de {grams(row['threshold'])}"
        elif status == "sold_out":
            detail = f"Sin gramos desde el {day_month(row['sold_out_since'])}"
        elif status == "no_entries":
            detail = "Cargale la primera entrada"
        else:
            detail = "Al ritmo de los últimos 30 días"
        rows.append(
            [
                variety["name"],
                grams(row["quantity"]),
                _STATUS[status],
                detail,
                days(row["days_left"]),
                f"{money(variety['current_price']['list_price'])} x g",
            ]
        )
    header = ["Variedad", "Gramos", "Estado", "Detalle", "Días restantes", "Precio hoy"]
    return ["### Variedades", "", *table(header, rows)]


def _archived(api: _ClientApi) -> list[str]:
    """The archived varieties' own rows: grams as the archived page shows them, today's
    list price, and whether the variety is hidden from the public catalog (the "Oculta"
    mark). They are in no other table, since every live read leaves them out.

    The catalog lists no archived variety, so the flag is read from `GET /catalog` while
    the variety is restored for an instant, then archived again: archive and restore touch
    no stock, lot or price (varieties.md), and this is the capture's last read."""
    stock = {row["product_id"]: row for row in api.get("/stock?archived=true")["products"]}
    archived = api.get("/api/products?archived=true")
    for variety in archived:
        api.call("POST", f"/api/products/{variety['id']}/restore")
    shown = {v["product_id"]: v["shown"] for v in api.get("/catalog")["products"]}
    for variety in archived:
        api.call("POST", f"/api/products/{variety['id']}/archive")
    rows = []
    for variety in archived:
        price = variety["current_price"]
        rows.append(
            [
                variety["name"],
                grams(stock[variety["id"]]["quantity"]),
                f"{money(price['list_price'])} x g" if price else "Sin precio",
                yes_no(not shown[variety["id"]]),
            ]
        )
    return ["### Archivadas", "", *table(["Variedad", "Gramos", "Precio hoy", "Oculta"], rows)]


def _movements(api: _ClientApi) -> list[str]:
    names = {v["id"]: v["name"] for v in api.get("/api/products")}
    rows = []
    for row in api.get("/stock")["products"]:
        listed = api.get(f"/stock/products/{row['product_id']}/movements")
        for move in listed[:3]:
            if move["kind"] == "withdrawal":
                kind, amount = (
                    _WITHDRAWAL_KIND[move["reason"]],
                    f"{_MINUS}{grams(move['quantity'])}",
                )
            else:
                kind, amount = _ENTRY_KIND[move["origin"]], grams(move["quantity"])
            rows.append([names[row["product_id"]], day_month(move["date"]), kind, amount])
    return ["### Movimientos", "", *table(["Variedad", "Fecha", "Tipo", "Gramos"], rows)]


def _customers(api: _ClientApi) -> list[str]:
    rows = [
        [
            f"{c['name']} (VIP)" if c["vip"] else c["name"],
            money(c["balance"]),
            day_month(c["owing_since"]) if c["owing_since"] else _NONE,
            _STANDING[c["standing"]],
        ]
        for c in api.get("/customers")
    ]
    return ["### Clientes", "", *table(["Cliente", "Saldo", "Desde", "Estado"], rows)]


def _debtors(api: _ClientApi) -> list[str]:
    answer = api.get("/payments/debtors")
    rows = [
        [d["customer"]["name"], money(d["balance"]), day_month(d["owing_since"])]
        for d in answer["debtors"]
    ]
    return [
        "### Te deben",
        "",
        f"Total: {money(answer['total_owed'])}",
        count_of(answer["sales_owing_count"], "venta debiendo", "ventas debiendo"),
        "",
        *table(["Cliente", "Saldo", "Desde"], rows),
    ]


def _panel(api: _ClientApi) -> list[str]:
    periods = api.get("/panel")["periods"]
    rows = []
    for key, name in (("today", "Hoy"), ("week", "Semana"), ("month", "Mes")):
        p = periods[key]
        rango = f"Hoy {day_month(p['start'])}" if key == "today" else span(p["start"], p["end"])

        def add(
            label: str,
            value: str,
            pending: bool = False,
            *,
            period: str = name,
            within: str = rango,
        ) -> None:
            rows.append([period, within, label, value, yes_no(pending)])

        add("Vendiste", money(p["sales"]))
        add("Ventas", str(p["sales_count"]))
        add("Promedio", money(p["average_sale"]))
        add("Gramos vendidos", grams(p["quantity_sold"]))
        if key == "today":
            continue
        add("Regalaste", grams(p["quantity_gifted"]))
        add("Costo de lo vendido", money(p["cost_of_goods"]), p["pending_cost"])
        for field, label in (
            ("shortfall", "Faltante de stock"),
            ("promotion", "Promoción"),
            ("own_use", "Consumo propio"),
        ):
            if p[field] is not None:
                add(label, money(p[field]["amount"]), p[field]["pending"])
        add("Gastos", money(p["expenses"]))
        add("Compras de flores", money(p["purchases"]))
        add("Ganancia", money(p["profit"]), p["profit_pending"])
        add("Caja", money(p["cash"]))
    header = ["Período", "Rango", "Etiqueta", "Valor", "Pendiente"]
    return ["### Periodos", "", *table(header, rows)]


def _sales(api: _ClientApi) -> list[str]:
    listed = api.get("/sales")
    rows: list[list[str]] = []
    lines: list[list[str]] = []
    for sale in listed:
        who = sale["customer"]["name"] if sale["customer"] else _NONE
        key = f"{day_month(sale['date'])} · {who} · {money(sale['total'])}"
        rows.append(
            [
                day_month(sale["date"]),
                who,
                money(sale["total"]),
                money(sale["shipping_charged"]),
                yes_no(sale["still_owing"]),
                _HOW_PAID[sale["payment"]],
            ]
        )
        lines.extend(
            [
                key,
                line["variety_name"],
                grams(line["quantity"]),
                f"{money(line['price_per_gram'])} x g",
                _RULE[line["pricing_rule"]],
                money(line["line_total"]),
            ]
            for line in sale["lines"]
        )
    sale_header = ["Fecha", "Cliente", "Total", "Envío cobrado", "Te debe", "Cómo se pagó"]
    line_header = ["Venta", "Variedad", "Gramos", "Precio x g", "Regla", "Total"]
    return [
        "### Ventas",
        "",
        *table(sale_header, rows),
        "### Líneas de venta",
        "",
        *table(line_header, lines),
    ]


def _accounts(api: _ClientApi) -> list[str]:
    rows = []
    for customer in api.get("/customers"):
        for row in api.get(f"/customers/{customer['id']}/account")["rows"]:
            if row["kind"] == "sale":
                sale = row["sale"]
                concept, amount = "Venta", money(sale["total"])
                detail = _HOW_PAID[sale["how_paid"]]
            else:
                payment = row["payment"]
                concept, amount = "Pago", money(payment["amount"])
                applied = row["applied_to"]
                method = _HOW_PAID[payment["method"]]
                detail = f"{method}, a la venta del {day_month(applied['sale_date'])}"
            rows.append(
                [
                    customer["name"],
                    day_month(row["date"]),
                    concept,
                    amount,
                    detail,
                    money(row["running_balance"]),
                ]
            )
    header = ["Cliente", "Fecha", "Concepto", "Monto", "Detalle", "Saldo"]
    return ["### Cuentas", "", *table(header, rows)]


def _cost_rows(add: Any, figures: Json, *, cost_of_goods: bool = False) -> None:
    fields = [
        ("shortfall", "Faltante de stock"),
        ("promotion", "Promoción"),
        ("own_use", "Consumo propio"),
    ]
    if cost_of_goods:
        fields.insert(0, ("cost_of_goods", "Costo de lo vendido"))
    for field, label in fields:
        if figures.get(field) is not None:
            line = figures[field]
            add(label, row_cost(line), pending_grams(line["pending_quantity"]))


def _analysis(api: _ClientApi) -> list[str]:
    answer = api.get("/analysis")
    month = answer["month"]
    year, number = month["month"].split("-")
    out = [f"### Análisis · {_MONTHS[int(number) - 1]} {year}", ""]

    header_rows: list[list[str]] = []

    def head(label: str, value: str, pending: str = "no") -> None:
        header_rows.append([label, value, pending])

    head("Vendiste en el mes", money(month["sales"]))
    head("Gramos vendidos", grams(month["quantity_sold"]))
    head("Regalados", grams(month["quantity_gifted"]))
    margin = month["average_margin"]
    head("Margen promedio", f"{margin['percent']}%", pending_grams(margin["pending_quantity"]))
    _cost_rows(head, month)
    out += table(["Etiqueta", "Valor", "Pendiente"], header_rows)

    out += ["### Análisis · variedades del mes", ""]
    variety_rows = [
        [
            v["name"],
            money(v["sales_without_shipping"]),
            grams(v["quantity_sold"]),
            grams(v["quantity_gifted"]),
            money(v["cost"]["costed"]),
            money(v["margin"]["amount"]),
            f"{v['margin']['percent']}%",
            pending_grams(v["margin"]["pending_quantity"]),
            f"{v['share_percent']}%",
        ]
        for v in month["varieties"]
    ]
    out += table(
        [
            "Variedad",
            "Ventas",
            "Gramos vendidos",
            "Regalados",
            "Costo",
            "Margen",
            "Margen %",
            "Sin costo",
            "% del mes",
        ],
        variety_rows,
    )

    def expenses(title: str, breakdown: Json) -> list[str]:
        rows = [[c["name"], money(c["total"])] for c in breakdown["categories"]]
        rows.append(["Total gastos", money(breakdown["total"])])
        rows.append(["Compras de flores", money(breakdown["purchases"])])
        return [f"### {title}", "", *table(["Categoría", "Total"], rows)]

    out += expenses("Análisis · gastos del mes", answer["month_expenses"])
    out += expenses(
        "Análisis · gastos desde el primer registro", answer["since_first_record_expenses"]
    )

    def periodic(
        into: list[list[str]], name: str, rango: str, row: Json, *, best: bool = False
    ) -> None:
        def add(label: str, value: str, pending: str = "no") -> None:
            into.append([name, rango, label, value, pending])

        add("Ventas", money(row["sales"]))
        add("Gramos", grams(row["quantity"]))
        _cost_rows(add, row, cost_of_goods=True)
        add("Gastos", money(row["expenses"]))
        profit = row["profit"]
        add("Ganancia", money(profit["amount"]), pending_grams(profit["pending_quantity"]))
        add("Caja", money(row["cash"]))
        if best:
            add("Mejor semana", "sí")

    week_rows: list[list[str]] = []
    for week in answer["weeks"]:
        rango = span(week["first_day"], week["last_day"])
        periodic(week_rows, "Semana", rango, week, best=week["best"])
    out += ["### Análisis · semanas", "", *table(_PERIOD_HEADER, week_rows)]

    month_rows: list[list[str]] = []
    for row in answer["months"]:
        periodic(month_rows, "Mes", span(row["first_day"], row["last_day"]), row)
    out += ["### Análisis · meses", "", *table(_PERIOD_HEADER, month_rows)]

    weekday_rows = [
        [_WEEKDAYS[d["weekday"]], money(d["sales"]), str(d["count"]), yes_no(d["best"])]
        for d in answer["weekdays"]
    ]
    out += [
        "### Análisis · días de la semana",
        "",
        *table(["Día", "Ventas", "# ventas", "Mejor"], weekday_rows),
    ]

    since = answer["since_first_record"]
    total_rows: list[list[str]] = []
    if since is not None:
        rango = span(answer["first_record"], answer["today"])

        def total(label: str, value: str, pending: str = "no") -> None:
            total_rows.append(["Desde el primer registro", rango, label, value, pending])

        total("Ventas", money(since["sales"]))
        _cost_rows(total, since)
        total("Gastos", money(since["expenses"]))
        profit = since["profit"]
        total("Ganancia", money(profit["amount"]), pending_grams(profit["pending_quantity"]))
        total("Caja", money(since["cash"]))
    out += ["### Análisis · desde el primer registro", "", *table(_PERIOD_HEADER, total_rows)]
    return out


_PERIOD_HEADER = ["Período", "Rango", "Etiqueta", "Valor", "Pendiente"]


def render_muestra(day: date) -> str:
    """The generated section of muestra.md for a business seeded at `day`."""
    api = _seeded(day)
    try:
        lines = [f"Capturada: {day.isoformat()}", ""]
        for part in (
            _varieties,
            _movements,
            _customers,
            _debtors,
            _panel,
            _sales,
            _accounts,
            _analysis,
            _archived,
        ):
            lines += part(api)
    finally:
        api.client.__exit__(None, None, None)
    return "\n".join(lines).rstrip("\n") + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="capture-muestra")
    parser.add_argument("--date", type=date.fromisoformat, default=DEFAULT_DAY)
    args = parser.parse_args(argv)
    sys.stdout.write(render_muestra(args.date))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
