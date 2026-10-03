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

from datetime import UTC, date, datetime
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import PASSWORD, MovableClock, signed_in
from tests.contract_shapes import assert_matches_fixture


def _variety(client: TestClient, name: str, price: int = 10_000) -> int:
    variety = client.post("/varieties", json={"name": name}).json()
    priced = client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2020-01-01", "list_price": price},
    )
    assert priced.status_code == 201, priced.text
    return int(variety["id"])


def _entry(
    client: TestClient,
    variety_id: int,
    *,
    grams: str,
    origin: str = "opening_stock",
    total_cost: int | None = None,
    on: str,
) -> int:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": origin, "grams": grams, "date": on}
    if total_cost is not None:
        body["total_cost"] = total_cost
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def _sale(
    client: TestClient,
    variety_id: int,
    *,
    grams: str,
    on: str,
    gift: bool = False,
    customer_id: int | None = None,
    payment: str | None = "cash",
) -> None:
    body: dict[str, Any] = {
        "date": on,
        "payment": payment,
        "lines": [{"variety_id": variety_id, "grams": grams, "gift": gift}],
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
    _entry(client, variety_id, grams="10", total_cost=1_000, on=day.isoformat())
    _sale(client, variety_id, grams="5", on=day.isoformat())

    answer = client.get("/panel")

    assert answer.status_code == 200, answer.text
    body = answer.json()
    assert_matches_fixture(body, "panel")
    # The fixture's own `month.average_sale: null` makes `assert_matches_fixture`
    # accept any type there (Tech Lead finding): pinned here instead, on every period.
    for period in ("today", "week", "month"):
        value = body["periods"][period]["average_sale"]
        assert value is None or isinstance(value, int)


def test_an_empty_business_answers_real_zeros(client: TestClient) -> None:
    answer = client.get("/panel").json()

    for period in ("today", "week", "month"):
        figures = answer["periods"][period]
        assert figures["sales"] == 0
        assert figures["sales_count"] == 0
        assert figures["average_sale"] is None
        assert figures["grams_sold"] == 0
        assert figures["grams_gifted"] == 0
        assert figures["cost_of_goods"] == 0
        assert figures["pending_cost"] is False
        assert figures["expenses"] == 0
        assert figures["purchases"] == 0
        assert figures["profit"] == 0
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
        grams="5",
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
    _sale(client, variety_id, grams="5", on=day.isoformat())

    pending_answer = client.get("/panel").json()["periods"]["today"]
    assert pending_answer["cost_of_goods"] == 0
    assert pending_answer["pending_cost"] is True

    # A purchase backdated before the sale (ADR-0010): `allocate` reruns over the
    # whole history, so the same sale line now costs something real.
    _entry(client, variety_id, grams="10", total_cost=500, on=day.replace(day=13).isoformat())

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
    entry_id = _entry(client, variety_id, grams="10", total_cost=1_000, on=day.isoformat())
    _sale(client, variety_id, grams="5", on=day.isoformat())

    before = client.get("/panel").json()["periods"]["today"]
    assert before["cost_of_goods"] == 500  # 5g at 100/g

    edited = client.put(
        f"/stock/entries/{entry_id}",
        json={
            "variety_id": variety_id,
            "origin": "opening_stock",
            "grams": "10",
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
    _entry(client, variety_id, grams="10", total_cost=1_000, on="2026-10-13")
    adjustment = client.post(
        "/stock/entries",
        json={
            "variety_id": variety_id,
            "origin": "adjustment",
            "grams": "-4",
            "date": "2026-10-14",
        },
    )
    assert adjustment.status_code == 201, adjustment.text
    _sale(client, variety_id, grams="5", on="2026-10-15")

    today = client.get("/panel").json()["periods"]["today"]

    # 10g at $100/g; the adjustment removes 4g with no cost of its own; the sale then
    # draws 5g from what is left of the same lot: 5 * 100 = 500, never inflated by the
    # adjustment's grams.
    assert today["cost_of_goods"] == 500


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
    _entry(client, ok_id, grams="100", total_cost=1_000, on=day.isoformat())
    sold_out_id = _variety(client, "Agotada")
    _entry(client, sold_out_id, grams="10", total_cost=500, on=day.isoformat())
    low_id = _variety(client, "Poca")
    _entry(client, low_id, grams="10", total_cost=500, on=day.isoformat())
    threshold = client.put(f"/stock/varieties/{low_id}/threshold", json={"grams": "20"})
    assert threshold.status_code == 200, threshold.text

    _sale(client, ok_id, grams="5", on=day.isoformat())
    _sale(client, sold_out_id, grams="10", on=day.isoformat())
    _sale(client, low_id, grams="5", on=day.isoformat())

    customer_id = _customer(client, "Deudora")
    _sale(client, ok_id, grams="1", on=day.isoformat(), customer_id=customer_id, payment="owing")

    panel = client.get("/panel").json()

    sales_for_day = client.get(
        "/sales", params={"date_from": day.isoformat(), "date_to": day.isoformat()}
    ).json()
    assert panel["periods"]["today"]["sales"] == sum(s["total"] for s in sales_for_day)
    assert panel["periods"]["today"]["sales_count"] == len(sales_for_day)

    cost_from_lines = 0
    for sale_summary in sales_for_day:
        detail = client.get(f"/sales/{sale_summary['id']}").json()
        for line in detail["lines"]:
            cost_from_lines += line["cost"]["costed"] or 0
    assert panel["periods"]["today"]["cost_of_goods"] == cost_from_lines

    debtors = client.get("/payments/debtors").json()
    assert panel["debts"]["total_owed"] == debtors["total_owed"]
    assert panel["debts"]["sales_owing_count"] == debtors["sales_owing_count"]
    expected_oldest = debtors["debtors"][0]["owing_since"] if debtors["debtors"] else None
    assert panel["debts"]["oldest"] == expected_oldest

    stock = client.get("/stock").json()
    stock_by_id = {row["variety_id"]: row for row in stock["varieties"]}
    panel_ids = {row["variety_id"] for row in panel["stock"]}
    assert panel_ids == {no_entries_id, ok_id, sold_out_id, low_id}
    statuses = {row["variety_id"]: row["status"] for row in panel["stock"]}
    assert statuses[no_entries_id] == "no_entries"
    assert statuses[ok_id] == "ok"
    assert statuses[sold_out_id] == "sold_out"
    assert statuses[low_id] == "low"
    for row in panel["stock"]:
        reference = dict(stock_by_id[row["variety_id"]])
        own = dict(row)
        del own["name"]
        assert own == reference
