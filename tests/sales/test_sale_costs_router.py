"""`GET /sales/{id}`'s own cost-of-goods shape (ADR-0009, CODING_STANDARDS section 5):
each line's `cost` is allocated fresh from stock's lots, through the `LineCosts` port
wired in `app/main.py` onto `app.state.line_costs`. The list route (`SaleOut`) never
carries this field and never allocates; that stays covered by `test_sales_router.py`.
"""

from typing import Any

from fastapi.testclient import TestClient

from tests.contract_shapes import assert_matches_fixture


def _variety(client: TestClient, list_price: int = 10_000) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return int(variety["id"])


def _entry(client: TestClient, variety_id: int, **overrides: Any) -> None:
    body: dict[str, Any] = {"product_id": variety_id, "origin": "purchase", "quantity": "5"}
    body.update(overrides)
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text


def _sale(client: TestClient, variety_id: int, quantity: str = "10") -> int:
    response = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": quantity}]},
    )
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


def test_a_fully_costed_line_answers_its_cost_and_no_pending_grams(
    client: TestClient,
) -> None:
    variety_id = _variety(client)
    _entry(client, variety_id, quantity="10", total_cost=5_000)

    sale_id = _sale(client, variety_id)

    response = client.get(f"/sales/{sale_id}")

    assert response.status_code == 200, response.text
    assert response.json()["lines"] == [
        {
            "product_id": variety_id,
            "product_name": "Lavanda",
            "quantity": 10.0,
            "pricing_rule": "list",
            "price_per_gram": 10_000,
            "line_total": 100_000,
            "cost": {"costed": 5_000, "pending_quantity": 0.0},
        }
    ]


def test_a_line_with_no_lot_behind_it_is_entirely_pending_never_a_zero_cost(
    client: TestClient,
) -> None:
    """Enforcement seam: `LineCost.costed` must stay `None`, never `0`, when nothing of
    the draw is costed (a stock invariant this route must not paper over)."""
    variety_id = _variety(client)

    sale_id = _sale(client, variety_id)

    response = client.get(f"/sales/{sale_id}")

    cost = response.json()["lines"][0]["cost"]
    assert cost == {"costed": None, "pending_quantity": 10.0}


def test_a_gift_line_with_no_lot_behind_it_matches_the_gift_fixture(client: TestClient) -> None:
    """`sale-detail-gift` (plan step 5): no customer, and a gift line on a variety
    with no stock entry at all, so its cost is entirely pending — `costed` must stay
    `None`, never folded to `0`, and nothing here is ever left owing (a gift line
    prices at $0, so the sale's own total is $0 and needs no payment method)."""
    variety_id = _variety(client)  # priced, but no stock entry recorded at all

    sale = client.post(
        "/sales",
        json={"lines": [{"product_id": variety_id, "quantity": "5", "gift": True}]},
    )
    assert sale.status_code == 201, sale.text
    sale_id = sale.json()["id"]

    detail = client.get(f"/sales/{sale_id}")

    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["customer"] is None
    assert body["lines"][0]["cost"]["costed"] is None
    assert_matches_fixture(body, "sale-detail-gift")


def test_list_sales_never_carries_a_cost_field(client: TestClient) -> None:
    variety_id = _variety(client)
    _entry(client, variety_id, quantity="10", total_cost=5_000)
    client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    )

    listed = client.get("/sales")

    assert listed.status_code == 200
    assert "cost" not in listed.json()[0]["lines"][0]


def test_sale_detail_answers_total_grams_summed_over_every_line_gifts_included(
    client: TestClient,
) -> None:
    """Left over from #20 (sales.md): the delete confirmation and Deshacer name the
    grams returning to stock, from this field — never added up in the browser."""
    variety_id = _variety(client)
    _entry(client, variety_id, quantity="20", total_cost=5_000)

    response = client.post(
        "/sales",
        json={
            "payment": "cash",
            "lines": [
                {"product_id": variety_id, "quantity": "10"},
                {"product_id": variety_id, "quantity": "4", "gift": True},
            ],
        },
    )
    assert response.status_code == 201, response.text
    sale_id = response.json()["id"]

    detail = client.get(f"/sales/{sale_id}")

    assert detail.status_code == 200, detail.text
    assert detail.json()["total_quantity"] == 14.0


def test_recording_a_later_entry_moves_the_cost_the_next_time_it_is_read(
    client: TestClient,
) -> None:
    """ADR-0009: never frozen. The sale is read once with no lot behind it (pending),
    then again after a lot is recorded, and the second read reflects it without
    touching the sale's own price, total or payment."""
    variety_id = _variety(client)
    sale_id = _sale(client, variety_id)
    before = client.get(f"/sales/{sale_id}").json()
    assert before["lines"][0]["cost"] == {"costed": None, "pending_quantity": 10.0}

    _entry(client, variety_id, quantity="10", total_cost=4_000)

    after = client.get(f"/sales/{sale_id}").json()
    assert after["lines"][0]["cost"] == {"costed": 4_000, "pending_quantity": 0.0}
    assert after["total"] == before["total"]
    assert after["lines"][0]["price_per_gram"] == before["lines"][0]["price_per_gram"]


def test_a_sale_detail_carries_still_owing_from_settlement(client: TestClient) -> None:
    """`GET /sales/{id}` answers `still_owing` the same way the list route does (the
    plan's `balances-wiring` brief): both read it from `OwingSales`, never a local
    comparison. `total_grams` (`sale-grams`) and `still_owing` (`balances-wiring`) land
    on separate subtask branches, so neither alone can run `assert_matches_fixture(…,
    "sale-detail")`: integration (`payments-e2e`) runs it here, now that both fields are
    on this merged branch (Tech Lead finding, plan scope, `test_sale_costs_router.py:90`
    and `:109`)."""
    variety_id = _variety(client)
    customer = client.post("/customers", json={"name": "Juana", "phone": "11 2345-6789"}).json()

    owing = client.post(
        "/sales",
        json={
            "customer_id": customer["id"],
            "payment": "owing",
            "lines": [{"product_id": variety_id, "quantity": "1"}],
        },
    ).json()
    paid = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "1"}]},
    ).json()

    owing_detail = client.get(f"/sales/{owing['id']}").json()
    paid_detail = client.get(f"/sales/{paid['id']}").json()
    assert owing_detail["still_owing"] is True
    assert paid_detail["still_owing"] is False
    assert_matches_fixture(owing_detail, "sale-detail")
    assert_matches_fixture(paid_detail, "sale-detail")
