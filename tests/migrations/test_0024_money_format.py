"""Migration 0024 creates `money_format` and gives every existing business `"$", 0, 0`
(ADR-0058). The shared M3 comparator proves no column that existed before it changed."""

from sqlalchemy import text

from app.db import make_engine
from app.migrations.runner import upgrade_to
from tests.migrations import m3_seed
from tests.migrations.m3 import assert_m3


def test_it_creates_only_money_format_and_changes_nothing_that_existed() -> None:
    assert assert_m3("0023", "0024") == frozenset({"money_format"})


def test_every_seeded_business_gets_one_symbol_dollar_zero_decimals_zero_scale_row() -> None:
    engine = make_engine("sqlite://")
    upgrade_to(engine, "0019")
    with engine.begin() as connection:
        m3_seed.SEED_INCREMENTS["0019"](connection)
    upgrade_to(engine, "0023")

    upgrade_to(engine, "0024")

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT business_id, symbol, decimals, scale FROM money_format ORDER BY 1")
        ).all()
        businesses = connection.execute(text("SELECT id FROM business ORDER BY id")).scalars().all()
    assert len(businesses) > 1
    assert [tuple(row) for row in rows] == [(business, "$", 0, 0) for business in businesses]
