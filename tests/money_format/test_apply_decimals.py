"""`ApplyDecimals` over stored values (docs/adr/0058, the rescale ADR).

Seam: the `ApplyDecimals` use case with the real adapter, over a file-backed SQLite
database seeded through the app's own routes at scale 0. The columns that are rescaled are
the ones tagged `info["money"]` in `app.tables.metadata`, read here the same way, so a
column added later is covered without touching this file.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, insert, literal, select
from sqlalchemy.orm import Session

from app.money_format.domain.rescale import (
    AmountTooLargeToRescale,
    DecimalsBelowRecordedAmounts,
)
from tests.money_format.rescale_world import (
    World,
    apply,
    dump,
    money_columns,
    money_format_of,
    run,
    updates,
)
from tests.statement_log import captured_statements


def test_the_seed_reaches_every_tagged_column_and_every_nullable_one(world: World) -> None:
    engine, target, *_ = world
    columns = money_columns()
    assert len(columns) >= 9
    with Session(engine) as session:
        for table, name, nullable in columns:
            column = table.c[name]
            non_zero = session.scalar(
                select(func.count(column)).where(table.c.business_id == target, column != 0)
            )
            assert non_zero, f"{table.name}.{name} holds no non-zero value for the business"
            if nullable:
                nulls = session.scalar(
                    select(func.count()).where(table.c.business_id == target, column.is_(None))
                )
                assert nulls, f"{table.name}.{name} holds no NULL for the business"


def test_the_rescale_multiplies_every_tagged_column_by_100_and_leaves_the_rest(
    world: World,
) -> None:
    engine, target, other, *_ = world
    before, other_before = dump(engine, target), dump(engine, other)
    assert money_format_of(engine, target) == (0, 0)

    apply(engine, target, 2)

    after = dump(engine, target)
    tagged = {(table.name, name) for table, name, _ in money_columns()}
    for name, rows in before.items():
        assert len(after[name]) == len(rows), name
        if name == "money_format":
            continue
        for old, new in zip(rows, after[name], strict=True):
            for key, value in old.items():
                expected = value * 100 if (name, key) in tagged and value is not None else value
                assert new[key] == expected, f"{name}.{key}"
    assert dump(engine, other) == other_before
    # Committed, and visible on a fresh connection: the guard did not roll it back.
    assert money_format_of(engine, target) == (2, 2)
    assert money_format_of(engine, other) == (0, 0)


def test_an_amount_too_large_to_rescale_rolls_everything_back(world: World) -> None:
    engine, target, other, *_ = world
    run(engine, f"UPDATE expense SET amount = {2**62} WHERE business_id = {target}")
    before, other_before = dump(engine, target), dump(engine, other)

    with pytest.raises(AmountTooLargeToRescale) as raised:
        apply(engine, target, 2)

    assert str(raised.value) == "an amount is too large to be rescaled: nothing changed"
    assert dump(engine, target) == before
    assert dump(engine, other) == other_before
    assert money_format_of(engine, target) == (0, 0)


def test_after_the_rescale_only_a_different_decimals_is_written(world: World) -> None:
    engine, target, other, *_ = world
    apply(engine, target, 2)
    amounts = {name: rows for name, rows in dump(engine, target).items() if name != "money_format"}

    for decimals, writes in ((2, 0), (1, 1), (1, 0), (2, 1), (0, 1), (0, 0), (2, 1)):
        with updates(engine) as seen:
            apply(engine, target, decimals)
        changed = sum(rows for _, rows in seen)
        assert changed == writes, (decimals, seen)
        assert money_format_of(engine, target) == (2, decimals)
        for statement, rows in seen:
            if rows:
                assert statement.lstrip().upper().startswith("UPDATE MONEY_FORMAT SET DECIMALS")
    assert {n: r for n, r in dump(engine, target).items() if n != "money_format"} == amounts
    assert money_format_of(engine, other) == (0, 0)


def test_lowering_at_scale_0_to_0_writes_nothing(world: World) -> None:
    engine, target, *_ = world
    with updates(engine) as seen:
        apply(engine, target, 0)
    assert sum(rows for _, rows in seen) == 0
    assert money_format_of(engine, target) == (0, 0)


def test_a_lower_below_the_recorded_amounts_is_refused_and_stores_nothing(world: World) -> None:
    engine, target, *_ = world
    apply(engine, target, 2)
    run(engine, f"UPDATE expense SET amount = 150050 WHERE business_id = {target}")
    before = dump(engine, target)

    with pytest.raises(DecimalsBelowRecordedAmounts) as raised:
        apply(engine, target, 0)

    assert str(raised.value) == "an amount recorded holds more decimals than the new ones"
    assert dump(engine, target) == before
    assert money_format_of(engine, target) == (2, 2)
    # By the remainder, not by a flag: tenths still hold 1500.50 but not 1500.55.
    apply(engine, target, 1)
    run(engine, f"UPDATE money_format SET decimals = 2 WHERE business_id = {target}")
    run(engine, f"UPDATE expense SET amount = 150055 WHERE business_id = {target}")
    with pytest.raises(DecimalsBelowRecordedAmounts):
        apply(engine, target, 1)
    assert money_format_of(engine, target) == (2, 2)


def test_a_lower_within_the_recorded_amounts_is_written(world: World) -> None:
    engine, target, *_ = world
    apply(engine, target, 2)
    run(engine, f"UPDATE expense SET amount = 150050 WHERE business_id = {target}")

    apply(engine, target, 1)

    assert money_format_of(engine, target) == (2, 1)


def test_the_rescale_issues_the_conditional_update_and_one_multiply_per_tagged_column(
    world: World,
) -> None:
    engine, target, *_ = world
    with captured_statements(engine) as statements:
        apply(engine, target, 2)

    updated = [s for s, _ in statements if s.lstrip().upper().startswith("UPDATE")]
    assert updated[0].startswith("UPDATE money_format SET scale")
    multiplied = [s for s in updated if "*" in s]
    assert len(multiplied) == len(money_columns())


def test_amounts_whose_rescaled_sum_overflows_are_refused_and_roll_back(world: World) -> None:
    engine, target, other, *_ = world
    expense = next(table for table, name, _ in money_columns() if table.name == "expense")
    names = [column.name for column in expense.columns if column.name != "id"]
    chosen = [literal(9 * 10**16) if name == "amount" else expense.c[name] for name in names]
    copy = insert(expense).from_select(
        names, select(*chosen).where(expense.c.business_id == target).limit(1)
    )
    for _ in range(2):
        with Session(engine) as session, session.begin():
            session.execute(copy)
    run(engine, f"UPDATE expense SET amount = {9 * 10**16} WHERE business_id = {target}")
    before, other_before = dump(engine, target), dump(engine, other)

    with pytest.raises(AmountTooLargeToRescale):
        apply(engine, target, 2)

    assert dump(engine, target) == before
    assert dump(engine, other) == other_before
    assert money_format_of(engine, target) == (0, 0)
