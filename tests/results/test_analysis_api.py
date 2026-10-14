"""`GET /analysis` end to end (CODING_STANDARDS §5): a fresh in-memory SQLite per
test, the real adapters, the movable clock. Seeds only through the API."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import Engine

from tests.conftest import TODAY, MovableClock


def _variety_with_price(client: TestClient, name: str, list_price: int) -> int:
    variety = client.post("/varieties", json={"name": name}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return int(variety["id"])


def test_the_empty_business_answers_the_empty_shape(client: TestClient) -> None:
    response = client.get("/analysis")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["first_record"] is None
    assert body["weeks"] == []
    assert body["months"] == []
    assert body["since_first_record"] is None
    assert body["month"]["varieties"] == []
    assert body["month"]["month"] == "2026-10"


def test_a_malformed_month_is_refused(client: TestClient) -> None:
    response = client.get("/analysis", params={"month": "2026-13"})

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "analysis.month_invalid"


def test_a_month_after_today_is_refused(client: TestClient) -> None:
    response = client.get("/analysis", params={"month": "2026-11"})

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "analysis.month_out_of_range"


def test_a_month_before_the_first_record_is_refused(client: TestClient) -> None:
    variety_id = _variety_with_price(client, "Flor", 1_000)
    client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": "50"},
    )
    client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "1"}]}
    )

    response = client.get("/analysis", params={"month": "2026-09"})

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "analysis.month_out_of_range"


def test_the_month_expense_breakdown_matches_get_expenses_without_purchases(
    client: TestClient,
) -> None:
    # Categories differing in case and accents (docs/product/analysis.md: "sorted by
    # name as in Gastos"): both endpoints must order, subtotal and total them exactly
    # the same way, over the stored name_key.
    names = ["Transporte", "árbol", "ZEPELÍN", "andamios"]
    category_ids = [
        client.post("/expense-categories", json={"name": name}).json()["id"] for name in names
    ]
    for position, category_id in enumerate(category_ids, start=1):
        client.post(
            "/expenses",
            json={
                "spent_on": TODAY.isoformat(),
                "category_id": category_id,
                "amount": 1_000 * position,
                "detail": "gasto",
            },
        )

    expenses = client.get("/expenses").json()
    analysis = client.get("/analysis").json()

    assert len(analysis["month_expenses"]["categories"]) == len(names)
    assert analysis["month_expenses"]["total"] == expenses["total"]
    assert [
        (c["category_id"], c["name"], c["total"]) for c in analysis["month_expenses"]["categories"]
    ] == [(c["id"], c["name"], c["subtotal"]) for c in expenses["categories"]]
    # Purchases are never counted inside expenses (docs/product/analysis.md).
    assert analysis["month_expenses"]["purchases"] == 0


def test_a_purchase_is_its_own_line_never_inside_expenses(client: TestClient) -> None:
    variety_id = _variety_with_price(client, "Flor", 1_000)
    client.post(
        "/stock/entries",
        json={
            "variety_id": variety_id,
            "origin": "purchase",
            "grams": "50",
            "total_cost": 20_000,
        },
    )

    analysis = client.get("/analysis").json()

    assert analysis["month_expenses"]["purchases"] == 20_000
    assert analysis["month_expenses"]["categories"] == []
    assert analysis["month_expenses"]["total"] == 0


def test_a_backdated_stock_entry_moves_only_the_affected_week_month_and_variety(
    client: TestClient,
) -> None:
    variety_id = _variety_with_price(client, "Flor", 1_000)
    client.post(
        "/stock/entries",
        json={
            "variety_id": variety_id,
            "origin": "opening_stock",
            "grams": "10",
            "total_cost": 1_000,
            "date": "2026-09-01",
        },
    )
    sale = client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "10"}]}
    ).json()
    assert sale["lines"][0]["grams"] == 10.0

    # An unrelated variety, sold in a different month: its own lot and sale never
    # change, so August's figures must read byte-identical before and after.
    other_variety_id = _variety_with_price(client, "Otra", 500)
    client.post(
        "/stock/entries",
        json={
            "variety_id": other_variety_id,
            "origin": "opening_stock",
            "grams": "5",
            "total_cost": 500,
            "date": "2026-08-01",
        },
    )
    client.post(
        "/sales",
        json={
            "date": "2026-08-05",
            "payment": "cash",
            "lines": [{"variety_id": other_variety_id, "grams": "5"}],
        },
    )

    before_october = client.get("/analysis", params={"month": "2026-10"}).json()
    before_august = client.get("/analysis", params={"month": "2026-08"}).json()
    [variety_before] = before_october["month"]["varieties"]
    assert variety_before["cost"]["costed"] == 1_000

    # A cheaper lot, backdated before the sale: the sale's cost changes on the next
    # read, with no new sale and no edit to it (ADR-0009, criterion 3).
    cheaper_entry = client.post(
        "/stock/entries",
        json={
            "variety_id": variety_id,
            "origin": "opening_stock",
            "grams": "5",
            "total_cost": 100,
            "date": "2026-08-01",
        },
    )
    assert cheaper_entry.status_code == 201, cheaper_entry.text

    after_october = client.get("/analysis", params={"month": "2026-10"}).json()
    after_august = client.get("/analysis", params={"month": "2026-08"}).json()
    [variety_after] = after_october["month"]["varieties"]

    # Affected: the Flor variety's own cost and margin, and October's month row.
    assert variety_after["cost"]["costed"] < variety_before["cost"]["costed"]
    assert variety_after["margin"]["amount"] > variety_before["margin"]["amount"]
    october_row_before = next(m for m in before_october["months"] if m["month"] == "2026-10")
    october_row_after = next(m for m in after_october["months"] if m["month"] == "2026-10")
    assert october_row_after["profit"]["amount"] > october_row_before["profit"]["amount"]

    # Affected: the week containing Flor's sale (today — `weeks` is not tied to the
    # chosen month, so it reads the same off either response). Unaffected: an
    # earlier week, the one containing Otra's own sale (2026-08-05), which draws no
    # cost from Flor's new lot.
    current_week_before = next(w for w in before_october["weeks"] if w["last_day"] >= sale["date"])
    current_week_after = next(w for w in after_october["weeks"] if w["last_day"] >= sale["date"])
    assert current_week_after["profit"]["amount"] > current_week_before["profit"]["amount"]

    for before_week, after_week in zip(
        before_october["weeks"], after_october["weeks"], strict=True
    ):
        if before_week["last_day"] >= sale["date"]:
            continue  # the current week: expected to move, and does, above
        assert after_week == before_week

    # Unaffected: August's own month view (Otra's lot and sale draw no cost from
    # Flor's new lot) and August's row in `months` are untouched. (`since_first_record`
    # and the current week, which do cover Flor's October sale, are not compared
    # here: they are expected to move, and do, above.)
    assert after_august["month"] == before_august["month"]
    august_row_before = next(m for m in before_august["months"] if m["month"] == "2026-08")
    august_row_after = next(m for m in after_august["months"] if m["month"] == "2026-08")
    assert august_row_after == august_row_before


def test_a_negative_adjustment_lowers_profit_on_its_date_and_moves_no_variety_margin(
    client: TestClient,
) -> None:
    variety_id = _variety_with_price(client, "Flor", 1_000)
    client.post(
        "/stock/entries",
        json={
            "variety_id": variety_id,
            "origin": "opening_stock",
            "grams": "20",
            "total_cost": 2_000,
        },
    )
    sale = client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "5"}]}
    ).json()

    before = client.get("/analysis").json()
    variety_before = before["month"]["varieties"][0]

    adjustment = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "adjustment", "grams": "-3"},
    )
    assert adjustment.status_code == 201, adjustment.text

    after = client.get("/analysis").json()
    variety_after = after["month"]["varieties"][0]

    assert variety_after["margin"] == variety_before["margin"]
    assert variety_after["grams_sold"] == variety_before["grams_sold"]
    assert after["month"]["shortfall"] is not None
    assert after["month"]["shortfall"]["amount"] > 0
    # The week containing today's sale and the adjustment: profit falls by the
    # shortfall's cost relative to the no-adjustment case.
    current_week = next(w for w in after["weeks"] if w["last_day"] >= sale["date"])
    before_week = next(w for w in before["weeks"] if w["last_day"] >= sale["date"])
    assert current_week["profit"]["amount"] < before_week["profit"]["amount"]


def _statement_count(engine: Engine, client: TestClient) -> int:
    statements: list[str] = []

    def _record(
        conn: object, cursor: object, statement: str, parameters: object, *args: object
    ) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", _record)
    try:
        response = client.get("/analysis")
        assert response.status_code == 200, response.text
    finally:
        event.remove(engine, "before_cursor_execute", _record)
    return len(statements)


def _seed_bigger_history(client: TestClient) -> None:
    """A full seeded year (docs/product/analysis.md's '300 ms... a year of history'),
    not 25 sales on one day: entries, sales and expenses spread across the last 360
    days, over 8 varieties, so the 8 weeks, 12 months and every day bucket all carry
    real history — not just today's."""
    variety_ids = [_variety_with_price(client, f"Variedad {i}", 500 + i * 10) for i in range(8)]
    for i, variety_id in enumerate(variety_ids):
        client.post(
            "/stock/entries",
            json={
                "variety_id": variety_id,
                "origin": "opening_stock",
                "grams": "5000",
                "total_cost": 100_000 + i * 1_000,
                "date": (TODAY - timedelta(days=360)).isoformat(),
            },
        )
    category = client.post("/expense-categories", json={"name": "Varios"}).json()
    for i in range(120):
        day = (TODAY - timedelta(days=(i * 3) % 360)).isoformat()
        variety_id = variety_ids[i % len(variety_ids)]
        client.post(
            "/sales",
            json={
                "date": day,
                "payment": "cash",
                "lines": [{"variety_id": variety_id, "grams": "1"}],
            },
        )
        client.post(
            "/expenses",
            json={
                "spent_on": day,
                "category_id": category["id"],
                "amount": 100 + i,
                "detail": "gasto",
            },
        )
    withdrawal = client.post(
        "/stock/withdrawals",
        json={
            "reason": "own_use",
            "date": (TODAY - timedelta(days=7)).isoformat(),
            "lines": [{"variety_id": variety_ids[0], "grams": "1"}],
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text


def test_one_get_analysis_issues_the_same_number_of_statements_small_or_seeded(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_with_price(client, "Chica", 1_000)
    client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": "10"},
    )
    client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "1"}]}
    )
    client.post(
        "/stock/withdrawals",
        json={"reason": "promotion", "lines": [{"variety_id": variety_id, "grams": "1"}]},
    )

    _seed_bigger_history(other_client)

    small_count = _statement_count(engine, client)
    big_count = _statement_count(engine, other_client)

    assert small_count == big_count, (small_count, big_count)


