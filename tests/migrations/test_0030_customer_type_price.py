"""Migration 0030 adds `customer_type_price` and backfills one VIP-type row for every Price
entry with a `vip_price` in a business that has its VIP type (docs/adr/0059). The shared M3
comparator proves no value that existed before it changed; the rows are read back for
their date, amount and entry; a business without a VIP type gets none."""

from sqlalchemy import text

from app.db import make_engine
from app.migrations.runner import upgrade_to
from tests.migrations import m3_seed
from tests.migrations.m3 import assert_m3


def test_it_creates_only_customer_type_price_and_changes_nothing_that_existed() -> None:
    assert assert_m3("0029", "0030") == frozenset({"customer_type_price"})


def test_the_rows_are_the_entries_with_a_vip_price_in_a_business_with_a_vip_type() -> None:
    engine = make_engine("sqlite://")
    upgrade_to(engine, "0019")
    with engine.begin() as connection:
        m3_seed.SEED_INCREMENTS["0019"](connection)
    upgrade_to(engine, "0029")
    with engine.connect() as connection:
        entries = connection.execute(
            text(
                "SELECT id, business_id, variety_id, effective_on, vip_price FROM price_entry "
                "WHERE vip_price IS NOT NULL ORDER BY id"
            )
        ).all()
        vip_types: dict[int, int] = {
            row.business_id: row.id
            for row in connection.execute(
                text("SELECT business_id, id FROM customer_type WHERE is_vip = 1")
            )
        }
    assert entries

    upgrade_to(engine, "0030")

    with engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT business_id, variety_id, customer_type_id, price, effective_on, "
                "price_entry_id FROM customer_type_price ORDER BY price_entry_id"
            )
        ).all()
    assert [tuple(row) for row in rows] == [
        (e.business_id, e.variety_id, vip_types[e.business_id], e.vip_price, e.effective_on, e.id)
        for e in entries
    ]


def test_a_business_without_a_vip_type_gets_no_row_and_keeps_its_frozen_price() -> None:
    engine = make_engine("sqlite://")
    upgrade_to(engine, "0029")
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO business (id, name, language) VALUES (1, 'Uno', 'en')")
        )
        connection.execute(
            text(
                "INSERT INTO variety (id, business_id, name, name_key) "
                "VALUES (1, 1, 'Lavanda', 'lavanda')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO price_entry (id, business_id, variety_id, effective_on, "
                "list_price, vip_price) VALUES (1, 1, 1, '2026-01-01', 1000, 800)"
            )
        )

    upgrade_to(engine, "0030")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM customer_type_price")).scalar() == 0
        assert connection.execute(text("SELECT vip_price FROM price_entry")).scalar() == 800
