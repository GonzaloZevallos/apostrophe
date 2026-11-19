"""GET /sales/suggestions at the HTTP seam (docs/product/sales.md, New sale suggestions):
the real adapters over a fresh in-memory SQLite. Ids only, ranked and capped by the read
itself; the window is the one Days left uses, `trailing_window`."""

from datetime import date, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.shared.calendar import DAYS_LEFT_WINDOW
from tests.conftest import TODAY
from tests.payment_body import payment_body

ON = TODAY


def _product(client: TestClient, name: str) -> int:
    product = client.post("/api/products", json={"name": name}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(product["id"])


def _customer(client: TestClient, name: str) -> int:
    phone = f"11 {abs(hash(name)) % 9000 + 1000}-{abs(hash(name[::-1])) % 9000 + 1000}"
    created = client.post("/customers", json={"name": name, "phone": phone, "phone_country": "AR"})
    assert created.status_code == 201, created.text
    return int(created.json()["id"])


def _sell(
    client: TestClient,
    product_id: int | None = None,
    *,
    quantity: str = "1",
    gift: bool = False,
    on: date = ON,
    customer_id: int | None = None,
    lines: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "payment": payment_body("cash", client),
        "date": on.isoformat(),
        "lines": lines
        if lines is not None
        else [{"product_id": product_id, "quantity": quantity, "gift": gift}],
    }
    if customer_id is not None:
        body["customer_id"] = customer_id
    if gift:
        body.pop("payment")
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    return dict(response.json())


def _read(client: TestClient, on: date = ON) -> dict[str, Any]:
    response = client.get("/sales/suggestions", params={"on": on.isoformat()})
    assert response.status_code == 200, response.text
    return dict(response.json())


def _days_ago(days: int) -> date:
    return ON - timedelta(days=days)


def test_an_empty_business_answers_empty_lists_and_null(client: TestClient) -> None:
    assert _read(client) == {
        "recent_customer_ids": [],
        "most_sold_product_ids": [],
        "last_payment_method_id": None,
    }


def test_a_date_far_in_the_past_still_answers(client: TestClient) -> None:
    assert _read(client, date(1, 1, 1))["most_sold_product_ids"] == []


def test_a_date_after_today_still_answers(client: TestClient) -> None:
    assert _read(client, _days_ago(-400))["recent_customer_ids"] == []


def test_the_answer_carries_ids_only(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    _sell(client, product, customer_id=_customer(client, "Fran"))

    assert set(_read(client)) == {
        "recent_customer_ids",
        "most_sold_product_ids",
        "last_payment_method_id",
    }


def test_the_last_method_is_answered_by_its_id(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    _sell(client, product)

    assert _read(client)["last_payment_method_id"] == 1


def test_an_archived_last_method_is_null_never_an_older_one(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    _sell(client, product)
    card = client.post("/api/payment-methods", json={"name": "Card", "icon": "card"}).json()
    client.post(
        "/sales",
        json={
            "payment": {"kind": "paid", "payment_method_id": card["id"]},
            "lines": [{"product_id": product, "quantity": "1"}],
        },
    )
    assert client.post(f"/api/payment-methods/{card['id']}/archive").status_code == 204

    assert _read(client)["last_payment_method_id"] is None


# Recent customers


def test_recent_customers_are_ranked_by_latest_sale_date_then_number(
    client: TestClient,
) -> None:
    product = _product(client, "Lavanda")
    first, second, third = (_customer(client, n) for n in ("Ana", "Beto", "Cleo"))
    _sell(client, product, customer_id=first, on=_days_ago(3))
    _sell(client, product, customer_id=second, on=_days_ago(1))
    _sell(client, product, customer_id=third, on=_days_ago(1))
    _sell(client, product, customer_id=first, on=_days_ago(2))

    assert _read(client)["recent_customer_ids"] == [third, second, first]


def test_a_late_entry_ranks_by_date_before_number(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    a, b = _customer(client, "Ana"), _customer(client, "Beto")
    _sell(client, product, customer_id=a, on=_days_ago(5))
    _sell(client, product, customer_id=b, on=_days_ago(5))
    _sell(client, product, customer_id=a, on=_days_ago(10))

    assert _read(client)["recent_customer_ids"] == [b, a]


def test_each_customer_appears_once(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    a = _customer(client, "Ana")
    for _ in range(3):
        _sell(client, product, customer_id=a)

    assert _read(client)["recent_customer_ids"] == [a]


def test_sales_without_a_customer_are_left_out(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    a = _customer(client, "Ana")
    _sell(client, product, customer_id=a, on=_days_ago(4))
    _sell(client, product)

    assert _read(client)["recent_customer_ids"] == [a]


def test_a_sale_given_a_customer_later_counts_for_that_customer(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    a, b = _customer(client, "Ana"), _customer(client, "Beto")
    _sell(client, product, customer_id=a, on=_days_ago(2))
    later = _sell(client, product, on=_days_ago(1))
    assigned = client.put(f"/sales/{later['id']}/customer", json={"customer_id": b})
    assert assigned.status_code == 200, assigned.text

    assert _read(client)["recent_customer_ids"] == [b, a]


def test_recent_customers_ignore_the_date_asked_for(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    a = _customer(client, "Ana")
    _sell(client, product, customer_id=a, on=_days_ago(100))

    assert _read(client, _days_ago(60))["recent_customer_ids"] == [a]


def test_recent_customers_are_capped_at_eight(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    customers = [_customer(client, f"Cliente {n}") for n in range(9)]
    for n, customer in enumerate(customers):
        _sell(client, product, customer_id=customer, on=_days_ago(20 - n))

    assert _read(client)["recent_customer_ids"] == list(reversed(customers))[:8]


# Most sold


def test_most_sold_ranks_by_quantity_then_the_name_ignoring_case(client: TestClient) -> None:
    banana = _product(client, "Banana")
    apple = _product(client, "apple")
    heavy = _product(client, "Zumo")
    _sell(client, banana, quantity="2")
    _sell(client, apple, quantity="2")
    _sell(client, heavy, quantity="5")

    assert _read(client)["most_sold_product_ids"] == [heavy, apple, banana]


def test_ties_ignore_case_but_not_accents(client: TestClient) -> None:
    arbol = _product(client, "Árbol")
    zeta = _product(client, "Zeta")
    nandu_accent = _product(client, "Ñandú")
    nandu = _product(client, "ñandu")
    for product in (arbol, zeta, nandu_accent, nandu):
        _sell(client, product, quantity="3")

    # The stored key casefolds only: "zeta" < "árbol", "ñandu" < "ñandú".
    assert _read(client)["most_sold_product_ids"] == [zeta, arbol, nandu, nandu_accent]


def test_quantities_add_up_across_sales(client: TestClient) -> None:
    small, big = _product(client, "Aloe"), _product(client, "Boldo")
    _sell(client, small, quantity="1")
    _sell(client, big, quantity="1")
    _sell(client, big, quantity="1.5")

    assert _read(client)["most_sold_product_ids"] == [big, small]


def test_gift_lines_are_left_out(client: TestClient) -> None:
    gifted, sold = _product(client, "Regalo"), _product(client, "Vendido")
    _sell(client, gifted, quantity="9", gift=True)
    _sell(client, sold, quantity="1")

    assert _read(client)["most_sold_product_ids"] == [sold]


def test_a_gift_line_does_not_add_to_a_sold_one(client: TestClient) -> None:
    mostly_gifted, other = _product(client, "Aloe"), _product(client, "Boldo")
    _sell(
        client,
        lines=[
            {"product_id": mostly_gifted, "quantity": "1"},
            {"product_id": mostly_gifted, "quantity": "9", "gift": True},
        ],
    )
    _sell(client, other, quantity="2")

    assert _read(client)["most_sold_product_ids"] == [other, mostly_gifted]


def test_archived_products_are_left_out_and_hidden_ones_stay(client: TestClient) -> None:
    archived, hidden, shown = (_product(client, n) for n in ("Archivado", "Oculto", "Visible"))
    for product in (archived, hidden, shown):
        _sell(client, product, quantity="2")
    assert client.post(f"/api/products/{archived}/archive").status_code == 200
    hide = client.put(
        f"/catalog/products/{hidden}",
        json={"shown": False, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert hide.status_code == 200, hide.text

    assert _read(client)["most_sold_product_ids"] == [hidden, shown]


def test_a_product_with_nothing_sold_is_left_out(client: TestClient) -> None:
    _product(client, "Sin ventas")
    only_gifted = _product(client, "Solo regalo")
    sold = _product(client, "Vendido")
    _sell(client, only_gifted, gift=True)
    _sell(client, sold)

    assert _read(client)["most_sold_product_ids"] == [sold]


def test_the_window_includes_on_and_29_days_before_and_not_30(client: TestClient) -> None:
    edge_in, edge_out, today_in = (_product(client, n) for n in ("Borde", "Fuera", "Hoy"))
    _sell(client, edge_in, on=_days_ago(DAYS_LEFT_WINDOW - 1))
    _sell(client, edge_out, on=_days_ago(DAYS_LEFT_WINDOW))
    _sell(client, today_in, on=ON)

    assert _read(client)["most_sold_product_ids"] == [edge_in, today_in]


def test_the_window_moves_with_the_date_asked_for(client: TestClient) -> None:
    product = _product(client, "Lavanda")
    _sell(client, product, on=_days_ago(40))

    assert _read(client)["most_sold_product_ids"] == []
    assert _read(client, _days_ago(40))["most_sold_product_ids"] == [product]


def test_most_sold_is_capped_at_eight(client: TestClient) -> None:
    products = [_product(client, f"Producto {n}") for n in range(9)]
    for n, product in enumerate(products):
        _sell(client, product, quantity=str(n + 1))

    assert _read(client)["most_sold_product_ids"] == list(reversed(products))[:8]


# The request


@pytest.mark.parametrize("on", ["20261119", "2026-1-5", "2026-13-01", "2026-02-30", "", "abc"])
def test_a_malformed_date_is_a_request_invalid(client: TestClient, on: str) -> None:
    response = client.get("/sales/suggestions", params={"on": on})

    assert response.status_code == 422
    assert response.json()["code"] == "RequestInvalid"
    if on:
        assert on not in response.text


def test_a_missing_date_is_a_request_invalid(client: TestClient) -> None:
    response = client.get("/sales/suggestions")

    assert response.status_code == 422
    assert response.json()["code"] == "RequestInvalid"


def test_a_limit_parameter_changes_nothing(client: TestClient) -> None:
    products = [_product(client, f"Producto {n}") for n in range(9)]
    for product in products:
        _sell(client, product)

    response = client.get("/sales/suggestions", params={"on": ON.isoformat(), "limit": 2})

    assert len(response.json()["most_sold_product_ids"]) == 8


def test_another_business_never_shows_up(client: TestClient, other_client: TestClient) -> None:
    product = _product(other_client, "Ajeno")
    _sell(other_client, product, customer_id=_customer(other_client, "Ajena"))

    assert _read(client) == {
        "recent_customer_ids": [],
        "most_sold_product_ids": [],
        "last_payment_method_id": None,
    }
