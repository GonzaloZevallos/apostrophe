"""`GET /analysis` end to end (CODING_STANDARDS §5): a fresh in-memory SQLite per
test, the real adapters, the movable clock. Seeds only through the API."""

from fastapi.testclient import TestClient

from tests.conftest import TODAY


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
    category = client.post("/expense-categories", json={"name": "Transporte"}).json()
    client.post(
        "/expenses",
        json={
            "spent_on": TODAY.isoformat(),
            "category_id": category["id"],
            "amount": 1_500,
            "detail": "flete",
        },
    )

    expenses = client.get("/expenses").json()
    analysis = client.get("/analysis").json()

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


def test_a_backdated_stock_entry_moves_past_week_and_variety_cost_on_the_next_read(
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

    before = client.get("/analysis", params={"month": "2026-10"}).json()
    [variety_before] = before["month"]["varieties"]
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

    after = client.get("/analysis", params={"month": "2026-10"}).json()
    [variety_after] = after["month"]["varieties"]
    assert variety_after["cost"]["costed"] < variety_before["cost"]["costed"]


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