def test_the_clock_crossing_sunday_midnight_argentina_time_changes_the_current_week(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _variety_with_price(client, "Flor", 1_000)
    client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": "10"},
    )

    clock.set(datetime(2026, 10, 5, 2, 30, tzinfo=UTC))  # Sunday 23:30 in Argentina
    before = client.get("/analysis").json()

    clock.set(datetime(2026, 10, 5, 3, 30, tzinfo=UTC))  # Monday 00:30 in Argentina
    after = client.get("/analysis").json()

    assert before["weeks"][-1]["first_day"] == "2026-09-28"
    assert after["weeks"][-1]["first_day"] == "2026-10-05"


def test_a_seeded_history_s_figures_match_a_direct_computation(client: TestClient) -> None:
    variety_id = _variety_with_price(client, "Flor", 1_000)
    client.post(
        "/stock/entries",
        json={
            "variety_id": variety_id,
            "origin": "opening_stock",
            "grams": "20",
            "total_cost": 2_000,
            "date": "2026-01-01",
        },
    )
    for sale_date in ["2026-08-10", "2026-09-15", TODAY.isoformat()]:
        sale = client.post(
            "/sales",
            json={
                "date": sale_date,
                "payment": "cash",
                "lines": [{"variety_id": variety_id, "grams": "5"}],
            },
        )
        assert sale.status_code == 201, sale.text
    category = client.post("/expense-categories", json={"name": "Varios"}).json()
    client.post(
        "/expenses",
        json={
            "spent_on": TODAY.isoformat(),
            "category_id": category["id"],
            "amount": 300,
            "detail": "gasto",
        },
    )

    analysis = client.get("/analysis").json()

    # Direct computation: each sale is 5 g at $1.000/g = $5.000, costing 5 g from the
    # single 20 g @ $2.000 lot (a flat $100/g) = $500; one $300 expense, today only.
    line_total, line_cost = 5_000, 500
    direct_sales_total = line_total * 3
    direct_cost_total = line_cost * 3
    direct_expenses_total = 300
    direct_profit = direct_sales_total - direct_cost_total - direct_expenses_total
    direct_cash = direct_sales_total - direct_expenses_total

    assert analysis["since_first_record"]["sales"] == direct_sales_total
    assert analysis["since_first_record"]["expenses"] == direct_expenses_total
    assert analysis["since_first_record"]["profit"]["amount"] == direct_profit
    assert analysis["since_first_record"]["cash"] == direct_cash

    def _month_row(month: str) -> dict[str, Any]:
        return next(m for m in analysis["months"] if m["month"] == month)

    august = _month_row("2026-08")
    assert august["sales"] == line_total
    assert august["expenses"] == 0
    assert august["profit"]["amount"] == line_total - line_cost
    assert august["cash"] == line_total

    september = _month_row("2026-09")
    assert september["sales"] == line_total
    assert september["profit"]["amount"] == line_total - line_cost

    october = _month_row("2026-10")
    assert october["sales"] == line_total
    assert october["expenses"] == 300
    assert october["profit"]["amount"] == line_total - line_cost - 300
    assert october["cash"] == line_total - 300

    # The week containing today: same figures as October's row, since today is the
    # only activity in it.
    today_iso = TODAY.isoformat()
    current_week = next(
        w for w in analysis["weeks"] if w["first_day"] <= today_iso <= w["last_day"]
    )
    assert current_week["sales"] == line_total
    assert current_week["expenses"] == 300
    assert current_week["profit"]["amount"] == line_total - line_cost - 300
    assert current_week["cash"] == line_total - 300

    # The two earlier sales (08-10, 09-15) each fall in their own week of the
    # 8-week window, no expense on either date: same per-sale figures as a week
    # with nothing else in it.
    def _week_containing(day: str) -> dict[str, Any]:
        return next(w for w in analysis["weeks"] if w["first_day"] <= day <= w["last_day"])

    week_0810 = _week_containing("2026-08-10")
    assert week_0810["sales"] == line_total
    assert week_0810["expenses"] == 0
    assert week_0810["profit"]["amount"] == line_total - line_cost
    assert week_0810["cash"] == line_total

    week_0915 = _week_containing("2026-09-15")
    assert week_0915["sales"] == line_total
    assert week_0915["expenses"] == 0
    assert week_0915["profit"]["amount"] == line_total - line_cost
    assert week_0915["cash"] == line_total

    # Every other week in the window — no sale, no expense — reads $0, not a
    # placeholder (plan, "nothing invented").
    covered_first_days = {
        week_0810["first_day"],
        week_0915["first_day"],
        current_week["first_day"],
    }
    for week in analysis["weeks"]:
        if week["first_day"] in covered_first_days:
            continue
        assert week["sales"] == 0
        assert week["expenses"] == 0
        assert week["profit"]["amount"] == 0
        assert week["cash"] == 0


