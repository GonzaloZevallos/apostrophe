"""`settle()`: which sale a later payment covers, worked out live, with no
infrastructure (CONTEXT.md: Balance, Owing since, Settlement, Credit, Sales still
owing; ADR-0012).

Oldest debt first, by amount alone: a later payment's own date never limits which
sale it reaches (PRD round-1, Q1). An on-the-spot payment never enters the walk.
"""

from __future__ import annotations

from datetime import date, datetime

from app.payments.domain.settlement import (
    LaterPaymentEntry,
    Ledger,
    OwedSale,
    PaymentMethod,
    SaleSettlement,
    settle,
    standing_of,
)

AT = datetime(2026, 9, 1, 10, 0)


def _sale(
    id: int,
    day: date,
    total: int,
    recorded_at: datetime = AT,
    on_the_spot: PaymentMethod | None = None,
) -> OwedSale:
    return OwedSale(
        id=id, date=day, recorded_at=recorded_at, total=total, on_the_spot_method=on_the_spot
    )


def _payment(
    id: int,
    paid_on: date,
    amount: int,
    recorded_at: datetime = AT,
    method: PaymentMethod | None = None,
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
    assert result.sales == (SaleSettlement(1, 100),)


def test_an_on_the_spot_sale_never_enters_the_walk() -> None:
    sale = _sale(1, date(2026, 9, 1), 100, on_the_spot=PaymentMethod.CASH)

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
