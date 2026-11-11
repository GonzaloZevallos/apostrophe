"""A sale's On-the-spot payment and a later payment name their method by id
(docs/adr/20261111-payment-methods-by-id). The one guarded `INSERT … SELECT` of each writer
admits only an offered method of the session's business; every other id answers 404
`payment_method.unavailable`, names nothing, and writes no row. A rename shows on past rows;
a method in use cannot be deleted; Cash and Settlement keep their figures."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

METHODS = "/api/payment-methods"
DAY = "2026-09-01"


def _methods(client: TestClient) -> dict[str, int]:
    return {m["name"]: m["id"] for m in client.get(METHODS).json()}


def _variety(client: TestClient) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    return int(variety["id"])


def _customer(client: TestClient) -> int:
    return int(
        client.post("/customers", json={"name": "Ana", "phone": "11 2000-0000"}).json()["id"]
    )


def _sale(client: TestClient, variety: int, payment: dict[str, Any], **extra: Any) -> Any:
    return client.post(
        "/sales",
        json={"payment": payment, "lines": [{"product_id": variety, "quantity": "1"}], **extra},
    )


def _owing_sale(client: TestClient, variety: int, customer: int) -> None:
    sold = _sale(client, variety, {"kind": "owing"}, customer_id=customer, date=DAY)
    assert sold.status_code == 201, sold.text


def _count(engine: Engine, table: str) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one())


def _archived(client: TestClient) -> int:
    extra = client.post(METHODS, json={"name": "Wallet app"}).json()["id"]
    assert client.post(f"{METHODS}/{extra}/archive").status_code == 204
    return int(extra)


def _deleted(client: TestClient) -> int:
    extra = client.post(METHODS, json={"name": "Gone soon"}).json()["id"]
    assert client.delete(f"{METHODS}/{extra}").status_code == 204
    return int(extra)


UNAVAILABLE = ["archived", "deleted", "unknown", "other_business"]


def _unusable(kind: str, client: TestClient, other_client: TestClient) -> int:
    if kind == "archived":
        return _archived(client)
    if kind == "deleted":
        return _deleted(client)
    if kind == "unknown":
        return 99_999
    return _methods(other_client)["Cash"]


@pytest.mark.parametrize("kind", UNAVAILABLE)
def test_a_sale_paid_with_an_unusable_method_answers_404_and_writes_nothing(
    kind: str, client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    variety = _variety(client)
    method = _unusable(kind, client, other_client)

    refused = _sale(client, variety, {"kind": "paid", "payment_method_id": method})

    assert refused.status_code == 404
    assert refused.json()["code"] == "payment_method.unavailable"
    assert "Wallet" not in refused.text and "Gone" not in refused.text
    assert (_count(engine, "sale"), _count(engine, "payment")) == (0, 0)


@pytest.mark.parametrize("kind", UNAVAILABLE)
def test_a_later_payment_with_an_unusable_method_answers_404_and_writes_nothing(
    kind: str, client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _owing_sale(client, variety, customer)
    method = _unusable(kind, client, other_client)

    refused = client.post(
        f"/customers/{customer}/payments",
        json={"paid_on": DAY, "amount": 1_000, "payment_method_id": method},
    )

    assert refused.status_code == 404
    assert refused.json()["code"] == "payment_method.unavailable"
    assert _count(engine, "payment") == 0


def test_an_offered_method_pays_a_sale_and_a_later_payment(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _owing_sale(client, variety, customer)
    transfer = _methods(client)["Transfer"]

    paid = client.post(
        f"/customers/{customer}/payments",
        json={"paid_on": DAY, "amount": 1_000, "payment_method_id": transfer},
    )
    spot = _sale(client, variety, {"kind": "paid", "payment_method_id": transfer})

    assert paid.status_code == 201, paid.text
    assert paid.json()["payment"]["payment_method_id"] == transfer
    assert spot.status_code == 201, spot.text
    assert spot.json()["payment"] == "paid"


def test_a_rename_shows_on_the_past_rows(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _owing_sale(client, variety, customer)
    cash = _methods(client)["Cash"]
    recorded = client.post(
        f"/customers/{customer}/payments",
        json={"paid_on": DAY, "amount": 1_000, "payment_method_id": cash},
    )
    assert recorded.status_code == 201, recorded.text

    renamed = client.patch(f"{METHODS}/{cash}", json={"name": "Efectivo"})
    account = client.get(f"/customers/{customer}/account").json()

    assert renamed.status_code == 200, renamed.text
    names = [r["payment"]["payment_method"]["name"] for r in account["rows"] if "payment" in r]
    assert names == ["Efectivo"]


def test_deleting_a_method_in_use_answers_409_in_use(client: TestClient) -> None:
    variety = _variety(client)
    cash = _methods(client)["Cash"]
    assert _sale(client, variety, {"kind": "paid", "payment_method_id": cash}).status_code == 201

    refused = client.delete(f"{METHODS}/{cash}")

    assert refused.status_code == 409
    assert refused.json()["code"] == "payment_method.in_use"
    assert {m["name"]: m["in_use"] for m in client.get(METHODS).json()}["Cash"] is True


def test_an_archived_method_in_use_stays_on_past_rows_and_cannot_pay_again(
    client: TestClient,
) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _owing_sale(client, variety, customer)
    cash = _methods(client)["Cash"]
    assert (
        client.post(
            f"/customers/{customer}/payments",
            json={"paid_on": DAY, "amount": 1_000, "payment_method_id": cash},
        ).status_code
        == 201
    )
    assert client.post(f"{METHODS}/{cash}/archive").status_code == 204

    rows = client.get(f"/customers/{customer}/account").json()["rows"]
    again = client.post(
        f"/customers/{customer}/payments",
        json={"paid_on": DAY, "amount": 1_000, "payment_method_id": cash},
    )

    assert [r["payment"]["payment_method"]["name"] for r in rows if "payment" in r] == ["Cash"]
    assert again.status_code == 404


def test_the_debtors_and_the_settlement_do_not_depend_on_the_method(client: TestClient) -> None:
    variety = _variety(client)
    customer = _customer(client)
    _owing_sale(client, variety, customer)
    methods = _methods(client)
    totals = []
    for name in ("Cash", "Transfer"):
        preview = client.post(
            f"/customers/{customer}/payments/preview", json={"paid_on": DAY, "amount": 4_000}
        )
        assert preview.status_code == 200, preview.text
        recorded = client.post(
            f"/customers/{customer}/payments",
            json={"paid_on": DAY, "amount": 4_000, "payment_method_id": methods[name]},
        )
        assert recorded.status_code == 201, recorded.text
        totals.append(recorded.json()["after"]["balance"])

    assert totals == [6_000, 2_000]
    debtors = client.get("/payments/debtors").json()["debtors"]
    assert [d["balance"] for d in debtors] == [2_000]
