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
from tests.conftest import PASSWORD, TODAY, MovableClock, reason_id, signed_in
from tests.contract_shapes import assert_matches_fixture
from tests.fakes.archive import archive_by_hand
from tests.payment_body import payment_body
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
        "payment": payment_body(payment, client),
        "lines": [{"product_id": variety_id, "quantity": quantity, "gift": gift}],
    }
    if customer_id is not None:
        body["customer_id"] = customer_id
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text


def _customer(client: TestClient, name: str) -> int:
    response = client.post(
        "/customers", json={"name": name, "phone": "11 5555-5555", "phone_country": "AR"}
    )
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
        json={"paid_on": pay_day.isoformat(), "amount": 20_000, "payment_method_id": 1},
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
    panel_ids = {row["product_id"] for row in panel["stock"]}
    assert panel_ids == {no_entries_id, ok_id, sold_out_id, low_id, boundary_id}
    statuses = {row["product_id"]: row["status"] for row in panel["stock"]}
    assert statuses[no_entries_id] == "no_entries"
    assert statuses[ok_id] == "ok"
    assert statuses[sold_out_id] == "sold_out"
    assert statuses[low_id] == "low"
    for row in panel["stock"]:
        reference = dict(stock_by_id[row["product_id"]])
        own = dict(row)
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
        json={"paid_on": "2026-10-01", "amount": 1_000, "payment_method_id": 1},
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
    header_varieties = analysis["month"]["products"]
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
            "reason_id": reason_id(client, reason),
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
    _withdraw(client, a_id, reason="Marketing", quantity="4", on="2026-09-29")
    _withdraw(client, b_id, reason="Marketing", quantity="2", on=TODAY.isoformat())
    _withdraw(client, a_id, reason="Own use", quantity="3", on="2026-10-01")

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
    assert [(w["name"], w["amount"], w["pending_quantity"]) for w in week_row["withdrawals"]] == [
        ("Marketing", 400, 2.0),
        ("Own use", 300, 0.0),
    ]
    assert [(w["name"], w["amount"], w["pending_quantity"]) for w in month_row["withdrawals"]] == [
        ("Marketing", None, 2.0),
        ("Own use", 300, 0.0),
    ]
    assert header["withdrawals"] == month_row["withdrawals"]

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
    assert list(week_row)[:9] == [
        "first_day",
        "last_day",
        "sales",
        "quantity",
        "cost_of_goods",
        "shortfall",
        "withdrawals",
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


def _later_payment(
    client: TestClient, customer_id: int, *, amount: int, on: str, method_id: int
) -> None:
    paid = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": on, "amount": amount, "payment_method_id": method_id},
    )
    assert paid.status_code == 201, paid.text


