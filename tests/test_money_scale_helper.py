"""The money adapter helper in app/db.py (docs/adr/0058): the stored scale is read only
here, as a factor in hundredths per stored unit, and a write is exact or raises.

Over an in-memory SQLite with a throwaway `money_format` table, so no hexagon is needed.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import (
    Column,
    Connection,
    Integer,
    MetaData,
    Table,
    UniqueConstraint,
    event,
    insert,
    select,
    update,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import (
    MoneyFormatMissing,
    get_session,
    make_engine,
    money_scale_factor,
    money_stored_value,
    scaled,
)
from app.shared.money import Money, MoneyNotRepresentable

_metadata = MetaData()
_money_format = Table(
    "money_format",
    _metadata,
    Column("id", Integer, primary_key=True),
    Column("business_id", Integer, nullable=False),
    Column("scale", Integer, nullable=False),
    UniqueConstraint("business_id", name="uq_money_format_business_id"),
)


@pytest.fixture
def session() -> Iterator[Session]:
    engine = make_engine("sqlite://")
    _metadata.create_all(engine)
    with Session(engine) as db:
        db.execute(
            insert(_money_format),
            [
                {"business_id": 1, "scale": 0},
                {"business_id": 2, "scale": 2},
                {"business_id": 3, "scale": 1},
            ],
        )
        db.commit()
        yield db


def test_scale_0_is_a_hundred_hundredths_per_stored_unit(session: Session) -> None:
    assert money_scale_factor(session, 1) == 100


def test_scale_2_is_one_hundredth_per_stored_unit(session: Session) -> None:
    assert money_scale_factor(session, 2) == 1


def test_a_business_without_a_row_raises_instead_of_defaulting(session: Session) -> None:
    with pytest.raises(MoneyFormatMissing) as raised:
        money_scale_factor(session, 99)
    assert str(raised.value) == "the business has no money format row"


def test_an_unknown_scale_is_refused(session: Session) -> None:
    with pytest.raises(ValueError, match="^the money scale must be 0 or 2$"):
        money_scale_factor(session, 3)


def test_eleven_pesos_is_stored_as_11_at_scale_0(session: Session) -> None:
    assert money_stored_value(session, 1, Money(1100)) == 11


def test_a_fractional_amount_raises_at_scale_0(session: Session) -> None:
    with pytest.raises(MoneyNotRepresentable) as raised:
        money_stored_value(session, 1, Money(1150))
    assert str(raised.value) == "the amount does not fit the business's money scale"
    assert "1150" not in str(raised.value)


def test_a_stored_value_is_the_hundredths_at_scale_2(session: Session) -> None:
    assert money_stored_value(session, 2, Money(1150)) == 1150


def test_the_lookup_searches_the_unique_index_instead_of_scanning(session: Session) -> None:
    """EXPLAINs the very statement `money_scale_factor` sends, captured off the connection,
    so the test fails if the helper's own query stops using the unique index."""
    sent: list[tuple[str, tuple[object, ...]]] = []

    def capture(
        _conn: Connection,
        _cursor: object,
        statement: str,
        parameters: tuple[object, ...],
        _context: object,
        _executemany: bool,
    ) -> None:
        sent.append((statement, parameters))

    bind = session.get_bind()
    event.listen(bind, "before_cursor_execute", capture)
    try:
        money_scale_factor(session, 1)
    finally:
        event.remove(bind, "before_cursor_execute", capture)

    assert len(sent) == 1
    statement, parameters = sent[0]
    plan = session.connection().exec_driver_sql(f"EXPLAIN QUERY PLAN {statement}", parameters)
    details = " ".join(str(row[-1]) for row in plan.all())
    assert "SEARCH" in details
    assert "USING INDEX" in details
    assert "(business_id=?)" in details
    assert "SCAN" not in details


