"""A former VIP customer is priced exactly as before the upgrade (docs/adr/0059): a
database at revision 0019 holds a customer with `vip = 1`, a price entry (list 1000,
bulk 800 from 10, VIP price 700) and a sale recorded then; `upgrade_to_head` runs at
the app's startup, new sales are recorded over HTTP, and the prices, rules and totals
are the values spelled by hand below. The sale recorded at 0019 reads back unchanged."""

from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.migrations.runner import MIGRATIONS_ROOT
from tests.conftest import PASSWORD, TEST_HASHER

EMAIL = "viejo@example.com"
FORMER_VIP = 1
PLAIN = 2
OLD_SALE = 1


def _migrate_to_0019(engine: Engine) -> None:
    with engine.connect() as connection:
        dbapi_connection = connection.connection.dbapi_connection
        assert dbapi_connection is not None
        dbapi_connection.execute("PRAGMA foreign_keys=OFF")
        config = Config()
        config.set_main_option("script_location", str(MIGRATIONS_ROOT))
        config.attributes["connection"] = connection
        with connection.begin():
            command.upgrade(config, "0019")
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


def _seed_at_0019(engine: Engine) -> None:
    statements = [
        ("INSERT INTO business (id, name, language) VALUES (1, 'Viejo', 'en')", {}),
        (
            "INSERT INTO app_user (id, business_id, email, password_hash, joined_at) "
            "VALUES (1, 1, :email, :hash, '2026-01-01 00:00:00')",
            {"email": EMAIL, "hash": TEST_HASHER.hash(PASSWORD)},
        ),
        (
            "INSERT INTO pricing_settings (id, business_id, is_bulk_pricing, is_vip_customers) "
            "VALUES (1, 1, 1, 1)",
            {},
        ),
        ("INSERT INTO variety (id, business_id, name, name_key) VALUES (1, 1, 'L', 'l')", {}),
        (
            "INSERT INTO price_entry (id, business_id, variety_id, effective_from, list_price, "
            "bulk_price, bulk_minimum_hundredths, vip_price) "
            "VALUES (1, 1, 1, '2026-01-01', 1000, 800, 1000, 700)",
            {},
        ),
        (
            "INSERT INTO customer (id, business_id, name, phone, vip) "
            "VALUES (1, 1, 'Fran', '+5491123456789', 1), (2, 1, 'Beto', '+5491100000003', 0)",
            {},
        ),
        (
            "INSERT INTO sale (id, business_id, sale_date, customer_id, shipping_charged, "
            "recorded_at) VALUES (1, 1, '2026-01-02', 1, 0, '2026-01-02 12:00:00')",
            {},
        ),
        (
            "INSERT INTO sale_line (id, business_id, sale_id, variety_id, grams_hundredths, "
            "pricing_rule, price_per_gram, line_total, position) "
            "VALUES (1, 1, 1, 1, 500, 'vip', 700, 3500, 0)",
            {},
        ),
    ]
    with engine.begin() as connection:
        for statement, parameters in statements:
            connection.execute(text(statement), parameters)


@pytest.fixture
def upgraded_client(app: FastAPI, engine: Engine) -> Iterator[TestClient]:
    _migrate_to_0019(engine)
    _seed_at_0019(engine)
    with TestClient(app) as test_client:  # the lifespan runs upgrade_to_head
        login = test_client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        assert login.status_code == 200, login.text
        test_client.headers["Authorization"] = f"Bearer {login.json()['token']}"
        yield test_client


def _priced(client: TestClient, customer_id: int, quantity: str) -> tuple[str, int, int]:
    created = client.post(
        "/sales",
        json={
            "payment": {"kind": "paid", "payment_method_id": 1},
            "customer_id": customer_id,
            "lines": [{"product_id": 1, "quantity": quantity}],
        },
    )
    assert created.status_code == 201, created.text
    line = created.json()["lines"][0]
    return line["pricing_rule"], line["price_per_gram"], line["line_total"]


def test_a_former_vip_customer_is_priced_after_the_upgrade_as_before(
    upgraded_client: TestClient,
) -> None:
    assert _priced(upgraded_client, FORMER_VIP, "5") == ("vip", 700, 3_500)
    assert _priced(upgraded_client, FORMER_VIP, "12") == ("vip", 700, 8_400)


def test_a_customer_who_was_not_vip_is_priced_after_the_upgrade_as_before(
    upgraded_client: TestClient,
) -> None:
    assert _priced(upgraded_client, PLAIN, "5") == ("list", 1_000, 5_000)
    assert _priced(upgraded_client, PLAIN, "12") == ("bulk", 800, 9_600)


def test_the_sale_recorded_at_0019_reads_back_unchanged_with_the_vip_badge(
    upgraded_client: TestClient,
) -> None:
    _priced(upgraded_client, FORMER_VIP, "5")

    old = upgraded_client.get(f"/sales/{OLD_SALE}").json()

    assert [
        (line["pricing_rule"], line["price_per_gram"], line["line_total"]) for line in old["lines"]
    ] == [("vip", 700, 3_500)]
    assert old["total"] == 3_500
    assert old["customer"] == {"id": FORMER_VIP, "name": "Fran", "vip": True}
    listed = {sale["id"]: sale for sale in upgraded_client.get("/sales").json()}
    assert listed[OLD_SALE]["customer"]["vip"] is True
