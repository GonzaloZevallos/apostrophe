"""`SqlNewSaleSuggestions.last_paid_method` over a real database (docs/product/sales.md,
New sale suggestions): the Sale paid on the spot with the highest Sale number is picked
first and its method judged after, never filtered. Sales, methods and customers come
from the `client` and `other_client` fixtures over HTTP (CODING_STANDARDS section 5);
only the adapter, the seam under test, is built and called directly."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.products.adapters.tables import ProductRow
from app.sales.adapters.sql_suggestions import SqlNewSaleSuggestions
from app.sales.application.ports import LastPaidMethod


def _product(client: TestClient, name: str = "Lavanda") -> int:
    product = client.post("/api/products", json={"name": name}).json()
    client.post(
        f"/api/products/{product['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(product["id"])


def _new_method(client: TestClient, name: str) -> int:
    created = client.post("/api/payment-methods", json={"name": name, "icon": "card"})
    assert created.status_code == 201, created.text
    return int(created.json()["id"])


def _archive(client: TestClient, method_id: int) -> None:
    assert client.post(f"/api/payment-methods/{method_id}/archive").status_code == 204


def _sell(
    client: TestClient, product_id: int, payment: dict[str, Any], **extra: Any
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "payment": payment,
        "lines": [{"product_id": product_id, "quantity": "1"}],
        **extra,
    }
    response = client.post("/sales", json=body)
    assert response.status_code == 201, response.text
    return dict(response.json())


def _paid(method_id: int) -> dict[str, Any]:
    return {"kind": "paid", "payment_method_id": method_id}


def _customer(client: TestClient, name: str = "Fran Araujo") -> int:
    created = client.post(
        "/customers", json={"name": name, "phone": "11 2345-6789", "phone_country": "AR"}
    )
    return int(created.json()["id"])


def _business_id(engine: Engine, product_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(ProductRow).where(ProductRow.id == product_id))
        assert row is not None
        return row.business_id


def _last(engine: Engine, product_id: int) -> LastPaidMethod | None:
    with Session(engine) as session:
        return SqlNewSaleSuggestions(session, _business_id(engine, product_id)).last_paid_method()


def test_the_latest_paid_sales_archived_method_is_reported_not_skipped_for_an_older_one(
    client: TestClient, engine: Engine
) -> None:
    product = _product(client)
    live, archived = _new_method(client, "Live"), _new_method(client, "Gone")
    _sell(client, product, _paid(live))
    _sell(client, product, _paid(archived))
    _archive(client, archived)

    assert _last(engine, product) == LastPaidMethod(payment_method_id=archived, is_archived=True)


def test_a_live_latest_method_is_reported_live(client: TestClient, engine: Engine) -> None:
    product = _product(client)
    live = _new_method(client, "Live")
    _sell(client, product, _paid(live))

    assert _last(engine, product) == LastPaidMethod(payment_method_id=live, is_archived=False)


def test_a_newer_owing_sale_is_skipped(client: TestClient, engine: Engine) -> None:
    product = _product(client)
    live = _new_method(client, "Live")
    paid = _sell(client, product, _paid(live))
    owing = _sell(client, product, {"kind": "owing"}, customer_id=_customer(client))
    assert owing["number"] > paid["number"]

    assert _last(engine, product) == LastPaidMethod(payment_method_id=live, is_archived=False)


def test_a_newer_zero_dollar_gift_sale_is_skipped(client: TestClient, engine: Engine) -> None:
    product = _product(client)
    live = _new_method(client, "Live")
    paid = _sell(client, product, _paid(live))
    gift = client.post(
        "/sales", json={"lines": [{"product_id": product, "quantity": "1", "gift": True}]}
    )
    assert gift.status_code == 201, gift.text
    seen = client.get(f"/sales/{gift.json()['id']}").json()
    assert seen["number"] > paid["number"]
    assert seen["total"] == 0 and seen["payment"] == "none"

    assert _last(engine, product) == LastPaidMethod(payment_method_id=live, is_archived=False)


def test_another_business_never_changes_the_answer(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    product = _product(client)
    live = _new_method(client, "Live")
    _sell(client, product, _paid(live))
    foreign_product = _product(other_client, "Foreign")
    foreign_method = _new_method(other_client, "Foreign card")
    _sell(other_client, foreign_product, _paid(foreign_method))
    _sell(other_client, foreign_product, _paid(foreign_method), customer_id=_customer(other_client))
    _archive(other_client, foreign_method)

    assert _last(engine, product) == LastPaidMethod(payment_method_id=live, is_archived=False)
    assert _last(engine, foreign_product) == LastPaidMethod(
        payment_method_id=foreign_method, is_archived=True
    )


def test_no_paid_sale_at_all_is_none(client: TestClient, engine: Engine) -> None:
    product = _product(client)
    _sell(client, product, {"kind": "owing"}, customer_id=_customer(client))

    assert _last(engine, product) is None
