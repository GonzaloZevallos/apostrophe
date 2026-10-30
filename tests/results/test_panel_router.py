"""`GET /panel` (CODING_STANDARDS section 5: behaviour test, `TestClient`, real
adapters, the movable clock). Seams: `app.results.application.read_panel` (reached
only through HTTP, never called directly — the plan's subtask brief) and `GET /panel`
itself.

Covers: the fixture's shape, the formula matrix (payments on their own date, a
backdated purchase and an edited entry moving cost of goods and Ganancia, the pending
flag, a negative adjustment never summed, negative Ganancia/Caja), agreement with the
dedicated screens at 2026-12-31, and an empty business's real zeros.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.results.domain.periods import periods as compute_periods
from tests.conftest import PASSWORD, TODAY, MovableClock, signed_in
from tests.contract_shapes import assert_matches_fixture
from tests.fakes.archive import archive_by_hand
from tests.statement_log import captured_statements


def _variety(client: TestClient, name: str, price: int = 10_000) -> int:
    variety = client.post("/api/products", json={"name": name}).json()
    priced = client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2020-01-01", "list_price": price},
    )
    assert priced.status_code == 201, priced.text
    return int(variety["id"])


def _entry(
    client: TestClient,
    variety_id: int,
    *,
    quantity: str,
    origin: str = "opening_stock",
    total_cost: int | None = None,
    on: str,
) -> int:
    body: dict[str, Any] = {
        "product_id": variety_id,
        "origin": origin,
        "quantity": quantity,
        "date": on,
    }
    if total_cost is not None:
        body["total_cost"] = total_cost
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _sale(
    client: TestClient,
    variety_id: int,
    *,
    quantity: str,
    on: str,
    gift: bool = False,
    customer_id: int | None = None,
    payment: str | None = "cash",
) -> None:
    body: dict[str, Any] = {
        "date": on,
        "payment": payment,
        "lines": [{"product_id": variety_id, "quantity": quantity, "gift": gift}],
    }
    if customer_id is not None:
        body["customer_id"] = customer_id
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text


def _customer(client: TestClient, name: str) -> int:
    response = client.post("/customers", json={"name": name, "phone": "11 5555-5555"})
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _expense(client: TestClient, *, amount: int, on: str) -> None:
    category = client.post("/expense-categories", json={"name": f"cat {on}"}).json()
    response = client.post(
        "/expenses",
        json={
            "spent_on": on,
            "category_id": category["id"],
            "amount": amount,
            "detail": "a test expense",
        },
    )
    assert response.status_code == 201, response.text


def test_the_panel_matches_the_fixture_s_shape(client: TestClient, clock: MovableClock) -> None:
    day = date(2026, 10, 15)
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    variety_id = _variety(client, "Criolla")
    _entry(client, variety_id, quantity="10", total_cost=1_000, on=day.isoformat())
    _sale(client, variety_id, quantity="5", on=day.isoformat())

    answer = client.get("/panel")

    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert_matches_fixture(body, "panel")


def test_an_empty_business_answers_real_zeros(client: TestClient) -> None:
    answer = client.get("/panel").json()

    for period in ("today", "week", "month"):
        figures = answer["periods"][period]
        assert figures["sales"] == 0
        assert figures["sales_count"] == 0
        assert figures["average_sale"] is None
        assert figures["quantity_sold"] == 0
        assert figures["quantity_gifted"] == 0
        assert figures["cost_of_goods"] == 0
        assert figures["pending_cost"] is False
        assert figures["shortfall"] is None  # no negative adjustment: no Faltante de stock
        assert figures["expenses"] == 0
        assert figures["purchases"] == 0
        assert figures["profit"] == 0
        assert figures["profit_pending"] is False
        assert figures["cash"] == 0
    assert answer["debts"] == {
        "total_owed": 0,
        "sales_owing_count": 0,
        "oldest": None,
        "teaser": [],
    }
    assert answer["stock"] == []


def test_a_payment_is_counted_on_its_own_paid_on_date_not_the_sale_s_date(
    client: TestClient, clock: MovableClock
) -> None:
    old_day = date(2026, 9, 1)
    pay_day = date(2026, 10, 15)
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    variety_id = _variety(client, "Sativa", price=20_000)
    customer_id = _customer(client, "Ana")
    _sale(
        client,
        variety_id,
        quantity="5",
        on=old_day.isoformat(),
        customer_id=customer_id,
        payment="owing",
    )
    payment = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": pay_day.isoformat(), "amount": 20_000, "method": "cash"},
    )
    assert payment.status_code == 201, payment.text

    today = client.get("/panel").json()["periods"]["today"]

    # The sale is dated in September, so today's sales stay at 0 — but the payment,
    # dated today, still counts toward today's Caja.
    assert today["sales"] == 0
    assert today["cash"] == 20_000


def test_a_backdated_purchase_turns_pending_cost_into_a_real_one(
    client: TestClient, clock: MovableClock
) -> None:
    day = date(2026, 10, 15)
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    variety_id = _variety(client, "Indica")
    # No stock at all yet: the sale's grams have no lot behind them.
    _sale(client, variety_id, quantity="5", on=day.isoformat())

    pending_answer = client.get("/panel").json()["periods"]["today"]
    assert pending_answer["cost_of_goods"] == 0
    assert pending_answer["pending_cost"] is True

    # A purchase backdated before the sale (ADR-0010): `allocate` reruns over the
    # whole history, so the same sale line now costs something real.
    _entry(client, variety_id, quantity="10", total_cost=500, on=day.replace(day=13).isoformat())

    costed_answer = client.get("/panel").json()["periods"]["today"]
    assert costed_answer["pending_cost"] is False
    assert costed_answer["cost_of_goods"] == 250  # 5g at 50/g (500/10)
    assert costed_answer["profit"] == costed_answer["sales"] - 250


def test_editing_a_stock_entry_s_cost_moves_cost_of_goods_and_profit(
    client: TestClient, clock: MovableClock
) -> None:
    day = date(2026, 10, 15)
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    variety_id = _variety(client, "Criolla edit")
    entry_id = _entry(client, variety_id, quantity="10", total_cost=1_000, on=day.isoformat())
    _sale(client, variety_id, quantity="5", on=day.isoformat())

    before = client.get("/panel").json()["periods"]["today"]
    assert before["cost_of_goods"] == 500  # 5g at 100/g

    edited = client.put(
        f"/stock/entries/{entry_id}",
        json={
            "product_id": variety_id,
            "origin": "opening_stock",
            "quantity": "10",
            "total_cost": 2_000,
            "date": day.isoformat(),
        },
    )
    assert edited.status_code == 200, edited.text

    after = client.get("/panel").json()["periods"]["today"]
    assert after["cost_of_goods"] == 1_000  # 5g at 200/g
    assert after["profit"] == after["sales"] - 1_000


def test_a_negative_adjustment_s_grams_are_never_summed_into_cost_of_goods(
    client: TestClient, clock: MovableClock
) -> None:
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    variety_id = _variety(client, "Ajustada")
    _entry(client, variety_id, quantity="10", total_cost=1_000, on="2026-10-13")
    adjustment = client.post(
        "/stock/entries",
        json={
            "product_id": variety_id,
            "origin": "adjustment",
            "quantity": "-4",
            "date": "2026-10-14",
        },
    )
    assert adjustment.status_code == 201, adjustment.text
    _sale(client, variety_id, quantity="5", on="2026-10-15")

    panel = client.get("/panel").json()["periods"]
    today = panel["today"]
    week = panel["week"]

    # 10g at $100/g; the adjustment removes 4g with no cost of its own; the sale then
    # draws 5g from what is left of the same lot: 5 * 100 = 500, never inflated by the
    # adjustment's grams.
    assert today["cost_of_goods"] == 500
    # The adjustment is dated 2026-10-14, one day before Hoy (2026-10-15): it carries
    # no shortfall of Hoy's own.
    assert today["shortfall"] is None
    # ...but 2026-10-14 falls in the same Monday-Sunday week as the sale, where the
    # adjustment's own 4g, costed at the same $100/g, shows as Faltante de stock,
    # never folded into cost_of_goods: 4 * 100 = 400.
    assert week["shortfall"] == {"amount": 400, "pending": False}
    assert week["profit"] == week["sales"] - week["cost_of_goods"] - week["shortfall"]["amount"]


def test_negative_ganancia_and_cash_are_shown_not_floored(
    client: TestClient, clock: MovableClock
) -> None:
    day = date(2026, 10, 15)
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    _expense(client, amount=5_000, on=day.isoformat())

    today = client.get("/panel").json()["periods"]["today"]

    assert today["profit"] == -5_000
    assert today["cash"] == -5_000


def test_agreement_with_sales_debts_and_stock_at_2026_12_31(
    client: TestClient, clock: MovableClock
) -> None:
    day = date(2026, 12, 31)
    clock.set(datetime(2026, 12, 31, 18, 0, tzinfo=UTC))
    # The session `client` carries is only 30 days old (`SESSION_LIFETIME`); jumping
    # to December outlives it, so a fresh login is needed at the new instant.
    relogged = client.post("/auth/login", json={"email": "uno@example.com", "password": PASSWORD})
    assert relogged.status_code == 200, relogged.text
    client = signed_in(client, relogged.json()["token"])

    # One variety never touched (no_entries), one with stock and a sale (ok), one
    # sold out, and one low with a threshold.
    no_entries_id = _variety(client, "Sin entradas")
    ok_id = _variety(client, "Con stock")
    _entry(client, ok_id, quantity="100", total_cost=1_000, on=day.isoformat())
    sold_out_id = _variety(client, "Agotada")
    _entry(client, sold_out_id, quantity="10", total_cost=500, on=day.isoformat())
    low_id = _variety(client, "Poca")
    _entry(client, low_id, quantity="10", total_cost=500, on=day.isoformat())
    threshold = client.put(f"/stock/products/{low_id}/threshold", json={"quantity": "20"})
    assert threshold.status_code == 200, threshold.text

    _sale(client, ok_id, quantity="5", on=day.isoformat())
    _sale(client, sold_out_id, quantity="10", on=day.isoformat())
    _sale(client, low_id, quantity="5", on=day.isoformat())

    customer_id = _customer(client, "Deudora")
    _sale(client, ok_id, quantity="1", on=day.isoformat(), customer_id=customer_id, payment="owing")

    # A sale in the month but outside the week (the Monday-Sunday week containing
    # 2026-12-31 runs 2026-12-28..2027-01-03, so 2026-12-01 falls in the month only),
    # and a sale in the week but outside the month, across the year boundary into
    # January — so today, week and month each hold a different set of sales, and a
    # wrong bound at the year boundary cannot pass unnoticed.
    boundary_id = _variety(client, "Año nuevo", price=5_000)
    _entry(client, boundary_id, quantity="50", total_cost=500, on="2026-12-01")
    _sale(client, boundary_id, quantity="2", on="2026-12-01")
    clock.set(datetime(2027, 1, 2, 18, 0, tzinfo=UTC))
    _sale(client, boundary_id, quantity="3", on="2027-01-02")
    clock.set(datetime(2026, 12, 31, 18, 0, tzinfo=UTC))

    panel = client.get("/panel").json()
    bounds = compute_periods(day)

    ids_by_period: dict[str, set[int]] = {}
    for key, period in (("today", bounds.today), ("week", bounds.week), ("month", bounds.month)):
        sales_in_period = client.get(
            "/sales",
            params={"date_from": period.start.isoformat(), "date_to": period.end.isoformat()},
        ).json()
        assert panel["periods"][key]["sales"] == sum(s["total"] for s in sales_in_period)
        assert panel["periods"][key]["sales_count"] == len(sales_in_period)
        ids_by_period[key] = {s["id"] for s in sales_in_period}

        cost_from_lines = 0
        for sale_summary in sales_in_period:
            detail = client.get(f"/sales/{sale_summary['id']}").json()
            for line in detail["lines"]:
                cost_from_lines += line["cost"]["costed"] or 0
        assert panel["periods"][key]["cost_of_goods"] == cost_from_lines

    # Proves the boundary sales land exactly where meant, not merged into every
    # period by a wrong bound: December's sale is in the month but never the week
    # (which starts 2026-12-28), and January's is in the week but never the month.
    december_boundary_sale = ids_by_period["month"] - ids_by_period["today"]
    january_boundary_sale = ids_by_period["week"] - ids_by_period["today"]
    assert december_boundary_sale and december_boundary_sale.isdisjoint(ids_by_period["week"])
    assert january_boundary_sale and january_boundary_sale.isdisjoint(ids_by_period["month"])
    assert ids_by_period["today"] < ids_by_period["week"]
    assert ids_by_period["today"] < ids_by_period["month"]

    debtors = client.get("/payments/debtors").json()
    assert panel["debts"]["total_owed"] == debtors["total_owed"]
    assert panel["debts"]["sales_owing_count"] == debtors["sales_owing_count"]
    expected_oldest = debtors["debtors"][0]["owing_since"] if debtors["debtors"] else None
    assert panel["debts"]["oldest"] == expected_oldest

    stock = client.get("/stock").json()
    stock_by_id = {row["product_id"]: row for row in stock["products"]}
    panel_ids = {row["variety_id"] for row in panel["stock"]}
    assert panel_ids == {no_entries_id, ok_id, sold_out_id, low_id, boundary_id}
    statuses = {row["variety_id"]: row["status"] for row in panel["stock"]}
    assert statuses[no_entries_id] == "no_entries"
    assert statuses[ok_id] == "ok"
    assert statuses[sold_out_id] == "sold_out"
    assert statuses[low_id] == "low"
    for row in panel["stock"]:
        reference = dict(stock_by_id[row["variety_id"]])
        # The panel row still says variety_id (its own slice renames it); stock's says product_id.
        own = {("product_id" if key == "variety_id" else key): value for key, value in row.items()}
        del own["name"]
        assert own == reference


# -- Agreement with GET /analysis (ADR-0013 amendment GH-70; PM: "Inicio's Ganancia
# equals Análisis's profit for the same period, to the peso") -----------------------


def test_a_negative_adjustment_beyond_every_lot_is_shortfall_only_pending(
    client: TestClient, clock: MovableClock
) -> None:
    """A sale that exhausts the lot exactly, then a negative adjustment with nothing
    left to draw from: the sale's own cost stays fully costed (`pending_cost` false)
    while the shortfall alone carries pending grams — the two flags are read off their
    own figure, never combined (plan invariant)."""
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    variety_id = _variety(client, "Sin lote")
    _entry(client, variety_id, quantity="10", total_cost=1_000, on="2026-10-15")
    _sale(client, variety_id, quantity="10", on="2026-10-15")
    # Same day as the sale, so only recording order (not the date) tells the two
    # apart; `LotOrder` compares `recorded_at` ahead of `rank` (`app/stock/domain/
    # lot_order.py`), so the clock must actually advance here for the sale to draw
    # first and exhaust the lot, leaving the adjustment with nothing left to draw.
    clock.set(datetime(2026, 10, 15, 18, 30, tzinfo=UTC))
    adjustment = client.post(
        "/stock/entries",
        json={
            "product_id": variety_id,
            "origin": "adjustment",
            "quantity": "-3",
            "date": "2026-10-15",
        },
    )
    assert adjustment.status_code == 201, adjustment.text

    today = client.get("/panel").json()["periods"]["today"]

    assert today["pending_cost"] is False
    assert today["shortfall"] == {"amount": 0, "pending": True}
    assert today["profit_pending"] is True


def test_the_panel_agrees_with_analysis_on_shortfall_and_pending_grams(
    client: TestClient,
) -> None:
    """The clock (`tests.conftest.TODAY`) is Friday 2026-10-02: the week is
    28/09-04/10, the month 01/10-31/10 — chosen so Hoy, the week and the month each
    hold records the other two don't (CODING_STANDARDS invariant). Varieties X, Y, Z
    are priced from before 2026-09-20 (`_variety`'s own `effective_from`)."""
    x_id = _variety(client, "X", price=1_000)
    y_id = _variety(client, "Y", price=2_000)
    z_id = _variety(client, "Z", price=1_500)
    customer_id = _customer(client, "Deudora GH-70")

    # 2026-09-20: X bought, 10g for $5.000 -> $500/g.
    _entry(client, x_id, quantity="10", total_cost=5_000, on="2026-09-20")
    # 27/09: a 1g sale of X (owing, so there is something to pay on 01/10). Outside the
    # week (which starts 28/09) and outside the month.
    _sale(client, x_id, quantity="1", on="2026-09-27", customer_id=customer_id, payment="owing")
    # 29/09 (inside the week): a -2g adjustment, then a 7g sale — both costed off the
    # same lot, which is used up exactly: 10 - 1 - 2 - 7 = 0.
    adjustment_29 = client.post(
        "/stock/entries",
        json={"product_id": x_id, "origin": "adjustment", "quantity": "-2", "date": "2026-09-29"},
    )
    assert adjustment_29.status_code == 201, adjustment_29.text
    _sale(client, x_id, quantity="7", on="2026-09-29")

    # 01/10 (inside the week and the month, outside Hoy): Z bought and sold, an
    # expense, and a payment against the 27/09 debt.
    _entry(client, z_id, quantity="20", total_cost=2_000, on="2026-10-01")
    _sale(client, z_id, quantity="5", on="2026-10-01")
    _expense(client, amount=800, on="2026-10-01")
    payment = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-10-01", "amount": 1_000, "method": "cash"},
    )
    assert payment.status_code == 201, payment.text

    # 02/10 = Hoy: a 3g sale of Y, which has no entry at all (wholly pending), and a
    # -1g adjustment of X, whose lot is already empty (wholly pending too).
    _sale(client, y_id, quantity="3", on="2026-10-02")
    adjustment_today = client.post(
        "/stock/entries",
        json={"product_id": x_id, "origin": "adjustment", "quantity": "-1", "date": "2026-10-02"},
    )
    assert adjustment_today.status_code == 201, adjustment_today.text

    panel = client.get("/panel").json()
    analysis = client.get("/analysis").json()

    today_figures = panel["periods"]["today"]
    week_figures = panel["periods"]["week"]
    month_figures = panel["periods"]["month"]

    # Hoy, worked out by hand: only the Y sale and the wholly-pending X adjustment
    # fall on 2026-10-02.
    assert today_figures["sales"] == 6_000  # 3g * $2.000/g, Y
    assert today_figures["sales_count"] == 1  # the Y sale only; the adjustment is not a sale
    assert today_figures["average_sale"] == 6_000  # one sale, so the average is its own total
    assert today_figures["quantity_sold"] == 3.0
    assert today_figures["quantity_gifted"] == 0.0
    assert today_figures["cost_of_goods"] == 0  # Y has no entry: wholly pending, nothing costed
    assert today_figures["pending_cost"] is True
    assert today_figures["shortfall"] == {"amount": 0, "pending": True}  # X's lot is empty
    assert today_figures["expenses"] == 0  # the expense is dated 01/10
    assert today_figures["purchases"] == 0  # Z's purchase is dated 01/10
    # sales(6000) - pending sales(6000, the whole Y line is uncosted) - cost(0) -
    # shortfall costed(0) - expenses(0) = 0.
    assert today_figures["profit"] == 0
    assert today_figures["profit_pending"] is True
    # The Y sale is posted "cash" (`_sale`'s own default), which records an
    # on-the-spot payment dated today alongside it: 3g * $2.000/g = $6.000. No
    # expense or purchase is dated 02/10.
    assert today_figures["cash"] == 6_000

    # The flag matrix the brief requires: true exactly where Análisis's figure for the
    # same window carries pending grams.
    assert week_figures["pending_cost"] is True
    assert week_figures["shortfall"] == {"amount": 1_000, "pending": True}
    assert week_figures["profit_pending"] is True
    assert month_figures["pending_cost"] is True
    assert month_figures["shortfall"] == {"amount": 0, "pending": True}
    assert month_figures["profit_pending"] is True

    # Agreement with GET /analysis, 0 differences: the week against `weeks[-1]`, the
    # month against the chosen month (which defaults to Hoy's own month, 2026-10).
    week_row = analysis["weeks"][-1]
    assert week_row["first_day"] == week_figures["start"] == "2026-09-28"
    assert week_row["last_day"] == week_figures["end"] == "2026-10-04"
    assert week_row["sales"] == week_figures["sales"]
    assert week_row["expenses"] == week_figures["expenses"]
    assert week_row["profit"]["amount"] == week_figures["profit"]
    assert week_row["cash"] == week_figures["cash"]

    month_row = analysis["months"][-1]
    assert month_row["first_day"] == month_figures["start"] == "2026-10-01"
    assert month_row["last_day"] == month_figures["end"] == "2026-10-31"
    assert month_row["sales"] == month_figures["sales"]
    assert month_row["expenses"] == month_figures["expenses"]
    assert month_row["profit"]["amount"] == month_figures["profit"]
    assert month_row["cash"] == month_figures["cash"]

    # Análisis's own month (the query defaults to Hoy's month, so this is the same
    # October) exposes shortfall directly: the panel's month must match it to the peso.
    # Análisis's shape carries `pending_grams` (a decimal), the panel's own `pending`
    # (a bool, no grams on the wire, PM) — each flag read off its own figure's pending
    # grams, never compared by combining the two shapes.
    assert analysis["month"]["month"] == "2026-10"
    analysis_month_shortfall = analysis["month"]["shortfall"]
    assert analysis_month_shortfall is not None
    assert month_figures["shortfall"] is not None
    assert analysis_month_shortfall["amount"] == month_figures["shortfall"]["amount"]
    assert (analysis_month_shortfall["pending_quantity"] > 0) == month_figures["shortfall"][
        "pending"
    ]


