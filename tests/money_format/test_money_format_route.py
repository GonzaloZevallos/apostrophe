"""`GET`/`PUT /api/money-format` and `GET /auth/me`, through `TestClient` at both money
scales (docs/adr/0080): a business reads and sets only its own symbol and decimals, every
refusal leaves both as they were, and only a save that changed a value schedules upkeep."""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.pinned_catalog.domain.errors import TelegramUnreachable
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
PATH = "/api/money-format"


def _put(client: TestClient, symbol: str, decimals: int) -> Any:
    return client.put(PATH, json={"symbol": symbol, "decimals": decimals})


def _stored(engine: Engine, business_name: str) -> tuple[str, int]:
    with engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT m.symbol, m.decimals FROM money_format m "
                "JOIN business b ON b.id = m.business_id WHERE b.name = :n"
            ),
            {"n": business_name},
        ).one()
    return str(row[0]), int(row[1])


def test_a_new_business_reads_the_defaults(client: TestClient) -> None:
    response = client.get(PATH)

    assert response.status_code == 200
    assert response.json() == {"symbol": "$", "decimals": 0}


def test_put_sets_the_symbol_and_answers_the_stored_format(client: TestClient) -> None:
    response = _put(client, "  US$ ", 0)

    assert response.status_code == 200, response.text
    assert response.json() == {"symbol": "US$", "decimals": 0}
    assert client.get(PATH).json() == {"symbol": "US$", "decimals": 0}


def test_a_request_and_an_answer_never_carry_a_scale(client: TestClient) -> None:
    response = client.put(PATH, json={"symbol": "$", "decimals": 2, "scale": 2})

    assert response.status_code == 200, response.text
    assert set(response.json()) == {"symbol", "decimals"}


@pytest.mark.parametrize(
    "symbol",
    ["", "   ", "ABCDE", "a**b", "**", "a\tb", "​", "a‮b"],
)
def test_an_invalid_symbol_is_refused_on_the_symbol_field_and_the_row_reads_back_unchanged(
    client: TestClient, engine: Engine, symbol: str
) -> None:
    response = _put(client, symbol, 2)

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "money_format.symbol_invalid"
    assert body["field"] == "symbol"
    assert symbol.strip() not in body["detail"] or symbol.strip() == ""
    assert _stored(engine, "Primer Negocio") == ("$", 0)
    assert client.get(PATH).json() == {"symbol": "$", "decimals": 0}


@pytest.mark.parametrize("decimals", [-1, 3])
def test_decimals_outside_0_to_2_are_refused_on_the_decimals_field(
    client: TestClient, engine: Engine, decimals: int
) -> None:
    response = _put(client, "US$", decimals)

    assert response.status_code == 422
    assert response.json()["code"] == "money_format.decimals_invalid"
    assert response.json()["field"] == "decimals"
    assert _stored(engine, "Primer Negocio") == ("$", 0)


def test_a_single_asterisk_and_a_symbol_with_a_space_are_accepted(client: TestClient) -> None:
    assert _put(client, "*", 0).status_code == 200
    assert _put(client, "US $", 0).json() == {"symbol": "US $", "decimals": 0}


def test_raising_to_2_and_lowering_back_with_no_cents_is_accepted(
    client: TestClient, engine: Engine
) -> None:
    assert _put(client, "$", 2).json() == {"symbol": "$", "decimals": 2}
    with engine.connect() as connection:
        assert connection.execute(text("SELECT scale FROM money_format")).scalar_one() == 2

    assert _put(client, "$", 0).json() == {"symbol": "$", "decimals": 0}
    assert _stored(engine, "Primer Negocio") == ("$", 0)


def test_me_shows_each_business_its_own_symbol(
    client: TestClient, other_client: TestClient
) -> None:
    assert _put(client, "US$", 0).status_code == 200

    assert client.get("/auth/me").json()["money_format"] == {"symbol": "US$", "decimals": 0}
    assert other_client.get("/auth/me").json()["money_format"] == {"symbol": "$", "decimals": 0}


def test_another_businesses_save_never_moves_this_one(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    assert _put(other_client, "R$", 2).status_code == 200

    assert client.get(PATH).json() == {"symbol": "$", "decimals": 0}
    assert _stored(engine, "Otro Negocio") == ("R$", 2)


def _edits(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] == "edit"]


def _publish_a_catalog(client: TestClient) -> None:
    variety = client.post("/api/products", json={"name": "V1"}).json()
    client.post(
        "/stock/entries",
        json={"product_id": variety["id"], "origin": "opening_stock", "quantity": "50"},
    )
    priced = client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9000},
    )
    assert priced.status_code == 201, priced.text
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    assert client.post("/pinned-catalog/publish").status_code == 200


