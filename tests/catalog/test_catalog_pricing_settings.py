"""The catalog text follows the business's pricing switches (CONTEXT.md: Catalog, Pricing
settings): the bulk line shows only while Precio por cantidad is on, and the VIP price is
never in the text, whatever the switches say. Through `GET /catalog` with the real
adapters.

`PUT /pricing-settings` belongs to another subtask; here the switches are moved by
writing the business's own `pricing_settings` row, the same state that route will write.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.pricing_settings.adapters.tables import PricingSettingsRow
from app.varieties.adapters.tables import PriceEntryRow

BULK_LINE = "• Desde 10 g: $10.000 c/u"
VIP_PRICE_TEXTS = ("$9.000", "9.000", "9000")


def _switch(engine: Engine, business: str, *, bulk: bool, vip: bool) -> None:
    with Session(engine) as session:
        business_id = session.scalars(
            select(BusinessRow.id).where(BusinessRow.name == business)
        ).one()
        session.execute(
            update(PricingSettingsRow)
            .where(PricingSettingsRow.business_id == business_id)
            .values(is_bulk_pricing=bulk, is_vip_customers=vip)
        )
        session.commit()


def _put_vip_price(engine: Engine, vip_price: int) -> None:
    """The VIP price is entered through the varieties subtask's route; this seam only
    needs the stored value to be there for the catalog to ignore."""
    with Session(engine) as session:
        session.execute(update(PriceEntryRow).values(vip_price=vip_price))
        session.commit()


def _bulk_priced_variety(client: TestClient, name: str) -> None:
    variety_id = client.post("/varieties", json={"name": name}).json()["id"]
    price = client.post(
        f"/varieties/{variety_id}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": 11_000,
            "bulk_price": 10_000,
            "bulk_minimum": "10",
        },
    )
    assert price.status_code == 201, price.text
    stock = client.post(
        "/stock/entries",
        json={"variety_id": variety_id, "origin": "opening_stock", "grams": "50"},
    )
    assert stock.status_code == 201, stock.text


def _text(client: TestClient) -> str:
    text = client.get("/catalog").json()["text"]
    assert isinstance(text, str)
    return text


@pytest.mark.parametrize(
    ("bulk", "vip"), [(False, False), (True, False), (False, True), (True, True)]
)
def test_the_bulk_line_follows_precio_por_cantidad_alone(
    client: TestClient, engine: Engine, bulk: bool, vip: bool
) -> None:
    _bulk_priced_variety(client, "Gelato")
    _switch(engine, "Primer Negocio", bulk=bulk, vip=vip)

    text = _text(client)

    assert "• Precio x gramo: $11.000" in text
    assert (BULK_LINE in text) is bulk


@pytest.mark.parametrize(
    ("bulk", "vip"), [(False, False), (True, False), (False, True), (True, True)]
)
def test_the_vip_price_is_never_in_the_text(
    client: TestClient, engine: Engine, bulk: bool, vip: bool
) -> None:
    _bulk_priced_variety(client, "Gelato")
    _put_vip_price(engine, 9_000)
    _switch(engine, "Primer Negocio", bulk=bulk, vip=vip)

    text = _text(client)

    assert not any(amount in text for amount in VIP_PRICE_TEXTS)
    assert "VIP" not in text


def test_a_switch_change_shows_on_the_next_read(client: TestClient, engine: Engine) -> None:
    _bulk_priced_variety(client, "Gelato")
    _switch(engine, "Primer Negocio", bulk=True, vip=False)
    assert BULK_LINE in _text(client)

    _switch(engine, "Primer Negocio", bulk=False, vip=False)
    assert BULK_LINE not in _text(client)

    _switch(engine, "Primer Negocio", bulk=True, vip=False)
    assert BULK_LINE in _text(client)


def test_one_businesss_switches_never_change_anothers_text(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _bulk_priced_variety(client, "Gelato")
    _bulk_priced_variety(other_client, "Gelato")

    _switch(engine, "Primer Negocio", bulk=True, vip=False)
    _switch(engine, "Otro Negocio", bulk=False, vip=False)

    assert BULK_LINE in _text(client)
    assert BULK_LINE not in _text(other_client)

    _switch(engine, "Primer Negocio", bulk=False, vip=False)
    _switch(engine, "Otro Negocio", bulk=True, vip=False)

    assert BULK_LINE not in _text(client)
    assert BULK_LINE in _text(other_client)
