"""Archiving a variety moves no figure (PRD criteria 2 and 3, plan invariant 2).

Over one seeded history, through the HTTP API only, every figure the books answer is
captured before archiving, while archived and after restoring; the three captures must
differ in nothing a past record shows. Then the variety comes back whole, and the pinned
catalog's upkeep edits exactly when the text changes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.pinned_catalog.domain.errors import TelegramUnreachable
from tests.conftest import MovableClock
from tests.fakes.telegram import FakeTelegram

TOKEN = "123456789:top-secret-bot-token"
MONTHS = ("2026-09", "2026-10")


def _ok(response: Any, status: int = 200) -> Any:
    assert response.status_code == status, response.text
    return response.json()


def _variety(client: TestClient, name: str, price: int) -> int:
    variety = _ok(client.post("/varieties", json={"name": name}), 201)
    _ok(
        client.post(
            f"/varieties/{variety['id']}/prices",
            json={"effective_from": "2020-01-01", "list_price": price},
        ),
        201,
    )
    return int(variety["id"])


def _entry(client: TestClient, variety_id: int, grams: str, on: str, **more: Any) -> int:
    body = {"variety_id": variety_id, "origin": "opening_stock", "grams": grams, "date": on, **more}
    return int(_ok(client.post("/stock/entries", json=body), 201)["id"])


def _sale(client: TestClient, on: str, lines: list[dict[str, Any]], **more: Any) -> int:
    body = {"date": on, "lines": lines, **more}
    return int(_ok(client.post("/sales", json=body), 201)["id"])


class Seed:
    def __init__(self, archived_id: int, kept_id: int, customer_id: int, sale_ids: list[int]):
        self.archived_id = archived_id
        self.kept_id = kept_id
        self.customer_id = customer_id
        self.sale_ids = sale_ids


def _seed(client: TestClient, clock: MovableClock) -> Seed:
    clock.set(datetime(2026, 10, 15, 18, 0, tzinfo=UTC))
    a = _variety(client, "Criolla", 1_000)
    b = _variety(client, "Indica", 2_000)
    customer = _ok(client.post("/customers", json={"name": "Juana", "phone": "11 2345-6789"}), 201)
    _entry(client, a, "100", "2026-09-10", origin="purchase", total_cost=20_000)
    _entry(client, b, "50", "2026-09-10", origin="purchase", total_cost=10_000)
    sales = [
        # left owing
        _sale(
            client,
            "2026-09-12",
            [{"variety_id": a, "grams": "5"}, {"variety_id": b, "grams": "2"}],
            customer_id=customer["id"],
            payment="owing",
        ),
        # paid on the spot
        _sale(client, "2026-09-20", [{"variety_id": a, "grams": "3"}], payment="cash"),
        # a gift and a special price
        _sale(
            client,
            "2026-10-01",
            [
                {"variety_id": a, "grams": "2", "gift": True},
                {"variety_id": b, "grams": "1", "special_price": 1_500},
            ],
            payment="cash",
        ),
    ]
    _ok(
        client.post(
            f"/customers/{customer['id']}/payments",
            json={"paid_on": "2026-10-01", "amount": 1_000, "method": "cash"},
        ),
        201,
    )
    # a negative adjustment drawn from costed grams, then one that overdraws into pending
    _entry(client, a, "-4", "2026-09-25", origin="adjustment")
    _entry(client, a, "-150", "2026-10-02", origin="adjustment")
    # a sale line whose grams have no lot behind them
    sales.append(_sale(client, "2026-10-03", [{"variety_id": a, "grams": "10"}], payment="cash"))
    category = _ok(client.post("/expense-categories", json={"name": "Bolsitas"}), 201)
    _ok(
        client.post(
            "/expenses",
            json={
                "spent_on": "2026-09-15",
                "category_id": category["id"],
                "amount": 3_000,
                "detail": "bags",
            },
        ),
        201,
    )
    return Seed(a, b, int(customer["id"]), sales)


def _books(client: TestClient, seed: Seed) -> dict[str, Any]:
    """Every figure a past record or a period shows: nothing in it may depend on whether
    a variety is archived."""
    panel = _ok(client.get("/panel"))
    stock = _ok(client.get("/stock"))
    return {
        "analysis": {m: _ok(client.get("/analysis", params={"month": m})) for m in MONTHS},
        "panel_periods": panel["periods"],
        "sales": {i: _ok(client.get(f"/sales/{i}")) for i in seed.sale_ids},
        "sales_list": _ok(client.get("/sales")),
        "customers": _ok(client.get("/customers")),
        "account": _ok(client.get(f"/customers/{seed.customer_id}/account")),
        "stock_total": stock["total"],
        "entries": stock["entries"],
    }


def _variety_row(stock: dict[str, Any], variety_id: int) -> dict[str, Any]:
    (row,) = [r for r in stock["varieties"] if r["variety_id"] == variety_id]
    assert isinstance(row, dict)
    return row


def _archive(client: TestClient, variety_id: int) -> None:
    _ok(client.post(f"/varieties/{variety_id}/archive"))


def _restore(client: TestClient, variety_id: int) -> None:
    _ok(client.post(f"/varieties/{variety_id}/restore"))


def test_no_figure_of_the_books_moves_when_a_variety_is_archived_and_restored(
    client: TestClient, clock: MovableClock
) -> None:
    seed = _seed(client, clock)
    before = _books(client, seed)
    row_before = _variety_row(_ok(client.get("/stock")), seed.archived_id)
    # the seed really holds the hard cases: pending grams and a negative stock
    assert before["panel_periods"]["month"]["pending_cost"] is True
    assert before["analysis"]["2026-09"]["month"]["varieties"]
    assert before["account"]

    _archive(client, seed.archived_id)
    while_archived = _books(client, seed)
    archived_stock = _ok(client.get("/stock", params={"archived": "true"}))
    row_archived = _variety_row(archived_stock, seed.archived_id)
    listed_stock = _ok(client.get("/stock"))
    assert seed.archived_id not in [r["variety_id"] for r in listed_stock["varieties"]]

    _restore(client, seed.archived_id)
    after = _books(client, seed)
    row_after = _variety_row(_ok(client.get("/stock")), seed.archived_id)

    assert while_archived == before
    assert after == before
    assert row_archived == row_before
    assert row_after == row_before


@pytest.mark.parametrize("shown", [True, False])
def test_a_restored_variety_comes_back_whole(
    client: TestClient, clock: MovableClock, shown: bool
) -> None:
    seed = _seed(client, clock)
    a = seed.archived_id
    _ok(client.put(f"/stock/varieties/{a}/threshold", json={"grams": "20"}))
    _ok(
        client.put(
            f"/catalog/varieties/{a}",
            json={"shown": shown, "emoji": "🌿", "indica_share": 70, "aroma": "Cítrico"},
        )
    )

    def whole() -> dict[str, Any]:
        stock = _ok(client.get("/stock"))
        return {
            "variety": _ok(client.get(f"/varieties/{a}")),
            "prices": _ok(client.get(f"/varieties/{a}/prices")),
            "entries": [e for e in stock["entries"] if e["variety_id"] == a],
            "stock_row": _variety_row(stock, a),
            "catalog": [v for v in _ok(client.get("/catalog"))["varieties"] if v["id"] == a],
        }

    before = whole()
    _archive(client, a)
    assert a not in [row["variety_id"] for row in _ok(client.get("/panel"))["stock"]]
    assert a not in [v["id"] for v in _ok(client.get("/varieties"))]
    assert a not in [v["variety_id"] for v in _ok(client.get("/stock"))["varieties"]]
    assert all(v["id"] != a for v in _ok(client.get("/catalog"))["varieties"])
    _restore(client, a)

    assert whole() == before
    assert a in [v["id"] for v in _ok(client.get("/varieties"))]
    assert a in [v["variety_id"] for v in _ok(client.get("/stock"))["varieties"]]
    assert a in [row["variety_id"] for row in _ok(client.get("/panel"))["stock"]]


def _edits(telegram: FakeTelegram) -> list[tuple[str, ...]]:
    return [call for call in telegram.calls if call[0] == "edit"]


def _publish(client: TestClient) -> None:
    client.post(
        "/pinned-catalog/test",
        json={"token": TOKEN, "own_chat": "111", "channel_chat": "@canal"},
    )
    _ok(client.post("/pinned-catalog/publish"))


def _qualifying(client: TestClient, name: str) -> int:
    variety_id = _variety(client, name, 9_000)
    _entry(client, variety_id, "50", "2026-10-01")
    return variety_id


def test_archive_and_restore_edit_the_pin_exactly_when_the_text_changes(
    client: TestClient, telegram: FakeTelegram
) -> None:
    kept = _qualifying(client, "Kept")
    gone = _qualifying(client, "Gone")
    assert kept != gone
    _publish(client)
    telegram.calls.clear()

    _archive(client, gone)
    assert len(_edits(telegram)) == 1
    assert "Gone" not in _edits(telegram)[0][3]

    _restore(client, gone)
    assert len(_edits(telegram)) == 2
    assert "Gone" in _edits(telegram)[1][3]


def test_archiving_a_hidden_or_unpriced_variety_sends_nothing(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _qualifying(client, "Kept")
    hidden = _qualifying(client, "Hidden")
    _ok(
        client.put(
            f"/catalog/varieties/{hidden}",
            json={"shown": False, "emoji": None, "indica_share": None, "aroma": None},
        )
    )
    unpriced = int(_ok(client.post("/varieties", json={"name": "Unpriced"}), 201)["id"])
    _publish(client)
    telegram.calls.clear()

    _archive(client, hidden)
    _archive(client, unpriced)

    assert _edits(telegram) == []


def test_the_triggering_request_answers_normally_when_telegram_fails(
    client: TestClient, telegram: FakeTelegram
) -> None:
    _qualifying(client, "Kept")
    gone = _qualifying(client, "Gone")
    _publish(client)
    telegram.fail_next(TelegramUnreachable())

    archived = client.post(f"/varieties/{gone}/archive")

    assert archived.status_code == 200, archived.text
    assert archived.json()["archived"] is True