def _pay_today_through_many_methods(client: TestClient, customer_id: int, variety_id: int) -> None:
    """6 more methods, 2 archived, with Payments dated today over 5 of them (an archived
    one included), mixing On-the-spot and later: `money_in` must stay one statement."""
    today = TODAY.isoformat()
    method_ids = []
    for i in range(6):
        created = client.post("/api/payment-methods", json={"name": f"Metodo {i}"})
        assert created.status_code == 201, created.text
        method_ids.append(created.json()["id"])
    for index, method_id in enumerate(method_ids[:5]):
        if index % 2 == 0:
            _later_payment(client, customer_id, amount=10 + index, on=today, method_id=method_id)
        else:
            sold = client.post(
                "/sales",
                json={
                    "date": today,
                    "payment": {"kind": "paid", "payment_method_id": method_id},
                    "lines": [{"product_id": variety_id, "quantity": "1"}],
                },
            )
            assert sold.status_code == 201, sold.text
    for method_id in (method_ids[0], method_ids[5]):
        archived = client.post(f"/api/payment-methods/{method_id}/archive")
        assert archived.status_code == 204, archived.text


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
    _later_payment(client, customer_id, amount=100, on=day, method_id=1)
    _expense(client, amount=100, on=day)
    adjustment = client.post(
        "/stock/entries",
        json={"product_id": variety_id, "origin": "adjustment", "quantity": "-1", "date": day},
    )
    assert adjustment.status_code == 201, adjustment.text
    withdrawal = client.post(
        "/stock/withdrawals",
        json={
            "reason_id": reason_id(client, "Marketing"),
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
            "/customers",
            json={"name": f"Deudora {i}", "phone": f"11 5000-{i:04d}", "phone_country": "AR"},
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
    _pay_today_through_many_methods(client, customer_ids[0], variety_ids[0])
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
            "reason_id": reason_id(client, "Own use"),
            "date": TODAY.isoformat(),
            "lines": [{"product_id": variety_ids[0], "quantity": "1"}],
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text


# The merge-base count (20) plus the one `PaymentMethods` read, constant in history size
# and in the number of Payment methods.
PANEL_STATEMENTS = 21


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
    # Today's new lists add no statement, whatever they hold: a low Product and an
    # archived Product sold this week.
    low = _variety(other_client, "Escasa")
    _entry(other_client, low, quantity="1", on=TODAY.isoformat())
    _threshold(other_client, low, "5")
    gone = _variety(other_client, "Archivada")
    _sale(other_client, gone, quantity="1", on=TODAY.isoformat())
    archive_by_hand(engine, gone)
    assert other_client.get("/panel").json()["today"]["low_stock"]["count"] >= 1
    assert other_client.get("/panel").json()["today"]["best_sellers"] != []

    small_count = _statement_count(engine, client)
    big_count = _statement_count(engine, other_client)

    assert small_count == big_count == PANEL_STATEMENTS, (small_count, big_count)


def test_an_archived_variety_leaves_the_panel_stock_rows_but_not_the_period_figures(
    client: TestClient, engine: Engine
) -> None:
    kept = _variety(client, "Kept")
    gone = _variety(client, "Gone")
    for variety_id in (kept, gone):
        _entry(client, variety_id, quantity="100", total_cost=None, on="2026-10-01")
        sold = client.post(
            "/sales",
            json={
                "payment": {"kind": "paid", "payment_method_id": 1},
                "lines": [{"product_id": variety_id, "quantity": "10"}],
            },
        )
        assert sold.status_code == 201, sold.text
    before = client.get("/panel").json()
    archive_by_hand(engine, gone)

    after = client.get("/panel").json()

    assert {row["product_id"] for row in before["stock"]} == {kept, gone}
    assert [row["product_id"] for row in after["stock"]] == [kept]
    assert {key: value for key, value in after.items() if key != "stock"} == {
        key: value for key, value in before.items() if key != "stock"
    }


# --- the `today` block (GH-497 part 1) --------------------------------------------------

# Late enough that a week back is still after the session opened at the fixture's NOW.
BLOCK_DAY = date(2026, 10, 10)


def _art(day: date, hour: int, minute: int = 0, second: int = 0, micro: int = 0) -> datetime:
    """The instant at that wall time in Buenos Aires (UTC-3, no daylight saving)."""
    return datetime(day.year, day.month, day.day, hour, minute, second, micro, tzinfo=UTC) + (
        timedelta(hours=3)
    )


def _stocked_variety(client: TestClient) -> int:
    variety_id = _variety(client, "Criolla", price=1_000)
    _entry(client, variety_id, quantity="1000", on="2020-01-01")
    return variety_id


def _sale_recorded_at(
    client: TestClient,
    clock: MovableClock,
    variety_id: int,
    *,
    on: date,
    at: datetime,
    quantity: str = "1",
    shipping: int = 0,
    payment: str | None = "cash",
    customer_id: int | None = None,
) -> None:
    clock.set(at)
    body: dict[str, Any] = {
        "customer_id": customer_id,
        "date": on.isoformat(),
        "payment": payment_body(payment, client),
        "shipping_charged": shipping,
        "lines": [{"product_id": variety_id, "quantity": quantity, "gift": False}],
    }
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text


def _today_block(client: TestClient, clock: MovableClock, now: datetime) -> dict[str, Any]:
    clock.set(now)
    answer = client.get("/panel")
    assert answer.status_code == 200, answer.text
    block: dict[str, Any] = answer.json()["today"]
    return block


def test_today_sales_and_count_equal_the_periods_today_and_the_sales_list(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    day = BLOCK_DAY
    _sale_recorded_at(client, clock, variety_id, on=day, at=_art(day, 9), quantity="2")
    _sale_recorded_at(
        client,
        clock,
        variety_id,
        on=day,
        at=_art(day, 10),
        shipping=500,
        payment="owing",
        customer_id=_customer(client, "Ana"),
    )
    _sale_recorded_at(client, clock, variety_id, on=day - timedelta(days=1), at=_art(day, 11))

    clock.set(_art(day, 12))
    answer = client.get("/panel").json()
    listed = client.get(
        "/sales", params={"date_from": day.isoformat(), "date_to": day.isoformat()}
    ).json()

    today = answer["today"]
    assert today["sales"] == answer["periods"]["today"]["sales"]
    assert today["sales_count"] == answer["periods"]["today"]["sales_count"]
    assert today["sales_count"] == len(listed) == 2
    assert today["sales"] == sum(sale["total"] for sale in listed) == 2_000 + 1_000 + 500


def test_a_sale_at_the_cut_is_in_so_far_on_both_days_only_from_that_second(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    today = BLOCK_DAY
    last_week = today - timedelta(days=7)
    _sale_recorded_at(client, clock, variety_id, on=last_week, at=_art(last_week, 14, 5))
    _sale_recorded_at(client, clock, variety_id, on=today, at=_art(today, 14, 5), quantity="2")

    before = _today_block(client, clock, _art(today, 14, 4, 59))
    at_cut = _today_block(client, clock, _art(today, 14, 5, 0))
    after = _today_block(client, clock, _art(today, 14, 5, 1))

    assert (before["so_far"], before["last_week_so_far"]) == (0, 0)
    assert (at_cut["so_far"], at_cut["last_week_so_far"]) == (2_000, 1_000)
    assert (after["so_far"], after["last_week_so_far"]) == (2_000, 1_000)
    assert before["change_percent"] is None
    assert at_cut["change_percent"] == 100


def test_a_last_week_sale_milliseconds_after_the_cut_is_still_in_last_week_so_far(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    today = BLOCK_DAY
    last_week = today - timedelta(days=7)
    _sale_recorded_at(
        client, clock, variety_id, on=last_week, at=_art(last_week, 14, 5, 0, 700_000)
    )

    block = _today_block(client, clock, _art(today, 14, 5, 0, 200_000))

    assert block["last_week_so_far"] == 1_000


def test_a_sale_dated_last_week_but_recorded_today_is_late(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    today = BLOCK_DAY
    last_week = today - timedelta(days=7)
    _sale_recorded_at(client, clock, variety_id, on=last_week, at=_art(today, 9))

    block = _today_block(client, clock, _art(today, 14, 5))

    assert block["last_week_so_far"] == 0
    assert block["change_percent"] is None
    hourly = block["hourly_last_week"]
    assert [point["hour"] for point in hourly] == list(range(24))
    assert hourly[22]["total"] == 0
    assert hourly[23]["total"] == 1_000


def test_the_hourly_series_run_to_the_current_hour_and_to_hour_23(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    today = BLOCK_DAY
    last_week = today - timedelta(days=7)
    _sale_recorded_at(client, clock, variety_id, on=today, at=_art(today, 9, 30))
    _sale_recorded_at(client, clock, variety_id, on=last_week, at=_art(last_week, 14, 55))

    block = _today_block(client, clock, _art(today, 14, 5))

    assert block["last_week_day"] == last_week.isoformat()
    assert [point["hour"] for point in block["hourly_today"]] == list(range(15))
    assert block["hourly_today"][8]["total"] == 0
    assert block["hourly_today"][9]["total"] == 1_000
    assert block["hourly_today"][14]["total"] == 1_000
    assert block["hourly_last_week"][13]["total"] == 0
    assert block["hourly_last_week"][14]["total"] == 1_000
    assert block["last_week_so_far"] == 0


def test_the_today_block_and_periods_agree_on_the_day_at_the_edges_of_midnight(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    today = BLOCK_DAY
    _sale_recorded_at(client, clock, variety_id, on=today, at=_art(today, 0, 0, 0))

    late = _today_block(client, clock, _art(today, 23, 59, 59))
    late_periods = client.get("/panel").json()["periods"]["today"]
    midnight = _today_block(client, clock, _art(today + timedelta(days=1), 0, 0, 0))
    midnight_periods = client.get("/panel").json()["periods"]["today"]

    assert late_periods["start"] == today.isoformat()
    assert late["sales"] == late_periods["sales"] == 1_000
    assert midnight_periods["start"] == (today + timedelta(days=1)).isoformat()
    assert midnight["sales"] == midnight_periods["sales"] == 0
    assert [point["hour"] for point in midnight["hourly_today"]] == [0]
    assert midnight["last_week_day"] == (today - timedelta(days=6)).isoformat()


def test_get_panel_statement_count_ignores_the_today_block_history(
    client: TestClient, other_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    """`recorded_at` comes from the ledger's one existing SELECT, so Sales dated today
    and a week ago add no statement."""
    _seed_small_panel_history(client)
    _seed_bigger_panel_history(other_client)
    today = BLOCK_DAY
    last_week = today - timedelta(days=7)
    variety_id = _stocked_variety(other_client)
    for on, at in [
        (today, _art(today, 9)),
        (last_week, _art(last_week, 9)),
        (last_week, _art(today, 9)),
    ]:
        _sale_recorded_at(other_client, clock, variety_id, on=on, at=at)
    clock.set(_art(today, 12))

    assert _statement_count(engine, client) == _statement_count(engine, other_client)


# --- last 7 days and money in (GH-497 part 2) -------------------------------------------


def _cash_payments_received(client: TestClient, clock: MovableClock, day: date) -> int:
    clock.set(_art(day, 12))
    answer = client.get("/panel").json()
    # Cash is Payments received minus Expenses and Purchases: with neither, it is
    # exactly the Payments received.
    received: int = answer["periods"]["today"]["cash"]
    return received


def test_money_in_total_is_todays_payments_received_in_cash(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    day = BLOCK_DAY
    customer_id = _customer(client, "Ana")
    _sale_recorded_at(client, clock, variety_id, on=day, at=_art(day, 9))
    _sale_recorded_at(
        client,
        clock,
        variety_id,
        on=day,
        at=_art(day, 10),
        payment="owing",
        customer_id=customer_id,
    )
    _later_payment(client, customer_id, amount=400, on=day.isoformat(), method_id=2)
    _later_payment(
        client, customer_id, amount=50, on=(day - timedelta(days=1)).isoformat(), method_id=1
    )

    block = _today_block(client, clock, _art(day, 12))

    assert block["money_in"]["total"] == 1_400
    assert block["money_in"]["total"] == _cash_payments_received(client, clock, day)
    assert [(m["payment_method_id"], m["amount"]) for m in block["money_in"]["methods"]] == [
        (1, 1_000),
        (2, 400),
    ]


def test_the_last_day_of_last_7_days_is_todays_sales(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    day = BLOCK_DAY
    _sale_recorded_at(client, clock, variety_id, on=day, at=_art(day, 9), quantity="3")
    _sale_recorded_at(
        client, clock, variety_id, on=day - timedelta(days=2), at=_art(day, 9), shipping=250
    )

    block = _today_block(client, clock, _art(day, 12))

    series = block["last_7_days"]
    assert [item["day"] for item in series] == [
        (day - timedelta(days=n)).isoformat() for n in range(6, -1, -1)
    ]
    assert series[-1] == {"day": day.isoformat(), "sales": 3_000}
    assert series[-1]["sales"] == block["sales"]
    assert series[4]["sales"] == 1_250
    assert series[0]["sales"] == 0


def test_a_renamed_method_shows_its_new_name_in_money_in(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    day = BLOCK_DAY
    _sale_recorded_at(client, clock, variety_id, on=day, at=_art(day, 9), payment="transfer")
    renamed = client.patch("/api/payment-methods/2", json={"name": "Mercado Pago"})
    assert renamed.status_code == 200, renamed.text

    block = _today_block(client, clock, _art(day, 12))

    assert [m["name"] for m in block["money_in"]["methods"]] == ["Mercado Pago"]


# --- low stock, best sellers and month Profit (GH-497 part 4) ---------------------------


def _threshold(client: TestClient, variety_id: int, quantity: str) -> None:
    response = client.put(f"/stock/products/{variety_id}/threshold", json={"quantity": quantity})
    assert response.status_code == 200, response.text


def _hide(client: TestClient, variety_id: int) -> None:
    response = client.put(
        f"/catalog/products/{variety_id}",
        json={"shown": False, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert response.status_code == 200, response.text


def _sale_with(
    client: TestClient,
    clock: MovableClock,
    lines: list[dict[str, Any]],
    *,
    on: date,
    shipping: int = 0,
) -> None:
    """A paid Sale dated `on`, recorded at noon of that day."""
    clock.set(_art(on, 12))
    response = client.post(
        "/sales",
        json={
            "date": on.isoformat(),
            "payment": payment_body("cash", client),
            "shipping_charged": shipping,
            "lines": lines,
        },
    )
    assert response.status_code == 201, response.text


def _panel_on(client: TestClient, clock: MovableClock, day: date) -> dict[str, Any]:
    clock.set(_art(day, 12))
    answer = client.get("/panel")
    assert answer.status_code == 200, answer.text
    body: dict[str, Any] = answer.json()
    return body


def test_low_stock_lists_the_sold_out_then_the_low_rows_the_stock_screen_answers(
    client: TestClient, engine: Engine
) -> None:
    names = {}
    for name in ("Anis", "Boldo", "Cedron", "Dulce", "Eneldo", "Fresia", "Gaucho"):
        names[name] = _variety(client, name, price=1_000)
    _entry(client, names["Anis"], quantity="10", on="2026-10-01")
    _threshold(client, names["Anis"], "20")  # low
    _entry(client, names["Boldo"], quantity="5", on="2026-10-01")
    _sale(client, names["Boldo"], quantity="5", on="2026-10-02")  # sold out at exactly 0
    _sale(client, names["Cedron"], quantity="3", on="2026-10-02")  # sold, never stocked: -3
    _entry(client, names["Dulce"], quantity="3", on="2026-10-01")
    _threshold(client, names["Dulce"], "10")
    _hide(client, names["Dulce"])  # hidden and low: still listed
    _entry(client, names["Eneldo"], quantity="3", on="2026-10-01")
    _threshold(client, names["Eneldo"], "10")
    archive_by_hand(engine, names["Eneldo"])  # archived and low: not listed
    _entry(client, names["Gaucho"], quantity="100", on="2026-10-01")  # no threshold: ok
    # "Fresia" has no entry at all: no_entries, not listed.

    block = client.get("/panel").json()["today"]["low_stock"]
    stock = {row["product_id"]: row for row in client.get("/stock").json()["products"]}

    assert [row["product_id"] for row in block["rows"]] == [
        names["Boldo"],
        names["Cedron"],
        names["Anis"],
        names["Dulce"],
    ]
    assert block["count"] == 4
    for row in block["rows"]:
        shown = stock[row["product_id"]]
        assert (row["quantity"], row["status"]) == (shown["quantity"], shown["status"])
    assert {stock[names[n]]["status"] for n in ("Boldo", "Cedron")} == {"sold_out"}
    assert stock[names["Cedron"]]["quantity"] < 0
    assert stock[names["Fresia"]]["status"] == "no_entries"
    assert stock[names["Gaucho"]]["status"] == "ok"
    assert {row["name"] for row in block["rows"]} == {"Anis", "Boldo", "Cedron", "Dulce"}
    assert set(block["rows"][0]) == {"product_id", "name", "quantity", "status"}


def test_low_stock_is_an_empty_block_with_nothing_low(client: TestClient) -> None:
    assert client.get("/panel").json()["today"]["low_stock"] == {"count": 0, "rows": []}


def test_best_sellers_sum_this_weeks_stored_line_totals(
    client: TestClient, clock: MovableClock, engine: Engine
) -> None:
    today = BLOCK_DAY  # a Saturday: the week runs Monday 5 to Sunday 11
    monday, last_sunday, sunday = date(2026, 10, 5), date(2026, 10, 4), date(2026, 10, 11)
    alfa = _variety(client, "Alfa", price=1_000)
    beta = _variety(client, "Beta", price=500)
    gamma = _variety(client, "Gamma", price=100)
    delta = _variety(client, "Delta", price=9_000)
    epsilon = _variety(client, "Epsilon", price=9_000)
    for variety_id in (alfa, gamma, delta, epsilon):
        _entry(client, variety_id, quantity="1000", on="2020-01-01")
    # Shipping is not a Product's sales.
    _sale_with(client, clock, [{"product_id": alfa, "quantity": "2"}], on=monday, shipping=700)
    # One line over two lots (1 g, then 5 g) is one line: counted once, at its total.
    _entry(client, beta, quantity="1", origin="adjustment", on="2026-10-01")
    _entry(client, beta, quantity="5", origin="adjustment", on="2026-10-02")
    _sale_with(client, clock, [{"product_id": beta, "quantity": "3"}], on=today)
    # A Gift counts $0; a Special price counts as charged.
    _sale_with(
        client,
        clock,
        [
            {"product_id": alfa, "quantity": "1", "gift": True},
            {"product_id": alfa, "quantity": "1", "special_price": 250},
        ],
        on=today,
    )
    _sale_with(client, clock, [{"product_id": gamma, "quantity": "4", "gift": True}], on=today)
    # Outside the window: the Sunday before, and a Sale dated after today.
    _sale_with(client, clock, [{"product_id": epsilon, "quantity": "1"}], on=last_sunday)
    _sale_with(client, clock, [{"product_id": delta, "quantity": "1"}], on=sunday)
    _sale_with(client, clock, [{"product_id": gamma, "quantity": "1"}], on=monday)
    archive_by_hand(engine, gamma)  # archived Products are still counted
    renamed = client.patch(f"/api/products/{beta}", json={"name": "Beta Nueva"})
    assert renamed.status_code == 200, renamed.text

    block = _panel_on(client, clock, today)["today"]

    assert block["best_sellers"] == [
        {"product_id": alfa, "name": "Alfa", "sales": 2_250},
        {"product_id": beta, "name": "Beta Nueva", "sales": 1_500},
        {"product_id": gamma, "name": "Gamma", "sales": 100},
    ]
    # Delta's Sale is in the Week figures, but dated after today: not a best seller yet.
    later = _panel_on(client, clock, sunday)["today"]["best_sellers"]
    assert [row["name"] for row in later] == ["Delta", "Alfa", "Beta Nueva", "Gamma"]


def test_a_fully_pending_line_counts_at_its_full_total(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _variety(client, "Pendiente", price=1_000)
    # No stock behind the Sale: every gram is pending, the line still counts in full.
    _sale_with(client, clock, [{"product_id": variety_id, "quantity": "3"}], on=BLOCK_DAY)

    panel = _panel_on(client, clock, BLOCK_DAY)

    assert panel["periods"]["today"]["profit_pending"] is True
    assert panel["today"]["best_sellers"] == [
        {"product_id": variety_id, "name": "Pendiente", "sales": 3_000}
    ]


def test_best_sellers_are_an_empty_list_when_nothing_sold_this_week(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _stocked_variety(client)
    _sale_with(client, clock, [{"product_id": variety_id, "quantity": "1"}], on=date(2026, 10, 4))

    assert _panel_on(client, clock, BLOCK_DAY)["today"]["best_sellers"] == []


def _month_row(client: TestClient, month: str) -> dict[str, Any]:
    months = client.get("/analysis").json()["months"]
    return next(row for row in months if row["month"] == month)


def _assert_month_profit_is_analysis_month_row(
    client: TestClient, clock: MovableClock, month: str
) -> dict[str, Any]:
    clock.set(_art(BLOCK_DAY, 12))
    profit: dict[str, Any] = client.get("/panel").json()["today"]["month_profit"]
    row = _month_row(client, month)["profit"]
    assert profit == row
    assert set(profit) == {"amount", "pending_quantity"}
    return profit


def test_month_profit_equals_the_analysis_month_row_with_pending_grams_from_a_sale(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _variety(client, "Mezcla", price=1_000)
    _entry(client, variety_id, quantity="2", total_cost=400, on="2026-10-01")
    _sale_with(client, clock, [{"product_id": variety_id, "quantity": "5"}], on=BLOCK_DAY)

    profit = _assert_month_profit_is_analysis_month_row(client, clock, "2026-10")

    assert profit["pending_quantity"] == 3


def test_month_profit_counts_the_grams_of_a_withdrawal_alone_as_pending(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _variety(client, "Retirada", price=1_000)
    clock.set(_art(BLOCK_DAY, 12))
    withdrawn = client.post(
        "/stock/withdrawals",
        json={
            "reason_id": reason_id(client, "Own use"),
            "date": BLOCK_DAY.isoformat(),
            "lines": [{"product_id": variety_id, "quantity": "2"}],
        },
    )
    assert withdrawn.status_code == 201, withdrawn.text

    profit = _assert_month_profit_is_analysis_month_row(client, clock, "2026-10")

    assert profit == {"amount": 0, "pending_quantity": 2}


def test_month_profit_stays_negative(client: TestClient, clock: MovableClock) -> None:
    clock.set(_art(BLOCK_DAY, 12))
    _expense(client, amount=7_000, on=BLOCK_DAY.isoformat())
    variety_id = _stocked_variety(client)
    _sale_with(client, clock, [{"product_id": variety_id, "quantity": "2"}], on=BLOCK_DAY)

    profit = _assert_month_profit_is_analysis_month_row(client, clock, "2026-10")

    assert profit["amount"] == 2_000 - 7_000


def test_month_profit_is_zero_with_nothing_recorded(client: TestClient) -> None:
    body = client.get("/panel").json()

    assert body["today"]["month_profit"] == {"amount": 0, "pending_quantity": 0}
    assert body["today"]["month_profit"]["amount"] == body["periods"]["month"]["profit"]
    assert client.get("/analysis").json()["months"] == []
