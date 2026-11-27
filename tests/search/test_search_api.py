"""`GET /search` through `TestClient`, over a real database, at both money scales."""

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import MovableClock

EMPTY: dict[str, list[Any]] = {"sales": [], "customers": [], "products": []}


def _customer(client: TestClient, name: str, phone: str | None = None) -> int:
    body: dict[str, Any] = {"name": name}
    if phone is not None:
        body.update(phone=phone, phone_country="AR")
    response = client.post("/customers", json=body)
    assert response.status_code == 201, response.text
    customer_id: int = response.json()["id"]
    return customer_id


def _product(client: TestClient, name: str, price: float | None = None) -> int:
    response = client.post("/api/products", json={"name": name})
    assert response.status_code == 201, response.text
    product_id: int = response.json()["id"]
    if price is not None:
        priced = client.post(
            f"/api/products/{product_id}/prices",
            json={"effective_from": "2026-01-01", "list_price": price},
        )
        assert priced.status_code == 201, priced.text
    return product_id


def _entry(client: TestClient, product_id: int, quantity: str, **extra: Any) -> None:
    body = {"product_id": product_id, "origin": "opening_stock", "quantity": quantity, **extra}
    response = client.post("/stock/entries", json=body)
    assert response.status_code == 201, response.text


def _search(client: TestClient, q: str | None = None) -> dict[str, Any]:
    response = client.get("/search", params=None if q is None else {"q": q})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def _names(hits: list[dict[str, Any]]) -> list[str]:
    return [hit["name"] for hit in hits]


def _owing_sale(client: TestClient, customer_id: int, product_id: int, quantity: str) -> int:
    response = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": {"kind": "owing"},
            "lines": [{"product_id": product_id, "quantity": quantity}],
        },
    )
    assert response.status_code == 201, response.text
    sale_id: int = response.json()["id"]
    return sale_id


def _credit(client: TestClient, customer_id: int, owed: float, overpaid_by: float) -> None:
    """A Credit is made the way a ledger makes one: pay two sales, then delete the second."""
    first = _owing_sale(client, customer_id, _product(client, "Primero", owed), "1")
    second = _owing_sale(client, customer_id, _product(client, "Segundo", overpaid_by), "1")
    _pay(client, customer_id, owed + overpaid_by)
    assert first != second
    assert client.delete(f"/sales/{second}").status_code == 200


def _pay(client: TestClient, customer_id: int, amount: float) -> None:
    response = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-10-02", "amount": amount, "payment_method_id": 1},
    )
    assert response.status_code == 201, response.text


def _balance_in_customers(client: TestClient, customer_id: int) -> Any:
    return client.get(f"/customers/{customer_id}").json()["balance"]


def _balance_in_search(client: TestClient, q: str) -> Any:
    [hit] = _search(client, q)["customers"]
    return hit["balance"]


def test_a_customer_is_found_by_case_accents_and_part_of_a_word(client: TestClient) -> None:
    _customer(client, "María Ángeles")
    _customer(client, "Pedro Gómez")

    for q in ("maria", "MARÍA", "ngel", "angeles", "  maria  "):
        assert _names(_search(client, q)["customers"]) == ["María Ángeles"]
    assert _search(client, "zzz") == EMPTY


def test_a_customer_is_found_by_phone_digits(client: TestClient) -> None:
    customer_id = _customer(client, "Fran Araujo", "11 2345-6789")
    _customer(client, "Otra Persona", "11 9999-0000")

    hits = _search(client, "2345")["customers"]

    assert [hit["id"] for hit in hits] == [customer_id]


@pytest.mark.parametrize("q", ["#7", "7x"])
def test_a_two_character_query_with_one_digit_finds_a_customer_by_that_phone_digit(
    client: TestClient, q: str
) -> None:
    """Through `Customer.matches`, the PRD's same-query rule: search adds no phone rule."""
    with_digit = _customer(client, "Sin Numero En El Nombre", "11 2345-6789")
    _customer(client, "Otra Persona", "11 2222-0000")

    assert [hit["id"] for hit in _search(client, q)["customers"]] == [with_digit]


def test_a_product_is_found_by_case_accents_and_part_of_a_word(client: TestClient) -> None:
    _product(client, "Lavanda Fina", 1_000)
    _product(client, "Café Tostado", 1_000)

    for q in ("lavan", "LAVANDA", "  lavan  "):
        assert _names(_search(client, q)["products"]) == ["Lavanda Fina"]
    assert _names(_search(client, "cafe")["products"]) == ["Café Tostado"]


