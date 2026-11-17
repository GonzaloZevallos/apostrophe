"""The lowering check of `SqlMoneyFormatWriter.apply`: one `EXISTS` per column tagged
`info["money"]`, filtered on the business (docs/adr/0080).

Seam: `ApplyMoneyFormat` with the real writer over the scale-0 two-business world. The
columns come from the metadata tags, so a money column added later joins the loop without
touching this file.

Named exception to building rows through the app's routes (CODING_STANDARDS section 5):
most capabilities' domains cannot record an amount with cents yet, so the amount with cents
is planted by hand through the test's own session, after the business was raised to 2.
"""

from __future__ import annotations

import pytest
from sqlalchemy import Table, text

from app.money_format.domain.rescale import DecimalsBelowRecordedAmounts
from tests.money_format.rescale_world import (
    World,
    apply,
    dump,
    money_columns,
    money_format_of,
    run,
)

REFUSED = "an amount recorded holds more decimals than the new ones"
COLUMNS = [(table.name, name) for table, name, _ in money_columns()]


def _symbol(world: World, business_id: int) -> str:
    with world.engine.connect() as connection:
        return str(
            connection.execute(
                text("SELECT symbol FROM money_format WHERE business_id = :b"), {"b": business_id}
            ).scalar_one()
        )


def _plant_cents(world: World, business_id: int, table: Table, name: str) -> None:
    run(
        world.engine,
        f"UPDATE {table.name} SET {name} = {name} + 50 WHERE id = ("
        f"SELECT min(id) FROM {table.name} WHERE business_id = {business_id} "
        f"AND {name} IS NOT NULL)",
    )


def test_the_loop_covers_every_money_column_of_the_metadata(world: World) -> None:
    assert len(COLUMNS) >= 9
    assert COLUMNS == [(table.name, name) for table, name, _ in money_columns()]


@pytest.mark.parametrize(("table_name", "name"), COLUMNS, ids=[f"{t}.{c}" for t, c in COLUMNS])
def test_cents_in_any_money_column_refuse_lowering_and_store_nothing(
    world: World, table_name: str, name: str
) -> None:
    engine, target, other, *_ = world
    table = next(t for t, column, _ in money_columns() if t.name == table_name and column == name)
    apply(engine, target, 2)
    _plant_cents(world, target, table, name)
    before, other_before = dump(engine, target), dump(engine, other)

    with pytest.raises(DecimalsBelowRecordedAmounts) as raised:
        apply(engine, target, 0, "US$")

    assert str(raised.value) == REFUSED
    assert dump(engine, target) == before
    assert dump(engine, other) == other_before
    assert money_format_of(engine, target) == (2, 2)
    assert _symbol(world, target) == "$"


def test_whole_amounts_and_null_columns_never_block_a_lowering(world: World) -> None:
    engine, target, *_ = world
    apply(engine, target, 2)

    change = apply(engine, target, 0, "US$")

    assert (change.symbol_changed, change.decimals_changed) == (True, True)
    assert money_format_of(engine, target) == (2, 0)
    assert _symbol(world, target) == "US$"


def test_cents_in_another_business_never_block_a_lowering(world: World) -> None:
    engine, target, other, *_ = world
    apply(engine, target, 2)
    table = next(t for t, column, _ in money_columns() if t.name == "expense")
    _plant_cents(world, other, table, "amount")

    apply(engine, target, 0)

    assert money_format_of(engine, target) == (2, 0)


def test_a_save_of_the_stored_values_reports_no_change(world: World) -> None:
    engine, target, *_ = world

    change = apply(engine, target, 0)

    assert (change.symbol_changed, change.decimals_changed) == (False, False)