def test_cost_of_goods_follows_each_period(client: TestClient) -> None:
    """The clock is the pinned `TODAY`, Friday 2026-10-02 (`tests/conftest.py`): Hoy is
    02/10, the week 28/09-04/10, the month 01/10-31/10. A's sales fall one in each of
    September (outside the week), the week before Hoy, and Hoy, so a cost of goods that
    ignored the period (or took only one sale's cost) would differ in each window."""
    a_id = _variety(client, "A", price=1_000)
    b_id = _variety(client, "B", price=1_000)
    # A: 100 g for $10.000 = $100/g. B has no entry at all, so all B's sales are pending.
    _entry(client, a_id, quantity="100", total_cost=10_000, on="2026-09-01")
    _sale(client, a_id, quantity="1", on="2026-09-15")
    _sale(client, a_id, quantity="2", on="2026-09-29")
    _sale(client, a_id, quantity="3", on=TODAY.isoformat())
    _sale(client, b_id, quantity="1", on="2026-09-29")

    panel = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()
    today, week, month = panel["today"], panel["week"], panel["month"]

    # The dates first: the windows are the ones the figures below are worked out for.
    week_row = analysis["weeks"][-1]
    month_row = analysis["months"][-1]
    assert week_row["first_day"] == week["start"] == "2026-09-28"
    assert week_row["last_day"] == week["end"] == "2026-10-04"
    assert month_row["month"] == analysis["month"]["month"] == "2026-10"

    # Hoy: A's 3 g at $100/g = $300, nothing pending.
    assert today["cost_of_goods"] == 300
    assert today["pending_cost"] is False
    # Week: A's 2 g (29/09) + 3 g (Hoy) = 5 g at $100/g = $500; B's 1 g sale on 29/09 is
    # pending (never counted as $0 cost). Sales: A $2.000 + $3.000 + B $1.000 = $6.000.
    # Profit leaves the pending sale out: A's $5.000 - $500.
    assert week["cost_of_goods"] == 500
    assert week["pending_cost"] is True
    assert week["sales"] == 6_000
    assert week["profit"] == 5_000 - 500
    assert week["profit_pending"] is True
    # October: only Hoy's sale, A's 3 g: sales $3.000, cost 3 g * $100 = $300.
    assert month["cost_of_goods"] == 300
    assert month["pending_cost"] is False
    assert month["sales"] == 3_000
    assert month["profit"] == 3_000 - 300
    assert month["profit_pending"] is False

    # Análisis agrees on what it carries for the same windows.
    assert week_row["sales"] == 6_000
    assert week_row["profit"]["amount"] == 5_000 - 500
    assert week_row["profit"]["pending_quantity"] > 0
    assert month_row["sales"] == 3_000
    assert month_row["profit"]["amount"] == 3_000 - 300
    assert month_row["profit"]["pending_quantity"] == 0
    header_varieties = analysis["month"]["varieties"]
    assert sum(v["cost"]["costed"] for v in header_varieties) == month["cost_of_goods"] == 300
    assert not any(v["cost"]["pending_quantity"] > 0 for v in header_varieties)

    # Since the first record: sales are the full $7.000 (1.000 + 2.000 + 3.000 of A, B's
    # 1.000 pending but kept in the figure); A's 6 g cost $600, B's sale is left out of
    # profit: $6.000 - $600, with B's 1 g pending.
    since = analysis["since_first_record"]
    assert since["sales"] == 7_000
    assert since["expenses"] == 0
    assert since["profit"] == {"amount": 6_000 - 600, "pending_quantity": 1.0}