def _entry(
    client: TestClient,
    variety_id: int,
    *,
    grams: str,
    on: str,
    origin: str = "opening_stock",
    total_cost: int | None = None,
) -> None:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": origin, "grams": grams, "date": on}
    if total_cost is not None:
        body["total_cost"] = total_cost
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text


def _sale(client: TestClient, variety_id: int, *, grams: str, on: str, gift: bool = False) -> None:
    response = client.post(
        "/sales",
        json={
            "date": on,
            "payment": "cash",
            "lines": [{"variety_id": variety_id, "grams": grams, "gift": gift}],
        },
    )
    assert response.status_code == 201, response.text


def _withdrawal(client: TestClient, variety_id: int, *, reason: str, grams: str, on: str) -> None:
    response = client.post(
        "/stock/withdrawals",
        json={"reason": reason, "date": on, "lines": [{"variety_id": variety_id, "grams": grams}]},
    )
    assert response.status_code == 201, response.text


def _adjust(client: TestClient, variety_id: int, *, grams: str, on: str) -> None:
    _entry(client, variety_id, grams=grams, on=on, origin="adjustment")


def _seed_cost_history(client: TestClient) -> None:
    """Weeks and months that each pin one case of the row's cost figures. The clock is
    Friday 2026-10-02, so the current week is 28/09-04/10. Every lot costs $100/g
    unless said otherwise; sale prices never matter to a cost figure.

    - 10/08 week: a harvest lot of 2 g with no cost, then a sale of 5 g: 2 g costed at
      $0 and 3 g pending (a $0 lot is not "entirely pending").
    - 17/08 week: a costed sale that empties the lot, then a -2 g adjustment: the
      shortfall alone is entirely pending.
    - 24/08 week: a sale of a variety with no lot at all: its cost is entirely pending.
    - 31/08 week: withdrawals only: cost of goods $0, their cost on their own lines.
    - 07/09 week: a costed -2 g adjustment, then a gift of 5 g from a lot with 3 g
      left: the gift's cost is partly pending while the shortfall is costed.
    - 14/09 week: a costed sale and a costed -2 g adjustment.
    - 21/09 week: a gift only.
    - 28/09 (current) week: a sale, a promotion, an own use, an adjustment and an
      expense; 01/10 and 02/10 also give October its own figures.
    """
    a = _variety_with_price(client, "A", 1_000)
    b = _variety_with_price(client, "B", 2_000)
    c = _variety_with_price(client, "C", 1_000)
    e = _variety_with_price(client, "E", 1_000)
    f = _variety_with_price(client, "F", 1_000)

    _entry(client, a, grams="100", on="2026-07-01", total_cost=10_000)

    _entry(client, f, grams="2", on="2026-08-10", origin="harvest")
    _sale(client, f, grams="5", on="2026-08-11")

    _entry(client, c, grams="5", on="2026-08-17", total_cost=500)
    _sale(client, c, grams="5", on="2026-08-18")
    _adjust(client, c, grams="-2", on="2026-08-19")

    _sale(client, b, grams="3", on="2026-08-25")

    _withdrawal(client, a, reason="own_use", grams="1", on="2026-09-01")
    _withdrawal(client, a, reason="promotion", grams="2", on="2026-09-02")

    _entry(client, e, grams="5", on="2026-09-07", total_cost=500)
    _adjust(client, e, grams="-2", on="2026-09-08")
    _sale(client, e, grams="5", on="2026-09-09", gift=True)

    _sale(client, a, grams="5", on="2026-09-15")
    _adjust(client, a, grams="-2", on="2026-09-16")

    _sale(client, a, grams="3", on="2026-09-22", gift=True)

    category = client.post("/expense-categories", json={"name": "Varios"}).json()
    _sale(client, a, grams="2", on="2026-09-29")
    _withdrawal(client, a, reason="promotion", grams="1", on="2026-09-30")
    _withdrawal(client, a, reason="own_use", grams="1", on="2026-10-01")
    _adjust(client, a, grams="-1", on="2026-10-01")
    expense = client.post(
        "/expenses",
        json={
            "spent_on": "2026-10-01",
            "category_id": category["id"],
            "amount": 800,
            "detail": "gasto",
        },
    )
    assert expense.status_code == 201, expense.text
    _sale(client, a, grams="1", on="2026-10-02")


