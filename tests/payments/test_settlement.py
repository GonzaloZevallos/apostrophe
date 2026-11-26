"""`settle()`: which sale a later payment covers, worked out live, with no
infrastructure (CONTEXT.md: Balance, Owing since, Settlement, Credit, Sales still
owing; ADR-0012).

Oldest debt first, by amount alone: a later payment's own date never limits which
sale it reaches (PRD round-1, Q1). An on-the-spot payment never enters the walk.
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta

import pytest

from app.payments.domain.settlement import (
    LaterPaymentEntry,
    Ledger,
    OwedSale,
    SaleSettlement,
    settle,
    standing_of,
)
from app.shared.payment_method import PaymentMethodLabel
from tests.payments.builders import owed_sale

AT = datetime(2026, 9, 1, 10, 0)


def _sale(
    id: int,
    day: date,
    total: int,
    recorded_at: datetime = AT,
    on_the_spot: PaymentMethodLabel | None = None,
) -> OwedSale:
    return owed_sale(id, day, total, recorded_at=recorded_at, on_the_spot_method=on_the_spot)


def _payment(
    id: int,
    paid_on: date,
    amount: int,
    recorded_at: datetime = AT,
    method: PaymentMethodLabel | None = None,
) -> LaterPaymentEntry:
    return LaterPaymentEntry(
        id=id, paid_on=paid_on, recorded_at=recorded_at, amount=amount, method=method
    )


def test_standing_of_reads_only_the_sign() -> None:
    assert standing_of(1) == "owes"
    assert standing_of(-1) == "credit"
    assert standing_of(0) == "settled"


def test_an_empty_ledger_is_settled() -> None:
    result = settle(Ledger((), ()))

    assert result.balance == 0
    assert result.owing_since is None
    assert result.standing == "settled"
    assert result.still_owing == frozenset()
    assert result.payments == ()


def test_one_sale_left_owing_with_no_payment_owes_its_whole_total() -> None:
    sale = _sale(1, date(2026, 9, 1), 100)

    result = settle(Ledger((sale,), ()))

    assert result.balance == 100
    assert result.owing_since == date(2026, 9, 1)
    assert result.standing == "owes"
    assert result.still_owing == frozenset({1})
    assert result.sales == (SaleSettlement(1, date(2026, 9, 1), 1, 100),)


def test_an_on_the_spot_sale_never_enters_the_walk() -> None:
    sale = _sale(1, date(2026, 9, 1), 100, on_the_spot=CASH)

    result = settle(Ledger((sale,), ()))

    assert result.balance == 0
    assert result.owing_since is None
    assert result.standing == "settled"
    assert result.still_owing == frozenset()


def test_a_partial_payment_settles_what_it_can_of_the_only_sale() -> None:
    sale = _sale(1, date(2026, 9, 1), 100)
    payment = _payment(10, date(2026, 9, 5), 40)

    result = settle(Ledger((sale,), (payment,)))

    assert result.balance == 60
    assert result.owing_since == date(2026, 9, 1)
    assert result.still_owing == frozenset({1})
    [settlement] = result.payments
    assert settlement.payment_id == 10
    assert settlement.leftover == 0
    [split] = settlement.splits
    assert (split.sale_id, split.sale_date, split.amount) == (1, date(2026, 9, 1), 40)


def test_a_payment_spanning_two_sales_settles_the_oldest_first() -> None:
    older = _sale(1, date(2026, 9, 1), 100)
    newer = _sale(2, date(2026, 9, 10), 100)
    payment = _payment(10, date(2026, 9, 15), 150)

    result = settle(Ledger((older, newer), (payment,)))

    assert result.balance == 50
    assert result.owing_since == date(2026, 9, 10)
    assert result.still_owing == frozenset({2})
    [settlement] = result.payments
    assert [(s.sale_id, s.amount) for s in settlement.splits] == [(1, 100), (2, 50)]


def test_a_payment_beyond_every_debt_leaves_a_credit_never_floored() -> None:
    sale = _sale(1, date(2026, 9, 1), 100)
    payment = _payment(10, date(2026, 9, 5), 130)

    result = settle(Ledger((sale,), (payment,)))

    assert result.balance == -30
    assert result.standing == "credit"
    assert result.owing_since is None
    assert result.still_owing == frozenset()
    [settlement] = result.payments
    assert settlement.leftover == 30


def test_a_payments_own_date_never_limits_which_sale_it_reaches() -> None:
    """A payment dated before the sale it settles still reaches it: settlement is
    oldest debt first by amount alone (PRD round-1, Q1)."""
    later_dated_sale = _sale(1, date(2026, 9, 20), 100)
    earlier_dated_payment = _payment(10, date(2026, 9, 1), 100)

    result = settle(Ledger((later_dated_sale,), (earlier_dated_payment,)))

    assert result.balance == 0
    assert result.standing == "settled"
    [settlement] = result.payments
    [split] = settlement.splits
    assert split.sale_id == 1


def test_the_result_never_depends_on_the_order_things_were_recorded_in() -> None:
    older = _sale(1, date(2026, 9, 1), 60)
    newer = _sale(2, date(2026, 9, 10), 60)
    first_payment = _payment(10, date(2026, 9, 2), 50)
    second_payment = _payment(11, date(2026, 9, 12), 50)

    forward = settle(Ledger((older, newer), (first_payment, second_payment)))
    shuffled = settle(Ledger((newer, older), (second_payment, first_payment)))

    assert forward.balance == shuffled.balance
    assert forward.owing_since == shuffled.owing_since
    assert forward.still_owing == shuffled.still_owing
    assert {p.payment_id: p.splits for p in forward.payments} == {
        p.payment_id: p.splits for p in shuffled.payments
    }


def test_owed_sales_on_the_same_date_are_taken_oldest_recorded_first() -> None:
    first_recorded = _sale(1, date(2026, 9, 1), 50, recorded_at=datetime(2026, 9, 1, 9, 0))
    second_recorded = _sale(2, date(2026, 9, 1), 50, recorded_at=datetime(2026, 9, 1, 10, 0))
    payment = _payment(10, date(2026, 9, 5), 50)

    result = settle(Ledger((second_recorded, first_recorded), (payment,)))

    [settlement] = result.payments
    [split] = settlement.splits
    assert split.sale_id == 1


def test_later_payments_on_the_same_date_are_applied_oldest_recorded_first() -> None:
    sale = _sale(1, date(2026, 9, 1), 100)
    first_recorded = _payment(1, date(2026, 9, 5), 30, recorded_at=datetime(2026, 9, 5, 9, 0))
    second_recorded = _payment(2, date(2026, 9, 5), 30, recorded_at=datetime(2026, 9, 5, 10, 0))

    result = settle(Ledger((sale,), (second_recorded, first_recorded)))

    assert result.balance == 40
    ordered = sorted(result.payments, key=lambda p: p.payment_id)
    assert ordered[0].splits[0].amount == 30
    assert ordered[1].splits[0].amount == 30


CASH = PaymentMethodLabel(1, "Cash", "banknote")
TRANSFER = PaymentMethodLabel(2, "Transfer", "bank")


def _deposit(id: int, day: date, total: int, amount: int, recorded_at: datetime = AT) -> OwedSale:
    return owed_sale(
        id,
        day,
        total,
        recorded_at=recorded_at,
        on_the_spot_method=CASH,
        on_the_spot_amount=amount,
    )


def test_a_deposit_sale_starts_at_its_total_minus_the_deposit() -> None:
    sale = _deposit(1, date(2026, 9, 1), 100, 30)

    result = settle(Ledger((sale,), ()))

    assert sale.opening_owed == 70
    assert sale.is_deposit
    assert result.balance == 70
    assert result.standing == "owes"
    assert result.owing_since == date(2026, 9, 1)
    assert result.still_owing == frozenset({1})
    assert [s.still_owed for s in result.sales] == [70]


def test_a_deposit_sale_is_never_fully_owed_nothing_paid_later_or_covered_later() -> None:
    sale = _deposit(1, date(2026, 9, 1), 100, 30)

    untouched = settle(Ledger((sale,), ()))
    covered = settle(Ledger((sale,), (_payment(10, date(2026, 9, 5), 70),)))

    [still_untouched] = untouched.sales
    [still_covered] = covered.sales
    assert 0 < still_untouched.still_owed < sale.total
    assert still_covered.still_owed == 0
    assert covered.still_owing == frozenset()
    assert covered.owing_since is None
    assert covered.balance == 0


def test_a_later_payment_never_reaches_a_deposit_sale_for_more_than_its_remainder() -> None:
    sale = _deposit(1, date(2026, 9, 1), 100, 30)

    result = settle(Ledger((sale,), (_payment(10, date(2026, 9, 5), 90),)))

    [settlement] = result.payments
    assert [split.amount for split in settlement.splits] == [70]
    assert settlement.leftover == 20
    assert result.balance == -20
    assert result.standing == "credit"


def test_a_deposit_never_covers_an_older_debt() -> None:
    older = _sale(1, date(2026, 9, 1), 100)
    deposit = _deposit(2, date(2026, 9, 2), 100, 40)

    result = settle(Ledger((older, deposit), ()))

    assert {s.sale_id: s.still_owed for s in result.sales} == {1: 100, 2: 60}
    assert result.balance == 160
    assert result.owing_since == date(2026, 9, 1)


def test_a_sale_paid_in_full_on_the_spot_is_still_left_out_of_the_walk() -> None:
    paid = _sale(1, date(2026, 9, 1), 100, on_the_spot=CASH)

    result = settle(Ledger((paid,), ()))

    assert not paid.is_deposit
    assert paid.opening_owed == 0
    assert result.sales == ()
    assert result.balance == 0


def test_zero_total_sales_paid_on_the_spot_and_owing_read_as_before() -> None:
    free_paid = _sale(1, date(2026, 9, 1), 0, on_the_spot=CASH)
    free_owing = _sale(2, date(2026, 9, 2), 0)
    owing = _sale(3, date(2026, 9, 3), 40)

    result = settle(Ledger((free_paid, free_owing, owing), (_payment(10, date(2026, 9, 4), 10),)))

    assert not free_paid.is_deposit
    assert free_paid.opening_owed == 0
    assert {s.sale_id: s.still_owed for s in result.sales} == {2: 0, 3: 30}
    assert result.still_owing == frozenset({3})
    assert result.balance == 30


def test_two_sales_with_equal_date_and_recorded_at_are_taken_by_id() -> None:
    higher = _deposit(2, date(2026, 9, 1), 50, 10)
    lower = _sale(1, date(2026, 9, 1), 50)

    result = settle(Ledger((higher, lower), (_payment(10, date(2026, 9, 5), 50),)))

    assert {s.sale_id: s.still_owed for s in result.sales} == {1: 0, 2: 40}
    assert result.owing_since == date(2026, 9, 1)
    assert result.still_owing == frozenset({2})


def test_a_payment_dated_before_its_deposit_sale_still_covers_it() -> None:
    sale = _deposit(1, date(2026, 9, 10), 100, 30)

    result = settle(Ledger((sale,), (_payment(10, date(2026, 9, 1), 50),)))

    assert [s.still_owed for s in result.sales] == [20]
    assert result.balance == 20
    assert result.owing_since == date(2026, 9, 10)


def test_an_amount_below_zero_is_refused_with_the_rule_alone() -> None:
    with pytest.raises(ValueError) as refused:
        owed_sale(1, date(2026, 9, 1), 100, on_the_spot_method=CASH, on_the_spot_amount=-1)

    assert str(refused.value) == "an on-the-spot amount is never below zero"
    assert not any(character.isdigit() for character in str(refused.value))


def test_an_amount_above_the_total_is_refused_with_the_rule_alone() -> None:
    with pytest.raises(ValueError) as refused:
        owed_sale(1, date(2026, 9, 1), 100, on_the_spot_method=CASH, on_the_spot_amount=101)

    assert str(refused.value) == "an on-the-spot amount never exceeds the sale's total"
    assert not any(character.isdigit() for character in str(refused.value))


def test_an_amount_without_a_method_is_refused_with_the_rule_alone() -> None:
    with pytest.raises(ValueError) as refused:
        owed_sale(1, date(2026, 9, 1), 100, on_the_spot_amount=10)

    assert str(refused.value) == "an on-the-spot amount always names its payment method"
    assert not any(character.isdigit() for character in str(refused.value))


def test_a_method_with_no_amount_on_a_sale_with_a_total_is_refused_with_the_rule_alone() -> None:
    with pytest.raises(ValueError) as refused:
        owed_sale(1, date(2026, 9, 1), 100, on_the_spot_method=CASH, on_the_spot_amount=0)

    assert (
        str(refused.value)
        == "an on-the-spot method on a sale with a total always carries an amount"
    )
    assert not any(character.isdigit() for character in str(refused.value))


def test_the_walk_agrees_with_a_unit_by_unit_oracle_over_fixed_seeds() -> None:
    """The oracle spends each later payment one unit at a time on the oldest sale that
    still owes, starting every sale at total - amount; it never calls `settle()`."""
    for seed in range(200):
        rng = random.Random(1091 + seed)
        sales: list[OwedSale] = []
        for sale_id in range(1, rng.randint(0, 6) + 1):
            total = rng.randint(0, 30)
            shape = rng.choice(["owing", "full", "deposit"])
            if shape == "deposit" and total >= 2:
                sale = _deposit(
                    sale_id,
                    date(2026, 9, 1) + timedelta(days=rng.randint(0, 4)),
                    total,
                    rng.randint(1, total - 1),
                    recorded_at=AT + timedelta(minutes=rng.randint(0, 3)),
                )
            else:
                sale = owed_sale(
                    sale_id,
                    date(2026, 9, 1) + timedelta(days=rng.randint(0, 4)),
                    total,
                    recorded_at=AT + timedelta(minutes=rng.randint(0, 3)),
                    on_the_spot_method=CASH if shape == "full" else None,
                )
            sales.append(sale)
        payments = [
            _payment(
                100 + index,
                date(2026, 9, 1) + timedelta(days=rng.randint(0, 6)),
                rng.randint(1, 20),
                recorded_at=AT + timedelta(minutes=rng.randint(0, 3)),
            )
            for index in range(rng.randint(0, 4))
        ]
        rng.shuffle(sales)
        rng.shuffle(payments)

        owing_at_start = sorted(
            (
                sale
                for sale in sales
                if sale.on_the_spot_method is None or sale.total - sale.on_the_spot_amount > 0
            ),
            key=lambda sale: (sale.date, sale.recorded_at, sale.id),
        )
        expected = {sale.id: sale.total - sale.on_the_spot_amount for sale in owing_at_start}
        for payment in sorted(payments, key=lambda p: (p.paid_on, p.recorded_at, p.id)):
            for _ in range(payment.amount):
                target = next((sale for sale in owing_at_start if expected[sale.id] > 0), None)
                if target is not None:
                    expected[target.id] -= 1
        still_owing = {sale_id for sale_id, owed in expected.items() if owed > 0}
        oldest = next((sale.date for sale in owing_at_start if sale.id in still_owing), None)
        balance = sum(sale.total - sale.on_the_spot_amount for sale in owing_at_start) - sum(
            payment.amount for payment in payments
        )

        result = settle(Ledger(tuple(sales), tuple(payments)))

        assert {s.sale_id: s.still_owed for s in result.sales} == expected, seed
        assert result.still_owing == still_owing, seed
        assert result.owing_since == oldest, seed
        assert result.balance == balance, seed
