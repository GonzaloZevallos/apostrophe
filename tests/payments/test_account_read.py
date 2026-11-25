"""`GET /api/customers/{id}/account`'s four added fields (GH-498 part 3): `age_days`,
`still_owing`, `sales_by_month` and `average_sale` — through `TestClient`, the real
adapters, `settle()` and `customer_sales()` underneath, on the movable clock."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import MovableClock

# tests/conftest.py's own today is 2026-10-02: the window is May to October 2026.
WINDOW = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]


def _variety(client: TestClient, price: int = 1_000) -> int:
    variety: dict[str, int] = client.post("/api/products", json={"name": "Variety"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": price},
    )
    return variety["id"]


def _customer(client: TestClient, name: str = "Customer", phone: str = "11 2000-0000") -> int:
    body: dict[str, int] = client.post(
        "/customers", json={"name": name, "phone": phone, "phone_country": "AR"}
    ).json()
    return body["id"]


def _sale(
    client: TestClient,
    customer_id: int,
    variety_id: int,
    *,
    on: str,
    quantity: str = "1",
    owing: bool = True,
    shipping: int = 0,
) -> dict[str, Any]:
    response = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": {"kind": "owing"} if owing else {"kind": "paid", "payment_method_id": 1},
            "date": on,
            "shipping_charged": shipping,
            "lines": [{"product_id": variety_id, "quantity": quantity}],
        },
    )
    assert response.status_code == 201, response.text
    sale: dict[str, Any] = response.json()
    return sale


def _pay(client: TestClient, customer_id: int, amount: int, on: str = "2026-10-01") -> None:
    response = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": on, "amount": amount, "payment_method_id": 1},
    )
    assert response.status_code == 201, response.text


def _account(client: TestClient, customer_id: int) -> dict[str, Any]:
    response = client.get(f"/customers/{customer_id}/account")
    assert response.status_code == 200, response.text
    account: dict[str, Any] = response.json()
    return account


def test_a_customer_who_owes_gets_the_oldest_debts_age_and_each_sale_oldest_first(
    client: TestClient,
) -> None:
    variety = _variety(client)
    customer = _customer(client)
    newer = _sale(client, customer, variety, on="2026-09-20", quantity="3")
    older = _sale(client, customer, variety, on="2026-09-10", quantity="2")

    account = _account(client, customer)

    assert account["age_days"] == 22  # 2026-09-10 to 2026-10-02
    assert account["still_owing"] == [
        {"sale_number": older["number"], "date": "2026-09-10", "remaining": 2_000},
        {"sale_number": newer["number"], "date": "2026-09-20", "remaining": 3_000},
    ]
    assert account["owing_since"] == "2026-09-10"


def test_a_part_paid_sale_shows_what_is_left_and_keeps_its_age(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    first = _sale(client, customer, variety, on="2026-09-01", quantity="10")
    second = _sale(client, customer, variety, on="2026-09-15", quantity="5")
    _pay(client, customer, 4_000, on="2026-09-20")

    account = _account(client, customer)

    assert account["age_days"] == 31  # the part-paid first sale keeps its own date
    assert account["still_owing"] == [
        {"sale_number": first["number"], "date": "2026-09-01", "remaining": 6_000},
        {"sale_number": second["number"], "date": "2026-09-15", "remaining": 5_000},
    ]


def test_the_remainders_add_up_to_the_balance(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _sale(client, customer, variety, on="2026-08-01", quantity="4", shipping=250)
    _sale(client, customer, variety, on="2026-09-01", quantity="7")
    _sale(client, customer, variety, on="2026-09-05", quantity="1", owing=False)
    _pay(client, customer, 5_555)

    account = _account(client, customer)

    assert account["balance"] > 0
    assert sum(line["remaining"] for line in account["still_owing"]) == account["balance"]
    assert all(line["remaining"] > 0 for line in account["still_owing"])


def test_a_sale_dated_today_has_age_zero(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _sale(client, customer, variety, on="2026-10-02")

    assert _account(client, customer)["age_days"] == 0


def test_a_customer_who_owes_nothing_has_no_age_and_no_lines(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _sale(client, customer, variety, on="2026-09-01", quantity="2")
    _pay(client, customer, 2_000)

    account = _account(client, customer)

    assert account["standing"] == "settled"
    assert account["age_days"] is None
    assert account["still_owing"] == []


def test_a_customer_with_a_credit_has_no_age_and_no_lines(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    sale = _sale(client, customer, variety, on="2026-09-01", quantity="2")
    _pay(client, customer, 2_000)
    assert client.delete(f"/sales/{sale['id']}").status_code == 200

    account = _account(client, customer)

    assert account["standing"] == "credit"
    assert account["balance"] == -2_000
    assert account["age_days"] is None
    assert account["still_owing"] == []


def test_the_age_follows_the_movable_clock(client: TestClient, clock: MovableClock) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _sale(client, customer, variety, on="2026-10-01")
    assert _account(client, customer)["age_days"] == 1

    clock.set(datetime(2026, 10, 12, 18, 0, tzinfo=UTC))

    assert _account(client, customer)["age_days"] == 11


def test_sales_by_month_and_the_average_match_the_sales_posted(
    client: TestClient, clock: MovableClock
) -> None:
    variety = _variety(client)
    customer = _customer(client)
    # A Sale cannot be posted in the future: post later-dated ones from a later day,
    # then read the account back on the earlier one.
    clock.set(datetime(2026, 11, 1, 12, 0, tzinfo=UTC))
    _sale(client, customer, variety, on="2026-04-30", quantity="9")  # before the window
    _sale(client, customer, variety, on="2026-05-01", quantity="1")
    _sale(client, customer, variety, on="2026-08-10", quantity="2", shipping=300)
    _sale(client, customer, variety, on="2026-10-02", quantity="1", owing=False)
    _sale(client, customer, variety, on="2026-10-20", quantity="1", shipping=40)
    _sale(client, customer, variety, on="2026-11-01", quantity="8")  # after the month
    clock.set(datetime(2026, 10, 2, 18, 0, tzinfo=UTC))

    account = _account(client, customer)

    assert account["sales_by_month"] == [
        {"month": "2026-05", "total": 1_000},
        {"month": "2026-06", "total": 0},
        {"month": "2026-07", "total": 0},
        {"month": "2026-08", "total": 2_300},
        {"month": "2026-09", "total": 0},
        {"month": "2026-10", "total": 2_040},
    ]
    assert account["average_sale"] == 1_335  # 5340 / 4 sales, shipping included


def test_the_average_rounds_half_up(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _sale(client, customer, variety, on="2026-10-01", quantity="1")
    _sale(client, customer, variety, on="2026-10-02", quantity="1", shipping=1)

    assert _account(client, customer)["average_sale"] == 1_001  # 1000.5 up


def test_a_customer_without_sales_in_the_window_has_six_zeros_and_no_average(
    client: TestClient,
) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _sale(client, customer, variety, on="2026-03-01", quantity="3")
    empty = _customer(client, "Nobody", "11 3000-0000")

    for customer_id in (customer, empty):
        account = _account(client, customer_id)
        assert [m["month"] for m in account["sales_by_month"]] == WINDOW
        assert [m["total"] for m in account["sales_by_month"]] == [0] * 6
        assert account["average_sale"] is None


def test_the_existing_fields_keep_their_shape(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _sale(client, customer, variety, on="2026-09-14", quantity="3")

    account = _account(client, customer)

    assert {"balance", "owing_since", "standing", "rows"} <= set(account)
    assert account["balance"] == 3_000
    assert account["owing_since"] == "2026-09-14"
    assert account["rows"][-1]["running_balance"] == account["balance"]
    assert len(account["rows"]) == 1