def _cost(amount: int, pending_grams: float = 0.0, *, all_pending: bool = False) -> dict[str, Any]:
    return {"amount": amount, "pending_grams": pending_grams, "all_pending": all_pending}


def _rows(analysis: dict[str, Any], key: str, first_day: str) -> dict[str, Any]:
    return next(row for row in analysis[key] if row["first_day"] == first_day)


def _week(analysis: dict[str, Any], first_day: str) -> dict[str, Any]:
    return _rows(analysis, "weeks", first_day)


def _month_row(analysis: dict[str, Any], month: str) -> dict[str, Any]:
    return next(row for row in analysis["months"] if row["month"] == month)


def test_each_week_row_carries_its_cost_of_goods_and_shortfall_worked_out_by_hand(
    client: TestClient,
) -> None:
    _seed_cost_history(client)

    analysis = client.get("/analysis").json()

    # (cost of goods, shortfall) per week, by hand from `_seed_cost_history`'s lots.
    expected: dict[str, tuple[dict[str, Any], dict[str, Any] | None]] = {
        "2026-08-10": (_cost(0, 3.0), None),
        "2026-08-17": (_cost(500), _cost(0, 2.0, all_pending=True)),
        "2026-08-24": (_cost(0, 3.0, all_pending=True), None),
        "2026-08-31": (_cost(0), None),
        "2026-09-07": (_cost(300, 2.0), _cost(200)),
        "2026-09-14": (_cost(500), _cost(200)),
        "2026-09-21": (_cost(300), None),
        "2026-09-28": (_cost(300), _cost(100)),
    }
    assert [w["first_day"] for w in analysis["weeks"]] == list(expected)
    for week in analysis["weeks"]:
        cost_of_goods, shortfall = expected[week["first_day"]]
        assert week["cost_of_goods"] == cost_of_goods, week["first_day"]
        assert week["shortfall"] == shortfall, week["first_day"]