def _adjust(client: TestClient, variety_id: int, *, quantity: str, on: str) -> None:
    response = client.post(
        "/stock/entries",
        json={"product_id": variety_id, "origin": "adjustment", "quantity": quantity, "date": on},
    )
    assert response.status_code == 201, response.text


def _withdraw(client: TestClient, variety_id: int, *, reason: str, quantity: str, on: str) -> None:
    response = client.post(
        "/stock/withdrawals",
        json={
            "reason": reason,
            "date": on,
            "lines": [{"product_id": variety_id, "quantity": quantity}],
        },
    )
    assert response.status_code == 201, response.text


def test_the_analysis_rows_carry_cost_of_goods_and_shortfall_that_agree_with_the_panel(
    client: TestClient,
) -> None:
    """GH-141. The clock is Friday 2026-10-02: the week is 28/09-04/10, the month 01/10-31/10.
    A is 100 g for $10.000 ($100/g); B has no entry, so everything drawn from it is
    pending. The week holds costed and pending grams of each line; October holds only
    pending shortfall and promotion."""
    a_id = _variety(client, "A", price=1_000)
    b_id = _variety(client, "B", price=1_000)
    _entry(client, a_id, quantity="100", total_cost=10_000, on="2026-09-01")
    _sale(client, a_id, quantity="1", on="2026-09-22")
    _sale(client, a_id, quantity="2", on="2026-09-29")
    _sale(client, b_id, quantity="1", on="2026-09-29")
    _sale(client, a_id, quantity="3", on=TODAY.isoformat())
    _adjust(client, a_id, quantity="-2", on="2026-09-30")
    _adjust(client, b_id, quantity="-1", on=TODAY.isoformat())
    _withdraw(client, a_id, reason="promotion", quantity="4", on="2026-09-29")
    _withdraw(client, b_id, reason="promotion", quantity="2", on=TODAY.isoformat())
    _withdraw(client, a_id, reason="own_use", quantity="3", on="2026-10-01")

    panel = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()
    week_row, month_row = analysis["weeks"][-1], analysis["months"][-1]
    header = analysis["month"]

    # The current week and month equal the panel's, to the peso.
    assert week_row["cost_of_goods"]["amount"] == panel["week"]["cost_of_goods"] == 500
    assert month_row["cost_of_goods"]["amount"] == panel["month"]["cost_of_goods"] == 300
    assert week_row["shortfall"]["amount"] == panel["week"]["shortfall"]["amount"] == 200
    assert month_row["shortfall"]["amount"] == panel["month"]["shortfall"]["amount"] == 0
    # The current month's shortfall is one figure in three places.
    assert header["shortfall"] == month_row["shortfall"]
    assert header["shortfall"]["amount"] == panel["month"]["shortfall"]["amount"]

    # Each figure has its own pending grams and its own fully-pending flag.
    assert week_row["cost_of_goods"] == {
        "amount": 500,
        "pending_quantity": 1.0,
        "all_pending": False,
    }
    assert month_row["cost_of_goods"] == {
        "amount": 300,
        "pending_quantity": 0.0,
        "all_pending": False,
    }
    assert week_row["shortfall"] == {"amount": 200, "pending_quantity": 1.0, "all_pending": False}
    assert month_row["shortfall"] == {"amount": 0, "pending_quantity": 1.0, "all_pending": True}
    assert week_row["promotion"] == {"amount": 400, "pending_quantity": 2.0, "all_pending": False}
    assert month_row["promotion"] == {"amount": 0, "pending_quantity": 2.0, "all_pending": True}
    assert month_row["own_use"] == {"amount": 300, "pending_quantity": 0.0, "all_pending": False}
    assert header["promotion"] == month_row["promotion"]
    assert header["own_use"] == month_row["own_use"]

    # A past row, worked by hand: the week of 21/09 sold A's 1 g and had no adjustment;
    # September sold 4 g (A's 3 g costed $300, B's 1 g pending) and adjusted A out by $200.
    previous_week = analysis["weeks"][-2]
    assert previous_week["first_day"] == "2026-09-21"
    assert previous_week["cost_of_goods"] == {
        "amount": 100,
        "pending_quantity": 0.0,
        "all_pending": False,
    }
    assert previous_week["shortfall"] is None
    september = analysis["months"][-2]
    assert september["month"] == "2026-09"
    assert september["cost_of_goods"] == {
        "amount": 300,
        "pending_quantity": 1.0,
        "all_pending": False,
    }
    assert september["shortfall"] == {"amount": 200, "pending_quantity": 0.0, "all_pending": False}
    # A period with no sales reads a real $0, never null.
    quiet_week = analysis["weeks"][-3]
    assert quiet_week["cost_of_goods"] == {
        "amount": 0,
        "pending_quantity": 0.0,
        "all_pending": False,
    }

    # Since the first record: costed $200 plus B's pending gram, not fully pending.
    assert analysis["since_first_record"]["shortfall"] == {
        "amount": 200,
        "pending_quantity": 1.0,
        "all_pending": False,
    }
    # The row order is the PRD's.
    assert list(week_row)[:10] == [
        "first_day",
        "last_day",
        "sales",
        "quantity",
        "cost_of_goods",
        "shortfall",
        "promotion",
        "own_use",
        "expenses",
        "profit",
    ]


