"""The commit-time money scale guard in app/db.py (docs/adr/0058): a write that cached a
scale factor never commits once the business's stored scale has moved under it.

Seam: the `Session` commit (the `before_commit` listener), over two file-backed SQLite
engines on one database, one thread. The second engine plays the rescale committing between
the first session's read of the factor and its commit. Throwaway `money_format` and
`amounts` tables, so no hexagon is needed.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, UniqueConstraint, delete, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import MoneyScaleChanged, make_engine, money_scale_factor, money_stored_value
from app.shared.money import Money
from tests.statement_log import captured_statements

_metadata = MetaData()
_money_format = Table(
    "money_format",
    _metadata,
    Column("id", Integer, primary_key=True),
    Column("business_id", Integer, nullable=False),
    Column("scale", Integer, nullable=False),
    Column("decimals", Integer, nullable=False, server_default="2"),
    UniqueConstraint("business_id", name="uq_money_format_business_id"),
)
_amounts = Table(
    "amounts",
    _metadata,
    Column("id", Integer, primary_key=True),
    Column("business_id", Integer, nullable=False),
    Column("amount", Integer, nullable=False),
)
FIXED_MESSAGE = "the money scale changed during the write"


@pytest.fixture
def engines(tmp_path: Path) -> Iterator[tuple[Engine, Engine]]:
    url = f"sqlite:///{tmp_path / 'guard.db'}"
    first, second = make_engine(url), make_engine(url)
    _metadata.create_all(first)
    with Session(first) as seed, seed.begin():
        seed.execute(
            insert(_money_format),
            [{"business_id": 1, "scale": 0}, {"business_id": 2, "scale": 2}],
        )
    yield first, second
    first.dispose()
    second.dispose()


def _record_sale(session: Session, business_id: int, money: Money) -> None:
    """The use case under test: a stored amount from the cached factor, then a commit."""
    session.execute(
        insert(_amounts).values(
            business_id=business_id, amount=money_stored_value(session, business_id, money)
        )
    )
    session.commit()


def _rescale(engine: Engine) -> None:
    with Session(engine) as other, other.begin():
        other.execute(
            _money_format.update().where(_money_format.c.business_id == 1).values(scale=2)
        )


def _amounts_stored(engine: Engine) -> list[int]:
    with Session(engine) as reader:
        return list(reader.execute(select(_amounts.c.amount).order_by(_amounts.c.id)).scalars())


def test_a_write_that_cached_the_old_scale_does_not_commit_after_the_rescale(
    engines: tuple[Engine, Engine],
) -> None:
    first, second = engines
    with Session(first) as session:
        assert money_scale_factor(session, 1) == 100
        _rescale(second)

        with pytest.raises(MoneyScaleChanged) as raised:
            _record_sale(session, 1, Money(1100))

        assert str(raised.value) == FIXED_MESSAGE
        session.rollback()
    assert _amounts_stored(second) == []


def test_after_a_rollback_the_same_use_case_stores_the_amount_at_the_new_scale(
    engines: tuple[Engine, Engine],
) -> None:
    first, second = engines
    with Session(first) as session:
        money_scale_factor(session, 1)
        _rescale(second)
        with pytest.raises(MoneyScaleChanged):
            _record_sale(session, 1, Money(1100))
        session.rollback()

        _record_sale(session, 1, Money(1100))

    assert _amounts_stored(second) == [1100]


def test_the_error_carries_no_code_and_no_data(engines: tuple[Engine, Engine]) -> None:
    first, second = engines
    with Session(first) as session:
        money_scale_factor(session, 1)
        _rescale(second)
        with pytest.raises(MoneyScaleChanged) as raised:
            _record_sale(session, 1, Money(1100))
        session.rollback()

    assert not hasattr(raised.value, "code")
    assert raised.value.args == (FIXED_MESSAGE,)
    assert "1100" not in str(raised.value)


def test_the_whole_cache_is_forgotten_when_the_guard_refuses(
    engines: tuple[Engine, Engine],
) -> None:
    first, second = engines
    with Session(first) as session:
        money_scale_factor(session, 1)
        money_scale_factor(session, 2)
        _rescale(second)
        with pytest.raises(MoneyScaleChanged):
            _record_sale(session, 2, Money(500))
        assert "money_scale_factors" not in session.info
        session.rollback()


def test_a_cached_business_whose_scale_did_not_move_commits(
    engines: tuple[Engine, Engine],
) -> None:
    first, _second = engines
    with Session(first) as session:
        _record_sale(session, 1, Money(1100))
        _record_sale(session, 2, Money(1150))

    assert _amounts_stored(first) == [11, 1150]


def test_a_cached_business_without_a_money_format_row_raises_nothing_new(
    engines: tuple[Engine, Engine],
) -> None:
    first, second = engines
    with Session(first) as session:
        money_scale_factor(session, 2)
        with Session(second) as other, other.begin():
            other.execute(delete(_money_format).where(_money_format.c.business_id == 2))
        session.execute(insert(_amounts).values(business_id=2, amount=5))
        session.commit()

    assert _amounts_stored(second) == [5]


def test_a_commit_with_an_empty_cache_issues_no_statement_of_its_own(
    engines: tuple[Engine, Engine],
) -> None:
    first, _second = engines
    with Session(first) as session:
        session.execute(insert(_amounts).values(business_id=1, amount=3))
        with captured_statements(first) as statements:
            session.commit()

    assert not any("money_format" in statement for statement, _ in statements)


def test_a_commit_re_reads_the_scale_once_for_each_cached_business(
    engines: tuple[Engine, Engine],
) -> None:
    first, _second = engines
    with Session(first) as session:
        money_scale_factor(session, 1)
        money_scale_factor(session, 2)
        with captured_statements(first) as statements:
            session.commit()

    reads = [statement for statement, _ in statements if "money_format" in statement]
    assert len(reads) == 2