def test_each_month_row_carries_its_cost_of_goods_and_shortfall_worked_out_by_hand(
    client: TestClient,
) -> None:
    _seed_cost_history(client)

    analysis = client.get("/analysis").json()

    expected: dict[str, tuple[dict[str, Any], dict[str, Any] | None]] = {
        "2026-07": (_cost(0), None),
        "2026-08": (_cost(500, 6.0), _cost(0, 2.0, all_pending=True)),
        "2026-09": (_cost(1_300, 2.0), _cost(400)),
        "2026-10": (_cost(100), _cost(100)),
    }
    assert [m["month"] for m in analysis["months"]] == list(expected)
    for row in analysis["months"]:
        cost_of_goods, shortfall = expected[row["month"]]
        assert row["cost_of_goods"] == cost_of_goods, row["month"]
        assert row["shortfall"] == shortfall, row["month"]


def test_a_week_with_only_gifts_carries_their_cost_and_no_promotion(client: TestClient) -> None:
    _seed_cost_history(client)

    week = _week(client.get("/analysis").json(), "2026-09-21")

    assert week["sales"] == 0
    assert week["cost_of_goods"]["amount"] == 300
    assert week["promotion"] is None
    assert week["shortfall"] is None


def test_a_week_with_only_withdrawals_has_no_cost_of_goods_and_its_cost_on_its_own_lines(
    client: TestClient,
) -> None:
    _seed_cost_history(client)

    week = _week(client.get("/analysis").json(), "2026-08-31")

    assert week["cost_of_goods"] == _cost(0)
    assert week["promotion"] == _cost(200)
    assert week["own_use"] == _cost(100)
    assert week["shortfall"] is None