def test_both_groups_hold_at_most_five_hits_ordered_starts_with_then_name_then_id(
    client: TestClient,
) -> None:
    names = ("Zeta ana", "Ana Zeta", "Bana", "ana", "Ánaa", "Cana", "Dana")
    for name in names:
        _customer(client, name)
        _product(client, name)
    # Customers may share a name; products may not, so the id decides only among customers.
    twins = [_customer(client, "Ana Zeta"), _customer(client, "Ana Zeta")]

    found = _search(client, "ana")

    assert _names(found["products"]) == ["ana", "Ana Zeta", "Ánaa", "Bana", "Cana"]
    assert _names(found["customers"]) == ["ana", "Ana Zeta", "Ana Zeta", "Ana Zeta", "Ánaa"]
    twin_ids = [hit["id"] for hit in found["customers"] if hit["name"] == "Ana Zeta"]
    assert twin_ids == sorted(twin_ids) and set(twins) <= set(twin_ids)


def test_a_search_is_the_same_with_and_without_padding_in_both_groups(client: TestClient) -> None:
    _customer(client, "Ana Perez")
    _product(client, "Ana Flor")

    assert _search(client, "  ana  ") == _search(client, "ana")
    assert _search(client, "ana")["customers"] != []
    assert _search(client, "ana")["products"] != []


def test_archived_products_are_left_out(client: TestClient) -> None:
    kept = _product(client, "Menta Fresca", 1_000)
    archived = _product(client, "Menta Vieja", 1_000)
    assert client.post(f"/api/products/{archived}/archive").status_code == 200

    assert [hit["id"] for hit in _search(client, "menta")["products"]] == [kept]


def test_hidden_unpriced_zero_and_negative_stock_products_are_found_with_their_stock(
    client: TestClient,
) -> None:
    hidden = _product(client, "Rosa Oculta", 1_000)
    shown = client.put(
        f"/catalog/products/{hidden}",
        json={"shown": False, "emoji": None, "indica_share": None, "aroma": None},
    )
    assert shown.status_code == 200, shown.text
    _entry(client, hidden, "7")
    unpriced = _product(client, "Rosa Sin Precio")
    zero = _product(client, "Rosa Cero", 1_000)
    _entry(client, zero, "4")
    withdrawal = client.post(
        "/stock/withdrawals",
        json={"reason_id": 1, "lines": [{"product_id": zero, "quantity": "4"}]},
    )
    assert withdrawal.status_code == 201, withdrawal.text
    negative = _product(client, "Rosa Negativa", 1_000)
    adjustment = client.post(
        "/stock/entries",
        json={"product_id": negative, "origin": "adjustment", "quantity": "-3"},
    )
    assert adjustment.status_code == 201, adjustment.text

    by_id = {hit["id"]: hit for hit in _search(client, "rosa")["products"]}

    assert set(by_id) == {hidden, unpriced, zero, negative}
    assert by_id[hidden]["quantity"] == 7
    assert by_id[unpriced]["quantity"] == 0
    assert by_id[zero]["quantity"] == 0
    assert by_id[negative]["quantity"] == -3
    assert set(by_id[hidden]) == {"id", "name", "quantity"}


def test_a_customer_with_no_sales_reads_as_the_customers_route_does(client: TestClient) -> None:
    customer_id = _customer(client, "Nadie Debe")

    assert _balance_in_search(client, "nadie") == _balance_in_customers(client, customer_id) == 0


def test_a_customer_who_owes_reads_as_the_customers_route_does(client: TestClient) -> None:
    customer_id = _customer(client, "Debe Mucho")
    _owing_sale(client, customer_id, _product(client, "Algo", 11_000), "1")

    assert _balance_in_search(client, "debe") == _balance_in_customers(client, customer_id)
    assert _balance_in_search(client, "debe") == 11_000


def test_a_credit_stays_below_zero_as_the_customers_route_reads_it(client: TestClient) -> None:
    customer_id = _customer(client, "Tiene Credito")
    _credit(client, customer_id, 11_000, 1_000)

    assert _balance_in_search(client, "credito") == _balance_in_customers(client, customer_id)
    assert _balance_in_search(client, "credito") == -1_000