def test_a_wholly_pending_shortfall_reads_all_pending_on_the_row_header_and_since(
    client: TestClient,
) -> None:
    """Nothing costed anywhere: a negative adjustment of 3 g on a variety with no entry
    answers its grams as a positive magnitude and `all_pending` true everywhere the
    shortfall appears; the sale of the same variety is pending too."""
    b_id = _variety(client, "B", price=1_000)
    _sale(client, b_id, quantity="4", on=TODAY.isoformat())
    _adjust(client, b_id, quantity="-3", on=TODAY.isoformat())

    analysis = client.get("/analysis").json()
    pending = {"amount": 0, "pending_quantity": 3.0, "all_pending": True}

    assert analysis["weeks"][-1]["shortfall"] == pending
    assert analysis["months"][-1]["shortfall"] == pending
    assert analysis["month"]["shortfall"] == pending
    assert analysis["since_first_record"]["shortfall"] == pending
    assert analysis["weeks"][-1]["cost_of_goods"] == {
        "amount": 0,
        "pending_quantity": 4.0,
        "all_pending": True,
    }


def test_a_zero_cost_lot_with_pending_overflow_is_not_fully_pending(client: TestClient) -> None:
    """A harvest lot costs $0 yet is costed: a 1 g sale leaves 4 g, so a shortfall of 8 g
    is $0 with 4 g pending, and `all_pending` is false because the lot's 4 g are costed."""
    harvest_id = _variety(client, "Cosecha", price=1_000)
    _entry(client, harvest_id, quantity="5", origin="harvest", on="2026-09-01")
    _sale(client, harvest_id, quantity="1", on="2026-09-29")
    _adjust(client, harvest_id, quantity="-8", on=TODAY.isoformat())

    analysis = client.get("/analysis").json()

    assert analysis["months"][-1]["shortfall"] == {
        "amount": 0,
        "pending_quantity": 4.0,
        "all_pending": False,
    }
    assert analysis["weeks"][-1]["cost_of_goods"] == {
        "amount": 0,
        "pending_quantity": 0.0,
        "all_pending": False,
    }