def test_a_period_with_no_draw_at_all_has_zero_cost_of_goods_and_no_shortfall(
    client: TestClient,
) -> None:
    _seed_cost_history(client)

    # July holds only the opening lot: no sale, withdrawal or adjustment.
    july = _month_row(client.get("/analysis").json(), "2026-07")

    assert july["cost_of_goods"] == _cost(0)
    assert july["shortfall"] is None


def test_the_shortfall_and_the_cost_of_goods_count_only_their_own_pending_grams(
    client: TestClient,
) -> None:
    _seed_cost_history(client)

    analysis = client.get("/analysis").json()

    # A pending shortfall while every sale is costed.
    shortfall_pending = _week(analysis, "2026-08-17")
    assert shortfall_pending["cost_of_goods"] == _cost(500)
    assert shortfall_pending["shortfall"] == _cost(0, 2.0, all_pending=True)
    # A pending gift while the shortfall is costed.
    gift_pending = _week(analysis, "2026-09-07")
    assert gift_pending["cost_of_goods"] == _cost(300, 2.0)
    assert gift_pending["shortfall"] == _cost(200)


def test_a_lot_with_no_cost_is_pending_only_for_the_grams_past_it_never_entirely_pending(
    client: TestClient,
) -> None:
    _seed_cost_history(client)

    analysis = client.get("/analysis").json()

    # 2 g from a $0 harvest lot (costed, at $0) and 3 g past it: $0 with pending grams,
    # yet not entirely pending.
    assert _week(analysis, "2026-08-10")["cost_of_goods"] == _cost(0, 3.0, all_pending=False)
    # A variety with no lot at all: nothing costed, entirely pending.
    assert _week(analysis, "2026-08-24")["cost_of_goods"] == _cost(0, 3.0, all_pending=True)