def test_a_credit_with_two_decimals_reads_as_the_customers_route_reads_it(
    client: TestClient, money_scale: int
) -> None:
    if money_scale != 2:
        pytest.skip("only a business that stores hundredths can hold cents")
    saved = client.put("/api/money-format", json={"symbol": "$", "decimals": 2})
    assert saved.status_code == 200, saved.text
    customer_id = _customer(client, "Tiene Centavos")
    _credit(client, customer_id, 10_000, 2.5)

    assert _balance_in_customers(client, customer_id) == -2.5
    assert _balance_in_search(client, "centavos") == -2.5


def test_a_balance_at_decimals_zero_is_in_whole_units_at_either_scale(client: TestClient) -> None:
    """At scale 2 with decimals 0 (a new business) `Money(int)` would answer 100 times
    too small; the domain int goes through `MoneyOut` once instead."""
    customer_id = _customer(client, "Ocho Mil")
    _owing_sale(client, customer_id, _product(client, "Algo", 8_000), "1")

    assert _balance_in_search(client, "ocho") == _balance_in_customers(client, customer_id) == 8_000


@pytest.mark.parametrize("q", [None, "", "a", "#", " a ", "x" * 201, f"  {'x' * 201}  "])
def test_a_missing_or_short_or_too_long_query_answers_three_empty_lists(
    client: TestClient, q: str | None
) -> None:
    _customer(client, "x" * 60)
    _product(client, "a" * 40)

    assert _search(client, q) == EMPTY


def test_a_query_of_two_hundred_characters_is_searched_even_padded_with_spaces(
    client: TestClient,
) -> None:
    """Only the digit can match here (through `Customer.matches`), so a hit proves the
    query was searched, and the 201-character one answering nothing proves the cap."""
    customer_id = _customer(client, "Fran Araujo", "11 2345-6789")
    searched = "1" + "x" * 199
    too_long = "1" + "x" * 200

    for q in (searched, f"  {searched}  "):
        assert [h["id"] for h in _search(client, q)["customers"]] == [customer_id]
    for q in (too_long, f"  {too_long}  "):
        assert _search(client, q) == EMPTY


def test_a_repeated_q_binds_the_last_value(client: TestClient) -> None:
    _customer(client, "Cd Persona")
    _customer(client, "Ab Persona")

    repeated = client.get("/search?q=ab&q=cd")

    assert repeated.status_code == 200
    assert repeated.json() == _search(client, "cd")
    assert _names(repeated.json()["customers"]) == ["Cd Persona"]


@pytest.mark.parametrize(
    "instant",
    [datetime(2026, 10, 3, 2, 59, tzinfo=UTC), datetime(2026, 10, 3, 3, 0, tzinfo=UTC)],
    ids=["just-before-argentina-midnight", "just-after-argentina-midnight"],
)
def test_the_quantity_is_the_one_stock_gives_around_argentina_midnight(
    client: TestClient, clock: MovableClock, instant: datetime
) -> None:
    product_id = _product(client, "Hierba Medianoche", 1_000)
    _entry(client, product_id, "10", date="2026-10-02")
    withdrawal = client.post(
        "/stock/withdrawals",
        json={
            "reason_id": 1,
            "date": "2026-10-01",
            "lines": [{"product_id": product_id, "quantity": "2.5"}],
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text
    clock.set(instant)

    [hit] = _search(client, "medianoche")["products"]
    stock = next(
        p for p in client.get("/stock").json()["products"] if p["product_id"] == product_id
    )

    assert hit["quantity"] == stock["quantity"] == 7.5


def test_the_other_business_lookalikes_are_never_returned(
    client: TestClient, other_client: TestClient
) -> None:
    other_customer = _customer(other_client, "Fran Araujo", "11 2345-6789")
    other_product = _product(other_client, "Lavanda Fina", 1_000)
    assert _search(client, "fran") == EMPTY
    assert _search(client, "2345") == EMPTY
    assert _search(client, "lavanda") == EMPTY

    own_customer = _customer(client, "Fran Araujo", "11 2345-6789")
    own_product = _product(client, "Lavanda Fina", 1_000)

    assert [h["id"] for h in _search(client, "fran")["customers"]] == [own_customer]
    assert [h["id"] for h in _search(client, "2345")["customers"]] == [own_customer]
    assert [h["id"] for h in _search(client, "lavanda")["products"]] == [own_product]
    assert [h["id"] for h in _search(other_client, "fran")["customers"]] == [other_customer]
    assert [h["id"] for h in _search(other_client, "lavanda")["products"]] == [other_product]
