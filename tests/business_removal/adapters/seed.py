"""Seeds a file-backed SQLite database with two businesses through `TestClient`, for
every `main(...)` test that needs a real run over real rows (the declared seam).
Public so more than one test module can build the same fixture without repeating it
(`test_cli.py`, and this subtask's own `test_cli_failed_write.py`).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.clock import system_clock
from app.db import make_engine
from app.main import create_app
from app.settings import Settings
from tests.conftest import PASSWORD, TEST_HASHER, invite
from tests.fakes.telegram import FakeTelegram

EMAIL_LEAVING = "closing@example.com"
EMAIL_STAYING = "staying@example.com"
PHONE = "+5491122334455"
CUSTOMER_NAME = "Marta Gimenez"
SALE_NOTE = "Entrega el sabado por la tarde"
EXPENSE_DETAIL = "Factura de electricidad de septiembre"
PAYMENT_AMOUNT = 54321
EXPENSE_AMOUNT = 112233
SHIPPING_CHARGED = 98765
LOW_STOCK_THRESHOLD = 15
CATALOG_HEADER = "Catalogo de La Huerta"
CATALOG_FOOTER = "Gracias por tu compra"


def _accept(client: TestClient, engine: Engine, name: str, email: str) -> str:
    accepted = client.post(
        f"/invitations/{invite(engine, system_clock())}/accept",
        json={"business_name": name, "email": email, "password": PASSWORD},
    )
    assert accepted.status_code == 201, accepted.text
    token: str = accepted.json()["token"]
    client.cookies.clear()
    return token


def seed(db_path: Path) -> tuple[str, str]:
    """Business B (staying) opened first, with a customer of its own; business A
    (leaving, the newest) opened second, with one of everything the export holds:
    a customer, a variety, a price entry, a stock entry, a sale with a line and a
    note, a payment, an expense category and expense, and catalog settings. One
    failed login for the leaving business's email leaves a `login_guard` row, so
    the clean slate can be checked afterwards. Returns both session tokens."""
    url = f"sqlite:///{db_path}"
    engine = make_engine(url)
    settings = Settings(secret_key="test-secret", database_url=url)
    app = create_app(
        settings,
        engine=engine,
        clock=system_clock,
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    with TestClient(app) as client:
        token_b = _accept(client, engine, "Otro Negocio", EMAIL_STAYING)
        client.headers["Authorization"] = f"Bearer {token_b}"
        other_customer = client.post(
            "/customers", json={"name": "Cliente de Otro Negocio", "phone": "+5491100000000"}
        )
        assert other_customer.status_code == 201, other_customer.text
        del client.headers["Authorization"]

        token_a = _accept(client, engine, "La Huerta", EMAIL_LEAVING)
        client.headers["Authorization"] = f"Bearer {token_a}"

        customer = client.post(
            "/customers", json={"name": CUSTOMER_NAME, "phone": PHONE, "vip": False}
        )
        assert customer.status_code == 201, customer.text
        customer_id = customer.json()["id"]

        variety = client.post("/varieties", json={"name": "Lavanda"})
        assert variety.status_code == 201, variety.text
        variety_id = variety.json()["id"]

        price = client.post(
            f"/varieties/{variety_id}/prices",
            json={"effective_from": "2026-01-01", "list_price": 5000},
        )
        assert price.status_code == 201, price.text

        entry = client.post(
            "/stock/entries",
            json={
                "variety_id": variety_id,
                "origin": "purchase",
                "grams": 100,
                "total_cost": 300000,
                "note": "stock seed",
            },
        )
        assert entry.status_code == 201, entry.text

        sale = client.post(
            "/sales",
            json={
                "customer_id": customer_id,
                "shipping_charged": SHIPPING_CHARGED,
                "note": SALE_NOTE,
                "payment": "owing",
                "lines": [{"variety_id": variety_id, "grams": 10, "special_price": 6000}],
            },
        )
        assert sale.status_code == 201, sale.text

        payment = client.post(
            f"/customers/{customer_id}/payments",
            json={"paid_on": "2026-10-01", "amount": PAYMENT_AMOUNT, "method": "cash"},
        )
        assert payment.status_code == 201, payment.text

        category = client.post("/expense-categories", json={"name": "Servicios"})
        assert category.status_code == 201, category.text
        category_id = category.json()["id"]

        expense = client.post(
            "/expenses",
            json={
                "spent_on": "2026-10-02",
                "category_id": category_id,
                "amount": EXPENSE_AMOUNT,
                "detail": EXPENSE_DETAIL,
            },
        )
        assert expense.status_code == 201, expense.text

        header_footer = client.put(
            "/catalog/header-footer",
            json={"header": CATALOG_HEADER, "footer": CATALOG_FOOTER},
        )
        assert header_footer.status_code == 200, header_footer.text

        attributes = client.put(
            f"/catalog/varieties/{variety_id}",
            json={"shown": True, "emoji": "\U0001f33f", "indica_share": 50, "aroma": "floral"},
        )
        assert attributes.status_code == 200, attributes.text

        threshold = client.put(
            f"/stock/varieties/{variety_id}/threshold", json={"grams": LOW_STOCK_THRESHOLD}
        )
        assert threshold.status_code == 200, threshold.text

        failed_login = client.post(
            "/auth/login", json={"email": EMAIL_LEAVING, "password": "wrong password"}
        )
        assert failed_login.status_code == 401, failed_login.text

        del client.headers["Authorization"]
    engine.dispose()
    return token_a, token_b


def set_env(monkeypatch: pytest.MonkeyPatch, db_path: Path, export_dir: Path) -> None:
    monkeypatch.setenv("APOSTROPHE_SECRET_KEY", "cli-secret")
    monkeypatch.setenv("APOSTROPHE_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("APOSTROPHE_EXPORT_DIR", str(export_dir))


def row_counts(db_path: Path, table: str, business_id: int) -> int:
    connection = sqlite3.connect(db_path)
    try:
        column = "id" if table == "business" else "business_id"
        query = f"SELECT COUNT(*) FROM {table} WHERE {column} = ?"
        cursor = connection.execute(query, (business_id,))
        return int(cursor.fetchone()[0])
    finally:
        connection.close()