class _Statements:
    """The `money_format` lookups an engine is sent, counted off the connection."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        self.lookups = 0

    def _count(self, *args: object) -> None:
        if "SELECT" in str(args[2]) and "money_format.business_id = ?" in str(args[2]):
            self.lookups += 1

    def __enter__(self) -> _Statements:
        event.listen(self._engine, "before_cursor_execute", self._count)
        return self

    def __exit__(self, *exc: object) -> None:
        event.remove(self._engine, "before_cursor_execute", self._count)


def _engine_of(session: Session) -> Engine:
    bind = session.get_bind()
    assert isinstance(bind, Engine)
    return bind


def _set_scale(engine: Engine, business_id: int, scale: int) -> None:
    with Session(engine) as other, other.begin():
        other.execute(
            update(_money_format)
            .where(_money_format.c.business_id == business_id)
            .values(scale=scale)
        )


def test_a_lookup_is_cached_until_the_outer_transaction_commits(session: Session) -> None:
    engine = _engine_of(session)
    with _Statements(engine) as sent:
        assert money_scale_factor(session, 1) == 100
        assert money_scale_factor(session, 1) == 100
        assert sent.lookups == 1
        session.rollback()  # ends the read-only transaction; another unit of work changes it
        _set_scale(engine, 1, 2)
        assert money_scale_factor(session, 1) == 1
        assert sent.lookups == 2


def test_a_commit_makes_the_next_read_look_again(session: Session) -> None:
    engine = _engine_of(session)
    assert money_scale_factor(session, 1) == 100
    session.commit()
    _set_scale(engine, 1, 2)
    assert money_scale_factor(session, 1) == 1


def test_a_read_before_the_row_exists_raises_and_is_not_cached(session: Session) -> None:
    with pytest.raises(MoneyFormatMissing):
        money_scale_factor(session, 10)
    session.execute(insert(_money_format).values(business_id=10, scale=2))

    assert money_scale_factor(session, 10) == 1
    with pytest.raises(MoneyFormatMissing):
        money_scale_factor(session, 11)


def test_a_rollback_forces_a_new_lookup(session: Session) -> None:
    engine = _engine_of(session)
    with _Statements(engine) as sent:
        assert money_scale_factor(session, 1) == 100
        session.rollback()
        _set_scale(engine, 1, 2)
        assert money_scale_factor(session, 1) == 1
        assert sent.lookups == 2


def test_a_released_savepoint_between_two_reads_costs_one_lookup(session: Session) -> None:
    with _Statements(_engine_of(session)) as sent:
        assert money_scale_factor(session, 1) == 100
        with session.begin_nested():
            session.execute(select(_money_format.c.id))
        assert money_scale_factor(session, 1) == 100
        with session.begin_nested():
            assert money_scale_factor(session, 2) == 1
        assert money_scale_factor(session, 2) == 1
        assert sent.lookups == 2


def test_two_readers_on_one_session_share_one_lookup(session: Session) -> None:
    def read_many(business_id: int) -> list[int]:
        factor = money_scale_factor(session, business_id)
        rows = session.execute(select(scaled(_money_format.c.scale, factor))).scalars()
        return list(rows)

    with _Statements(_engine_of(session)) as sent:
        first = read_many(1)
        second = read_many(1)

    assert first == second
    assert sent.lookups == 1


def test_scaled_multiplies_the_column_inside_the_statement(session: Session) -> None:
    rows = session.execute(
        select(scaled(_money_format.c.scale, 100)).where(_money_format.c.business_id == 2)
    ).scalars()

    assert list(rows) == [200]


def test_scaled_takes_only_the_two_known_factors(session: Session) -> None:
    with pytest.raises(ValueError, match="the money scale factor must be 1 or 100"):
        scaled(_money_format.c.scale, 10)


def test_each_request_makes_its_own_lookup() -> None:
    engine = make_engine("sqlite://")
    _metadata.create_all(engine)
    with Session(engine) as seed, seed.begin():
        seed.execute(insert(_money_format).values(business_id=1, scale=0))
    probe = FastAPI()

    @probe.get("/factor")
    def factor(session: Annotated[Session, Depends(get_session)]) -> int:
        return money_scale_factor(session, 1)

    probe.state.engine = engine
    with TestClient(probe) as http, _Statements(engine) as sent:
        assert http.get("/factor").json() == 100
        assert sent.lookups == 1
        _set_scale(engine, 1, 2)
        assert http.get("/factor").json() == 1
        assert sent.lookups == 2


def test_a_stored_amount_that_is_not_whole_units_answers_500_with_a_fixed_literal(
    app: FastAPI,
) -> None:
    @app.get("/__probe/not-whole")
    def not_whole() -> int:
        return Money(1150).whole_units()

    with TestClient(app, raise_server_exceptions=False) as http:
        response = http.get("/__probe/not-whole")

    assert response.status_code == 500
    assert response.json() == {
        "detail": "the amount is not a whole number of units",
        "code": "money.not_representable",
    }
    assert "1150" not in response.text
