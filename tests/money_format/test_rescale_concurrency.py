"""The rescale against a writer on another connection (docs/adr/0058, the rescale ADR).

Seam: the `ApplyDecimals` use case with the real adapter, and `GET /expenses` through
`TestClient` for the figures, over a file-backed SQLite database, two engines in one thread
and a short busy timeout on the test engines only. The amount write is an expense: it stores
through the same money helper a sale does, and the interleavings are the same ones.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import MoneyScaleChanged, make_engine, money_scale_factor
from app.expenses.adapters.sql_expenses import SqlExpenses
from app.expenses.domain.expense import Expense
from app.money_format.adapters.sql_money_format_writer import SqlMoneyFormatWriter
from app.money_format.domain.rescale import RescaleBusy
from tests.business_removal.adapters.seed import PINNED, build_app
from tests.conftest import MovableClock
from tests.money_format.rescale_world import World, apply, dump, money_format_of

SEEDED_TOTAL = Decimal(112233)
SALE = Decimal(100)
BOTH = Decimal(112333)


@pytest.fixture
def second(world: World) -> Iterator[Engine]:
    """A second engine on the same file, and a short busy timeout on both."""
    engine = world.engine
    other = make_engine(engine.url.render_as_string(hide_password=False))
    for each in (engine, other):
        event.listen(each, "connect", _short_timeout)
        each.dispose()
    yield other
    other.dispose()


def _short_timeout(dbapi_connection: object, _record: object) -> None:
    getattr(dbapi_connection, "execute")("PRAGMA busy_timeout=50")


def _record_sale(session: Session, business_id: int, category_id: int) -> None:
    """One amount write of 100 currency units, then its commit."""
    recorded = datetime(2026, 10, 3, 15, 0, tzinfo=UTC)
    expense = Expense.of(
        recorded.date(), category_id, int(SALE), "Una venta", recorded.date(), recorded
    )
    SqlExpenses(session, business_id).add(expense)
    session.commit()


def _category(engine: Engine, business_id: int) -> int:
    with engine.connect() as connection:
        return int(
            connection.execute(
                text(
                    "SELECT id FROM expense_category WHERE business_id = :b AND name = 'Servicios'"
                ),
                {"b": business_id},
            ).scalar_one()
        )


def _total(world: World) -> Decimal:
    """The month's expenses total the API answers for the business."""
    application, engine = build_app(world.path, MovableClock(PINNED), 0)
    try:
        with TestClient(application) as client:
            client.headers["Authorization"] = f"Bearer {world.token}"
            answered = client.get("/expenses", params={"month": "2026-10"})
    finally:
        engine.dispose()
    assert answered.status_code == 200, answered.text
    total = json.loads(answered.text, parse_float=Decimal, parse_int=Decimal)["total"]
    assert isinstance(total, Decimal)
    return total


def _rescaling(second: Engine, business_id: int) -> Session:
    """A session on the other connection that has run the rescale and not committed."""
    session = Session(second)
    SqlMoneyFormatWriter(session).apply_decimals(business_id, 2)
    return session


def test_a_sale_that_read_the_old_scale_fails_loudly_and_a_retry_stores_the_right_value(
    world: World, second: Engine
) -> None:
    target = world.target
    category = _category(world.engine, target)
    with Session(world.engine) as sale:
        assert money_scale_factor(sale, target) == 100
        apply(second, target, 2)

        with pytest.raises(MoneyScaleChanged):
            _record_sale(sale, target, category)
        sale.rollback()

        _record_sale(sale, target, category)

    assert money_format_of(second, target) == (2, 2)
    assert _total(world) == BOTH


def test_a_sale_against_a_rescale_holding_the_lock_fails_busy_and_a_retry_stores_at_scale_2(
    world: World, second: Engine
) -> None:
    target = world.target
    category = _category(world.engine, target)
    rescale = _rescaling(second, target)
    with Session(world.engine) as sale:
        with pytest.raises(OperationalError):
            _record_sale(sale, target, category)
        sale.rollback()
        rescale.commit()

        _record_sale(sale, target, category)
    rescale.close()

    assert money_format_of(world.engine, target) == (2, 2)
    assert _total(world) == BOTH


def test_a_sale_committed_before_the_rescale_is_rescaled_with_the_rest(
    world: World, second: Engine
) -> None:
    target = world.target
    with Session(world.engine) as sale:
        _record_sale(sale, target, _category(world.engine, target))
    assert _total(world) == BOTH

    apply(second, target, 2)

    assert _total(world) == BOTH
    assert money_format_of(world.engine, target) == (2, 2)


def test_a_busy_database_makes_the_rescale_change_nothing(world: World, second: Engine) -> None:
    target = world.target
    before = dump(world.engine, target)
    with Session(second) as holder:
        holder.execute(
            text("UPDATE expense SET detail = detail WHERE business_id = :b"), {"b": target}
        )

        with pytest.raises(RescaleBusy) as raised:
            apply(world.engine, target, 2)

        assert str(raised.value) == "the database was busy: nothing changed, run it again"
        holder.rollback()

    assert dump(world.engine, target) == before
    assert money_format_of(world.engine, target) == (0, 0)
    assert _total(world) == SEEDED_TOTAL