def _leave_the_pin_failed(client: TestClient, telegram: FakeTelegram) -> None:
    """A pin that failed to sync needs a send whatever the text says, so an upkeep that
    runs retries at once and a task that never ran leaves it failed: that tells a
    scheduled upkeep from a no-op, independently of what the text holds."""
    product_id = client.get("/api/products").json()[0]["id"]
    telegram.fail_next(TelegramUnreachable())
    client.patch(f"/api/products/{product_id}", json={"name": "V1 Renamed"})
    reason = client.get("/pinned-catalog/status").json()["status"]["reason"]
    assert reason == "telegram_unreachable"
    telegram.calls.clear()


def test_a_changed_symbol_schedules_an_upkeep_once(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _publish_a_catalog(client)
    _leave_the_pin_failed(client, telegram)

    assert _put(client, "US$", 0).status_code == 200

    assert len(_edits(telegram)) == 1
    assert client.get("/pinned-catalog/status").json()["status"]["state"] == "up_to_date"


def test_saving_the_stored_values_again_schedules_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    assert _put(client, "US$", 0).status_code == 200
    _publish_a_catalog(client)
    _leave_the_pin_failed(client, telegram)

    assert _put(client, "US$", 0).status_code == 200

    assert telegram.calls == []
    assert client.get("/pinned-catalog/status").json()["status"]["reason"] == "telegram_unreachable"


JSON = {"Content-Type": "application/json"}


def _as_json(body: dict[str, Any]) -> str:
    """The body as JSON text, the amount `"10.50"` written as the number 10.50 the way a
    client sends it."""
    return json.dumps(body).replace('"10.50"', "10.50")


def _bodies(client: TestClient) -> list[tuple[str, str, dict[str, Any]]]:
    """One write per money route, each carrying an amount with cents, over records that
    exist at 2 decimals."""
    product = client.post("/api/products", json={"name": "Rosa"}).json()["id"]
    client.post(
        f"/api/products/{product}/prices",
        json={"effective_from": "2026-01-01", "list_price": 100},
    )
    entry = client.post(
        "/stock/entries", json={"product_id": product, "origin": "adjustment", "quantity": 20}
    ).json()
    category = client.post("/expense-categories", json={"name": "Taxes"}).json()["id"]
    customer = client.post("/customers", json={"name": "Ana", "phone": "11 5555-5555"}).json()["id"]
    expense = client.post(
        "/expenses",
        json={"spent_on": "2026-10-01", "category_id": category, "amount": 100, "detail": "a"},
    ).json()["id"]
    sale_line = {"product_id": product, "quantity": "1"}
    return [
        (
            "POST",
            f"/api/products/{product}/prices",
            {"effective_from": "2026-02-01", "list_price": "10.50"},
        ),
        (
            "POST",
            "/expenses",
            {"spent_on": "2026-10-01", "category_id": category, "amount": "10.50", "detail": "b"},
        ),
        (
            "PUT",
            f"/expenses/{expense}",
            {"spent_on": "2026-10-01", "category_id": category, "amount": "10.50", "detail": "c"},
        ),
        ("POST", "/sales", {"payment": "cash", "shipping_charged": "10.50", "lines": [sale_line]}),
        (
            "POST",
            "/sales",
            {"payment": "cash", "lines": [{**sale_line, "special_price": "10.50"}]},
        ),
        (
            "POST",
            "/stock/entries",
            {"product_id": product, "origin": "purchase", "quantity": 2, "total_cost": "10.50"},
        ),
        (
            "PUT",
            f"/stock/entries/{entry['id']}",
            {"product_id": product, "origin": "purchase", "quantity": 2, "total_cost": "10.50"},
        ),
        (
            "POST",
            f"/customers/{customer}/payments",
            {"paid_on": "2026-10-02", "amount": "10.50", "method": "cash"},
        ),
        (
            "POST",
            f"/customers/{customer}/payments/preview",
            {"paid_on": "2026-10-02", "amount": "10.50"},
        ),
    ]


def test_an_amount_with_cents_after_raising_is_kept_or_refused_as_too_many_decimals_never_a_500(
    client: TestClient,
) -> None:
    assert _put(client, "$", 2).status_code == 200
    answers = [
        (method, path, client.request(method, path, content=_as_json(body), headers=JSON))
        for method, path, body in _bodies(client)
    ]

    for method, path, answer in answers:
        assert answer.status_code < 500, (method, path, answer.text)
        if answer.status_code >= 400:
            assert answer.status_code == 422, (method, path, answer.text)
            assert answer.json()["code"] == "money.too_many_decimals", (method, path)
            assert "10.5" not in answer.text
