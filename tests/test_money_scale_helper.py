"""The money adapter helper in app/db.py (docs/adr/0058): the stored scale is read only
here, as a factor in hundredths per stored unit, and a write is exact or raises.

Over an in-memory SQLite with a throwaway `money_format` table, so no hexagon is needed.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, UniqueConstraint, insert, text
from sqlalchemy.orm import Session

from app.db import MoneyFormatMissing, make_engine, money_scale_factor, money_stored_value
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
    plan = session.execute(
        text("EXPLAIN QUERY PLAN SELECT scale FROM money_format WHERE business_id = :b"),
        {"b": 1},
    ).all()
    details = " ".join(str(row[-1]) for row in plan)
    assert "SEARCH" in details
    assert "USING INDEX" in details
    assert "(business_id=?)" in details
    assert "SCAN" not in details