def test_every_week_and_month_row_adds_up_over_the_costed_part(client: TestClient) -> None:
    _seed_cost_history(client)

    analysis = client.get("/analysis").json()

    def lines(row: dict[str, Any]) -> int:
        total = row["cost_of_goods"]["amount"] + row["expenses"]
        for key in ("shortfall", "promotion", "own_use"):
            if row[key] is not None:
                total += row[key]["amount"]
        return int(total)

    # The sales of costed grams only (the rest of a pending line is not in Ganancia).
    costed_sales_by_week = {
        "2026-08-10": 2_000,
        "2026-08-17": 5_000,
        "2026-08-24": 0,
        "2026-08-31": 0,
        "2026-09-07": 0,
        "2026-09-14": 5_000,
        "2026-09-21": 0,
        "2026-09-28": 3_000,
    }
    for week in analysis["weeks"]:
        costed_sales = costed_sales_by_week[week["first_day"]]
        assert costed_sales - lines(week) == week["profit"]["amount"], week["first_day"]
    costed_sales_by_month = {"2026-07": 0, "2026-08": 7_000, "2026-09": 7_000, "2026-10": 1_000}
    for row in analysis["months"]:
        costed_sales = costed_sales_by_month[row["month"]]
        assert costed_sales - lines(row) == row["profit"]["amount"], row["month"]


def _assert_agrees_with_the_panel(row: dict[str, Any], figures: dict[str, Any]) -> None:
    assert row["cost_of_goods"]["amount"] == figures["cost_of_goods"]
    assert (row["cost_of_goods"]["pending_grams"] > 0) == figures["pending_cost"]
    if figures["shortfall"] is None:
        assert row["shortfall"] is None
    else:
        assert row["shortfall"]["amount"] == figures["shortfall"]["amount"]
        assert (row["shortfall"]["pending_grams"] > 0) == figures["shortfall"]["pending"]