def test_a_current_week_and_month_without_a_negative_adjustment_read_shortfall_null_like_the_panel(
    client: TestClient,
) -> None:
    """No negative adjustment anywhere: the panel's week and month shortfall are null, and
    so are the Análisis rows' and the header's (absent, never a $0 line), while cost of
    goods still reads a real figure."""
    a_id = _variety(client, "A", price=1_000)
    _entry(client, a_id, quantity="10", total_cost=1_000, on="2026-09-01")
    _sale(client, a_id, quantity="2", on=TODAY.isoformat())

    panel = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()

    assert panel["week"]["shortfall"] is None
    assert panel["month"]["shortfall"] is None
    assert analysis["weeks"][-1]["shortfall"] is None
    assert analysis["months"][-1]["shortfall"] is None
    assert analysis["month"]["shortfall"] is None
    assert analysis["weeks"][-1]["cost_of_goods"]["amount"] == panel["week"]["cost_of_goods"] == 200


# -- Statement count (plan invariant: the same number of SQL statements for a small
# business as for a seeded one, in the style of Análisis's own
# `test_one_get_analysis_issues_the_same_number_of_statements_small_or_seeded`) ------
#
# A freshly opened (empty) business is not the right comparison (orchestrator decision,
# GH-70): with no rows at all, SQLAlchemy skips the price entries' `selectinload`
# statement outright, and `SqlLedgers.all()` (`app/payments/adapters/sql_ledgers.py`)
# issues none of its own three with no customers — an off-by-one that has nothing to
# do with the invariant being guarded (no per-row query; the count does not grow with
# history). Both seeds below are non-empty instead, so both sides hit the same joins.


