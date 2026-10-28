"""`history`: the one assembly of lots and draws over the three sources (ADR-0031),
run against the real adapters over a fresh in-memory SQLite. Entries and the sale
come over HTTP from the `client` fixture; only the withdrawal is written through its
repository, since its route belongs to another subtask."""

from datetime import UTC, date, datetime
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.products.adapters.tables import ProductRow
from app.shared.quantity import Quantity
from app.stock.adapters.sql_draws import SqlDraws
from app.stock.adapters.sql_stock_entries import SqlStockEntries
from app.stock.adapters.sql_stock_withdrawals import SqlStockWithdrawals
from app.stock.application.history import history
from app.stock.domain.allocation import allocate
from app.stock.domain.draw_source import DrawSource, WithdrawalReason
from app.stock.domain.withdrawal import Withdrawal, WithdrawalLine

TODAY = date(2026, 10, 2)


def _variety(client: TestClient, name: str) -> int:
    variety_id = int(client.post("/varieties", json={"name": name}).json()["id"])
    price = {"effective_from": "2026-01-01", "list_price": 10_000}
    client.post(f"/varieties/{variety_id}/prices", json=price)
    return variety_id


def _entry(client: TestClient, variety_id: int, **overrides: Any) -> None:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": "purchase", "grams": "5"}
    body.update(overrides)
    assert client.post("/stock/entries", json=body).status_code == 201


def _business_of(engine: Engine, variety_id: int) -> int:
    with Session(engine) as session:
        row = session.scalar(select(ProductRow).where(ProductRow.id == variety_id))
        assert row is not None
        return row.business_id


def _withdraw(
    repository: SqlStockWithdrawals, reason: WithdrawalReason, *lines: tuple[int, str]
) -> None:
    repository.add(
        Withdrawal.of(
            reason,
            TODAY,
            None,
            tuple(WithdrawalLine.of(variety_id, quantity) for variety_id, quantity in lines),
            TODAY,
            datetime(2026, 10, 2, 19, 0, tzinfo=UTC),
        )
    )


def test_history_orders_a_sale_line_and_a_withdrawal_line_by_recording_and_costs_both(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety(client, "Lavanda")
    other_id = _variety(client, "Menta")
    _entry(client, variety_id, grams="10", total_cost=10_000)
    _entry(client, other_id, grams="10", total_cost=50_000)
    sale = client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "4"}]}
    )
    assert sale.status_code == 201, sale.text
    business_id = _business_of(engine, variety_id)

    with Session(engine) as session:
        withdrawals = SqlStockWithdrawals(session, business_id)
        _withdraw(withdrawals, WithdrawalReason.OWN_USE, (variety_id, "3"), (other_id, "1"))
        grouped = history(
            SqlStockEntries(session, business_id),
            SqlDraws(session, business_id),
            withdrawals,
            None,
        )

    lots, draws = grouped[variety_id]
    assert [(d.source, d.quantity) for d in draws] == [
        (DrawSource.SALE_LINE, Quantity.of("4")),
        (DrawSource.OWN_USE, Quantity.of("3")),
    ]
    # 10 g @ $10 000: the sale takes 4 g ($4 000) and the withdrawal the next 3 g ($3 000).
    assert [(r.costed, r.pending) for r in allocate(lots, draws)] == [
        (4_000, Quantity(0)),
        (3_000, Quantity(0)),
    ]


def test_history_narrowed_to_one_variety_gives_that_variety_the_same_draws_and_cost(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety(client, "Lavanda")
    other_id = _variety(client, "Menta")
    _entry(client, variety_id, grams="2", total_cost=4_000)
    _entry(client, other_id, grams="2", total_cost=9_000)
    client.post(
        "/sales", json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "1"}]}
    )
    business_id = _business_of(engine, variety_id)

    with Session(engine) as session:
        withdrawals = SqlStockWithdrawals(session, business_id)
        _withdraw(withdrawals, WithdrawalReason.PROMOTION, (variety_id, "3"), (other_id, "1"))
        entries, draws = SqlStockEntries(session, business_id), SqlDraws(session, business_id)
        everything = history(entries, draws, withdrawals, None)
        narrowed = history(entries, draws, withdrawals, {variety_id})

    assert set(narrowed) == {variety_id}
    assert narrowed[variety_id] == everything[variety_id]
    lots, variety_draws = narrowed[variety_id]
    # One 2 g lot ($4 000): the sale takes 1 g ($2 000), the promotion's 3 g get the
    # last gram ($2 000) and 2 g are pending, never $0.
    assert [(r.costed, r.pending) for r in allocate(lots, variety_draws)] == [
        (2_000, Quantity(0)),
        (2_000, Quantity.of("2")),
    ]
