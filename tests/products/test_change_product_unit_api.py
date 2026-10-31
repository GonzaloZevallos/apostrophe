"""Changing a product's unit through `PATCH /api/products/{id}` with a `unit_id`: allowed
only while the product has no history and no bulk minimum or threshold finer than the new
unit (docs/product/units.md). Every refusal writes nothing and repeats nothing typed."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from tests.fakes.archive import archive_by_hand
from tests.pricing_switches import set_switches

BUSINESS_NAME = "Primer Negocio"


def _business_id(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(
            connection.execute(
                text("SELECT id FROM business WHERE name = :n"), {"n": BUSINESS_NAME}
            ).scalar_one()
        )


def _add_unit(engine: Engine, business_id: int, name: str, decimals: int) -> int:
    with engine.begin() as connection:
        result = connection.execute(
            text(
                "INSERT INTO unit (business_id, name, name_key, label, decimals) "
                "VALUES (:b, :n, :n, 'x', :d)"
            ),
            {"b": business_id, "n": name, "d": decimals},
        )
        return int(result.lastrowid)


@pytest.fixture
def whole(client: TestClient, engine: Engine) -> int:
    """A unit with no decimals."""
    return _add_unit(engine, _business_id(engine), "pieces", 0)


@pytest.fixture
def fine(client: TestClient, engine: Engine) -> int:
    """A unit with two decimals."""
    return _add_unit(engine, _business_id(engine), "kilos", 2)


@pytest.fixture
def bulk_pricing(client: TestClient, engine: Engine) -> None:
    """Bulk pricing on, so a price entry keeps its bulk minimum."""
    set_switches(engine, bulk=True, vip=False)


def _product(client: TestClient, unit_id: int, name: str = "Gold") -> int:
    response = client.post("/api/products", json={"name": name, "unit_id": unit_id})
    assert response.status_code == 201, response.text
    product_id: int = response.json()["id"]
    return product_id


def _change(client: TestClient, product_id: int, unit_id: int) -> Any:
    return client.patch(f"/api/products/{product_id}", json={"unit_id": unit_id})


def _unit_of(client: TestClient, product_id: int) -> int:
    unit_id: int = client.get(f"/api/products/{product_id}").json()["unit"]["id"]
    return unit_id


def _price(client: TestClient, product_id: int, bulk_minimum: str | None = None) -> None:
    body: dict[str, Any] = {"effective_from": "2026-01-01", "list_price": 10_000}
    if bulk_minimum is not None:
        body |= {"bulk_price": 8_000, "bulk_minimum": bulk_minimum}
    response = client.post(f"/api/products/{product_id}/prices", json=body)
    assert response.status_code == 201, response.text


def _sale(client: TestClient, product_id: int) -> None:
    _price(client, product_id)
    body = {"lines": [{"product_id": product_id, "quantity": "1"}], "payment": "cash"}
    assert client.post("/sales", json=body).status_code == 201


def _entry(client: TestClient, product_id: int) -> None:
    body = {"product_id": product_id, "origin": "harvest", "quantity": "10"}
    assert client.post("/stock/entries", json=body).status_code == 201


def _withdrawal(client: TestClient, product_id: int) -> None:
    body = {"reason": "own_use", "lines": [{"product_id": product_id, "quantity": "1"}]}
    assert client.post("/stock/withdrawals", json=body).status_code == 201


HISTORY: dict[str, Callable[[TestClient, int], None]] = {
    "sale line": _sale,
    "stock entry": _entry,
    "withdrawal line": _withdrawal,
}


def test_a_product_with_only_compatible_price_entries_changes_unit(
    client: TestClient, fine: int, whole: int, bulk_pricing: None
) -> None:
    product_id = _product(client, fine)
    _price(client, product_id, bulk_minimum="5")

    response = _change(client, product_id, whole)

    assert response.status_code == 200, response.text
    assert client.get(f"/api/products/{product_id}/prices").json()[0]["bulk_minimum"] == 5
    assert response.json()["unit"]["id"] == whole
    assert response.json()["unit"]["name"] == "pieces"
    assert _unit_of(client, product_id) == whole


def test_changing_to_the_unit_it_already_has_is_not_a_change_and_is_never_refused(
    client: TestClient, fine: int
) -> None:
    product_id = _product(client, fine)
    _entry(client, product_id)

    response = _change(client, product_id, fine)

    assert response.status_code == 200, response.text
    assert _unit_of(client, product_id) == fine


@pytest.mark.parametrize("source", list(HISTORY))
def test_each_source_of_history_alone_locks_the_unit(
    client: TestClient, fine: int, whole: int, source: str
) -> None:
    product_id = _product(client, fine, name="Secret Name")
    HISTORY[source](client, product_id)

    response = _change(client, product_id, whole)

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "product.unit_locked"
    assert "Secret" not in response.text and "pieces" not in response.text
    assert _unit_of(client, product_id) == fine


def test_a_bulk_minimum_finer_than_the_new_unit_refuses_the_change(
    client: TestClient, fine: int, whole: int, bulk_pricing: None
) -> None:
    product_id = _product(client, fine)
    _price(client, product_id, bulk_minimum="2.5")

    response = _change(client, product_id, whole)

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "product.unit_decimals_in_use"
    assert "2.5" not in response.text
    assert _unit_of(client, product_id) == fine


def test_a_threshold_finer_than_the_new_unit_refuses_the_change(
    client: TestClient, fine: int, whole: int
) -> None:
    product_id = _product(client, fine)
    put = client.put(f"/stock/products/{product_id}/threshold", json={"quantity": "2.5"})
    assert put.status_code == 200, put.text

    response = _change(client, product_id, whole)

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "product.unit_decimals_in_use"
    assert _unit_of(client, product_id) == fine


def test_a_threshold_the_new_unit_admits_does_not_refuse_the_change(
    client: TestClient, fine: int, whole: int
) -> None:
    product_id = _product(client, fine)
    client.put(f"/stock/products/{product_id}/threshold", json={"quantity": "3"})

    assert _change(client, product_id, whole).status_code == 200


def test_another_businesss_unit_answers_unit_not_found_and_changes_nothing(
    client: TestClient, other_client: TestClient, engine: Engine, fine: int
) -> None:
    with engine.connect() as connection:
        other = int(
            connection.execute(
                text("SELECT id FROM business WHERE name = 'Otro Negocio'")
            ).scalar_one()
        )
    foreign = _add_unit(engine, other, "pieces", 0)
    product_id = _product(client, fine)

    response = _change(client, product_id, foreign)

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "unit.not_found"
    assert _unit_of(client, product_id) == fine


def test_an_archived_product_keeps_its_unit(
    client: TestClient, engine: Engine, fine: int, whole: int
) -> None:
    product_id = _product(client, fine)
    archive_by_hand(engine, product_id)

    response = _change(client, product_id, whole)

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "variety.archived"


def test_a_product_of_another_business_answers_not_found(
    client: TestClient, other_client: TestClient, fine: int, whole: int
) -> None:
    product_id = _product(client, fine)

    response = other_client.patch(f"/api/products/{product_id}", json={"unit_id": whole})

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "variety.not_found"
    assert _unit_of(client, product_id) == fine


@pytest.mark.parametrize("body", [{}, {"name": "New", "unit_id": 1}])
def test_a_patch_names_exactly_one_of_the_name_and_the_unit(
    client: TestClient, fine: int, body: dict[str, Any]
) -> None:
    product_id = _product(client, fine)

    response = client.patch(f"/api/products/{product_id}", json=body)

    assert response.status_code == 422, response.text
    assert client.get(f"/api/products/{product_id}").json()["name"] == "Gold"


def test_renaming_still_works_through_the_same_route(client: TestClient, fine: int) -> None:
    product_id = _product(client, fine)

    response = client.patch(f"/api/products/{product_id}", json={"name": "Silver"})

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Silver"
    assert response.json()["unit"]["id"] == fine