def test_the_current_week_and_month_rows_equal_the_panel(client: TestClient) -> None:
    _seed_cost_history(client)

    panel = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()

    _assert_agrees_with_the_panel(analysis["weeks"][-1], panel["week"])
    _assert_agrees_with_the_panel(analysis["months"][-1], panel["month"])
    assert panel["week"]["shortfall"] == {"amount": 100, "pending": False}
    assert panel["month"]["cost_of_goods"] == 100


def test_the_current_rows_equal_the_panel_with_pending_grams_in_both_figures(
    client: TestClient,
) -> None:
    _seed_cost_history(client)
    never_stocked = _variety_with_price(client, "Sin lote", 1_000)
    _sale(client, never_stocked, grams="1", on="2026-10-02")
    # "C"'s lot was emptied on 2026-08-18: this adjustment draws nothing.
    c_id = next(v["id"] for v in client.get("/varieties").json() if v["name"] == "C")
    _adjust(client, c_id, grams="-1", on="2026-10-02")

    panel = client.get("/panel").json()["periods"]
    analysis = client.get("/analysis").json()

    assert panel["week"]["pending_cost"] is True
    assert panel["month"]["shortfall"] == {"amount": 100, "pending": True}
    _assert_agrees_with_the_panel(analysis["weeks"][-1], panel["week"])
    _assert_agrees_with_the_panel(analysis["months"][-1], panel["month"])


def _without_new_keys(body: Any) -> Any:
    """`body` as it was before GH-141: no `all_pending`, and no `cost_of_goods` or
    `shortfall` on a week or month row (the month header and the since-first-record
    block always had their own `shortfall`)."""
    if isinstance(body, list):
        return [_without_new_keys(item) for item in body]
    if not isinstance(body, dict):
        return body
    return {
        key: _without_new_keys(value)
        for key, value in body.items()
        if key != "all_pending"
        and not (key in ("cost_of_goods", "shortfall") and "first_day" in body)
    }


def test_no_field_that_existed_before_changes_value(client: TestClient) -> None:
    _seed_cost_history(client)
    before = json.loads(
        (Path(__file__).parent.parent / "fixtures" / "analysis_before_gh141.json").read_text()
    )

    after = client.get("/analysis").json()

    assert _without_new_keys(after) == before


def test_all_pending_is_the_domain_s_flag_on_the_header_the_block_and_a_variety_s_cost(
    client: TestClient,
) -> None:
    _seed_cost_history(client)

    august = client.get("/analysis", params={"month": "2026-08"}).json()

    # The header's shortfall is the month row's: one figure, two places.
    assert august["month"]["shortfall"] == _month_row(august, "2026-08")["shortfall"]
    assert august["month"]["shortfall"] == _cost(0, 2.0, all_pending=True)
    costs = {v["name"]: v["cost"] for v in august["month"]["varieties"]}
    assert costs["B"] == {"costed": 0, "pending_grams": 3.0, "all_pending": True}
    # F: 2 g from a $0 lot, 3 g past it: $0 and pending, but not entirely pending.
    assert costs["F"] == {"costed": 0, "pending_grams": 3.0, "all_pending": False}
    assert costs["C"] == {"costed": 500, "pending_grams": 0.0, "all_pending": False}
    since = august["since_first_record"]
    assert since["shortfall"] == _cost(500, 2.0)
    assert since["promotion"] == _cost(300)
    assert since["own_use"] == _cost(200)


def test_profit_and_the_margins_carry_no_all_pending_flag(client: TestClient) -> None:
    _seed_cost_history(client)

    analysis = client.get("/analysis").json()

    assert set(analysis["since_first_record"]["profit"]) == {"amount", "pending_grams"}
    assert set(analysis["month"]["average_margin"]) == {"amount", "percent", "pending_grams"}
    assert set(analysis["month"]["varieties"][0]["margin"]) == {
        "amount",
        "percent",
        "pending_grams",
    }
    for row in analysis["weeks"] + analysis["months"]:
        assert set(row["profit"]) == {"amount", "pending_grams"}
