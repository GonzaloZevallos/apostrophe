"""`GET /analysis` end to end (CODING_STANDARDS §5): a fresh in-memory SQLite per
test, the real adapters, the movable clock. Seeds only through the API."""

from datetime import UTC, datetime, timedelta
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
    current_week_before = next(
        w for w in before_october["weeks"] if w["last_day"] >= sale["date"]
    )
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