def _seed_small_panel_history(client: TestClient) -> None:
    """The least a business can have while still exercising every join `GET /panel`
    makes: one priced variety, one entry, one cash sale, one customer with a debt, one
    expense and one negative adjustment."""
    day = TODAY.isoformat()
    variety_id = _variety(client, "Chica")
    _entry(client, variety_id, quantity="10", total_cost=500, on=day)
    _sale(client, variety_id, quantity="1", on=day)
    customer_id = _customer(client, "Deudora chica")
    _sale(client, variety_id, quantity="1", on=day, customer_id=customer_id, payment="owing")
    _expense(client, amount=100, on=day)
    adjustment = client.post(
        "/stock/entries",
        json={"product_id": variety_id, "origin": "adjustment", "quantity": "-1", "date": day},
    )
    assert adjustment.status_code == 201, adjustment.text
    withdrawal = client.post(
        "/stock/withdrawals",
        json={
            "reason": "promotion",
            "date": day,
            "lines": [{"product_id": variety_id, "quantity": "1"}],
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text


def _seed_bigger_panel_history(client: TestClient) -> None:
    """Several varieties, entries, cash and owing sales, expenses, several debtors and
    a negative adjustment, spread over roughly a year — never a handful of rows on one
    day, so a per-row query hiding behind a small seed cannot pass unnoticed."""
    variety_ids = [_variety(client, f"Variedad {i}", price=500 + i * 10) for i in range(8)]
    for i, variety_id in enumerate(variety_ids):
        _entry(
            client,
            variety_id,
            quantity="5000",
            total_cost=100_000 + i * 1_000,
            on=(TODAY - timedelta(days=360)).isoformat(),
        )
    category = client.post("/expense-categories", json={"name": "Varios GH-70"}).json()
    customer_ids = []
    for i in range(5):
        customer = client.post(
            "/customers", json={"name": f"Deudora {i}", "phone": f"11 5000-{i:04d}"}
        ).json()
        customer_ids.append(customer["id"])
    for i in range(60):
        day = (TODAY - timedelta(days=(i * 5) % 360)).isoformat()
        variety_id = variety_ids[i % len(variety_ids)]
        if i % 7 == 0:
            _sale(
                client,
                variety_id,
                quantity="1",
                on=day,
                customer_id=customer_ids[i % len(customer_ids)],
                payment="owing",
            )
        else:
            _sale(client, variety_id, quantity="1", on=day, payment="cash")
        client.post(
            "/expenses",
            json={
                "spent_on": day,
                "category_id": category["id"],
                "amount": 100 + i,
                "detail": "gasto",
            },
        )
    adjustment = client.post(
        "/stock/entries",
        json={
            "product_id": variety_ids[0],
            "origin": "adjustment",
            "quantity": "-1",
            "date": TODAY.isoformat(),
        },
    )
    assert adjustment.status_code == 201, adjustment.text
    withdrawal = client.post(
        "/stock/withdrawals",
        json={
            "reason": "own_use",
            "date": TODAY.isoformat(),
            "lines": [{"product_id": variety_ids[0], "quantity": "1"}],
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text


def _statement_count(engine: Engine, client: TestClient) -> int:
    with captured_statements(engine) as statements:
        response = client.get("/panel")
        assert response.status_code == 200, response.text
    return len(statements)


def test_get_panel_issues_the_same_number_of_statements_small_or_seeded(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _seed_small_panel_history(client)
    _seed_bigger_panel_history(other_client)

    small_count = _statement_count(engine, client)
    big_count = _statement_count(engine, other_client)

    assert small_count == big_count, (small_count, big_count)


def test_an_archived_variety_leaves_the_panel_stock_rows_but_not_the_period_figures(
    client: TestClient, engine: Engine
) -> None:
    kept = _variety(client, "Kept")
    gone = _variety(client, "Gone")
    for variety_id in (kept, gone):
        _entry(client, variety_id, quantity="100", total_cost=None, on="2026-10-01")
        sold = client.post(
            "/sales",
            json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
        )
        assert sold.status_code == 201, sold.text
    before = client.get("/panel").json()
    archive_by_hand(engine, gone)

    after = client.get("/panel").json()

    assert {row["variety_id"] for row in before["stock"]} == {kept, gone}
    assert [row["variety_id"] for row in after["stock"]] == [kept]
    assert {key: value for key, value in after.items() if key != "stock"} == {
        key: value for key, value in before.items() if key != "stock"
    }
