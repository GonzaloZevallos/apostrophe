"""The customer's account as a ledger walk, one row per Sale and one per later
Payment (CONTEXT.md: Payment, Balance, Settlement, Credit; ADR-0012 and the ledger-walk
ADR).

Rows are ordered by `ledger_key`, `(date, recorded_at, Sale before Payment, id)`. The
newest row's running balance always equals `settle().balance`; a row below zero is a
point in the ledger, not a stored Credit.
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta

from app.payments.domain.account import Account, PaymentRow, SaleRow, account_of, ledger_key
from app.payments.domain.settlement import LaterPaymentEntry, Ledger, OwedSale, settle
from app.shared.payment_method import PaymentMethodLabel
from tests.payments.builders import owed_sale

AT = datetime(2026, 9, 1, 10, 0)
CASH = PaymentMethodLabel(1, "Cash", "banknote")
TRANSFER = PaymentMethodLabel(2, "Transfer", "bank")


def _account(sales: list[OwedSale], payments: list[LaterPaymentEntry]) -> Account:
    """`account_of`, after asserting the ties every case shares: the newest row is the
    Balance, and every Payment row's mark is `running_balance > 0`."""
    account = account_of(sales, payments)
    result = settle(Ledger(tuple(sales), tuple(payments)))
    if account.rows:
        assert account.rows[-1].running_balance == result.balance
    assert account.balance == result.balance
    for row in account.rows:
        if isinstance(row, PaymentRow):
            assert row.is_partial == (row.running_balance > 0)
    return account


def _ids(account: Account) -> list[tuple[str, int]]:
    return [
        (row.kind, row.sale_id if isinstance(row, SaleRow) else row.payment_id)
        for row in account.rows
    ]


def test_a_sale_paid_on_the_spot_moves_the_running_balance_by_zero() -> None:
    sale = owed_sale(1, date(2026, 9, 1), 100, on_the_spot_method=TRANSFER)

    account = _account([sale], [])

    [row] = account.rows
    assert isinstance(row, SaleRow)
    assert row.how_paid == "paid"
    assert row.payment_method == TRANSFER
    assert row.running_balance == 0
    assert row.standing == "settled"
    assert account.balance == 0


def test_a_sale_left_owing_moves_the_running_balance_by_its_total() -> None:
    sale = owed_sale(1, date(2026, 9, 1), 100)

    account = _account([sale], [])

    [row] = account.rows
    assert isinstance(row, SaleRow)
    assert row.how_paid == "owing"
    assert row.running_balance == 100
    assert row.standing == "owes"


def test_a_zero_total_sale_shows_no_payment_label() -> None:
    sale = owed_sale(1, date(2026, 9, 1), 0)

    account = _account([sale], [])

    [row] = account.rows
    assert isinstance(row, SaleRow)
    assert row.how_paid == "none"
    assert row.running_balance == 0


def test_sale_rows_carry_the_sale_number_not_the_id() -> None:
    sale = owed_sale(7, date(2026, 9, 1), 100, number=3)

    [row] = _account([sale], []).rows

    assert isinstance(row, SaleRow)
    assert row.sale_id == 7
    assert row.number == 3


def test_a_later_payment_fully_covering_a_sale_zeroes_the_running_balance() -> None:
    sale = owed_sale(1, date(2026, 9, 1), 100)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 100, CASH)

    account = _account([sale], [payment])

    sale_row, payment_row = account.rows
    assert isinstance(sale_row, SaleRow) and sale_row.running_balance == 100
    assert isinstance(payment_row, PaymentRow)
    assert payment_row.amount == 100
    assert payment_row.method == CASH
    assert payment_row.running_balance == 0
    assert payment_row.standing == "settled"
    assert payment_row.is_partial is False


def test_a_payment_covering_several_sales_is_still_one_row_with_its_full_amount() -> None:
    older = owed_sale(1, date(2026, 9, 1), 60)
    newer = owed_sale(2, date(2026, 9, 10), 60)
    payment = LaterPaymentEntry(10, date(2026, 9, 15), AT, 90, TRANSFER)

    account = _account([older, newer], [payment])

    assert _ids(account) == [("sale", 1), ("sale", 2), ("payment", 10)]
    payment_row = account.rows[-1]
    assert isinstance(payment_row, PaymentRow)
    assert payment_row.amount == 90
    assert payment_row.running_balance == 30
    assert payment_row.is_partial is True


def test_a_payment_beyond_every_debt_is_one_negative_row_in_credit() -> None:
    sale = owed_sale(1, date(2026, 9, 1), 100)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 130, CASH)

    account = _account([sale], [payment])

    assert _ids(account) == [("sale", 1), ("payment", 10)]
    payment_row = account.rows[-1]
    assert isinstance(payment_row, PaymentRow)
    assert payment_row.running_balance == -30
    assert payment_row.standing == "credit"
    assert payment_row.is_partial is False
    assert account.standing == "credit"
    assert account.balance == -30


def test_a_credit_left_after_a_deleted_sale_is_the_last_row_and_equals_the_balance() -> None:
    kept = owed_sale(2, date(2026, 9, 3), 40)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 100, CASH)

    account = _account([kept], [payment])

    assert account.rows[-1].running_balance == -60
    assert account.balance == -60
    assert account.rows[-1].standing == "credit"


def test_a_payment_dated_before_its_sale_is_a_negative_row_and_not_partial() -> None:
    sale = owed_sale(1, date(2026, 9, 20), 100)
    payment = LaterPaymentEntry(10, date(2026, 9, 1), AT, 100, CASH)

    account = _account([sale], [payment])

    payment_row, sale_row = account.rows
    assert isinstance(payment_row, PaymentRow)
    assert payment_row.running_balance == -100
    assert payment_row.standing == "credit"
    assert payment_row.is_partial is False
    assert isinstance(sale_row, SaleRow)
    assert sale_row.running_balance == 0
    assert sale_row.standing == "settled"
    assert account.balance == 0


def test_a_same_day_payment_recorded_before_the_sale_comes_first() -> None:
    sale = owed_sale(1, date(2026, 9, 5), 50, recorded_at=AT + timedelta(hours=2))
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT, 50, CASH)

    account = _account([sale], [payment])

    assert _ids(account) == [("payment", 10), ("sale", 1)]
    assert account.rows[0].running_balance == -50
    assert account.rows[1].running_balance == 0


def test_a_same_day_payment_recorded_after_the_sale_comes_after() -> None:
    sale = owed_sale(1, date(2026, 9, 5), 50, recorded_at=AT)
    payment = LaterPaymentEntry(10, date(2026, 9, 5), AT + timedelta(hours=2), 50, CASH)

    account = _account([sale], [payment])

    assert _ids(account) == [("sale", 1), ("payment", 10)]
    assert [row.running_balance for row in account.rows] == [50, 0]


def test_an_equal_date_and_recorded_at_tie_puts_the_sale_first_so_no_row_is_negative() -> None:
    sale = owed_sale(5, date(2026, 9, 5), 50, recorded_at=AT)
    payment = LaterPaymentEntry(1, date(2026, 9, 5), AT, 50, CASH)

    account = _account([sale], [payment])

    assert _ids(account) == [("sale", 5), ("payment", 1)]
    assert all(row.running_balance >= 0 for row in account.rows)


def test_a_payment_recorded_earlier_comes_first_even_with_a_higher_sale_id() -> None:
    sale = owed_sale(1, date(2026, 9, 5), 50, recorded_at=AT + timedelta(minutes=1))
    payment = LaterPaymentEntry(99, date(2026, 9, 5), AT, 30, CASH)

    account = _account([sale], [payment])

    assert _ids(account) == [("payment", 99), ("sale", 1)]


def test_two_sales_on_one_date_are_ordered_by_recorded_at_before_id() -> None:
    first_id = owed_sale(1, date(2026, 9, 5), 10, recorded_at=AT + timedelta(hours=1))
    second_id = owed_sale(2, date(2026, 9, 5), 20, recorded_at=AT)

    account = _account([first_id, second_id], [])

    assert _ids(account) == [("sale", 2), ("sale", 1)]
    assert [row.running_balance for row in account.rows] == [20, 30]


def test_ledger_key_is_date_then_recorded_at_then_sale_before_payment_then_id() -> None:
    day = date(2026, 9, 5)
    keys = [
        ledger_key(day, AT, 0, 9),
        ledger_key(day, AT, 1, 1),
        ledger_key(day, AT + timedelta(seconds=1), 0, 1),
        ledger_key(date(2026, 9, 6), AT - timedelta(days=3), 0, 1),
    ]
    assert keys == sorted(keys)
    assert ledger_key(day, AT, 0, 9) < ledger_key(day, AT, 1, 1)
    assert ledger_key(day, AT, 0, 1) < ledger_key(day, AT, 0, 2)


def test_partial_marks_above_zero_true_exactly_zero_and_below_false() -> None:
    sale = owed_sale(1, date(2026, 9, 1), 100)
    payments = [
        LaterPaymentEntry(10, date(2026, 9, 2), AT, 40, CASH),
        LaterPaymentEntry(11, date(2026, 9, 3), AT, 60, CASH),
        LaterPaymentEntry(12, date(2026, 9, 4), AT, 5, CASH),
    ]

    account = _account([sale], payments)

    marks = [
        (row.running_balance, row.is_partial) for row in account.rows if isinstance(row, PaymentRow)
    ]
    assert marks == [(60, True), (0, False), (-5, False)]


def test_an_on_the_spot_sale_never_gets_a_payment_row() -> None:
    on_the_spot = owed_sale(1, date(2026, 9, 1), 100, on_the_spot_method=CASH)
    owed = owed_sale(2, date(2026, 9, 2), 50)
    later = LaterPaymentEntry(10, date(2026, 9, 5), AT, 80, TRANSFER)

    account = _account([on_the_spot, owed], [later])

    assert _ids(account) == [("sale", 1), ("sale", 2), ("payment", 10)]
    assert [row.running_balance for row in account.rows] == [0, 50, -30]


def test_ledgers_in_any_order_keep_the_newest_row_equal_to_the_balance() -> None:
    rng = random.Random(829)
    methods = [CASH, TRANSFER]
    for _ in range(300):
        sales = [
            owed_sale(
                sale_id,
                date(2026, 9, 1) + timedelta(days=rng.randint(0, 5)),
                rng.randint(0, 200),
                recorded_at=AT + timedelta(minutes=rng.randint(0, 600)),
                on_the_spot_method=rng.choice([None, CASH]),
            )
            for sale_id in range(1, rng.randint(0, 6) + 1)
        ]
        payments = [
            LaterPaymentEntry(
                100 + payment_id,
                date(2026, 9, 1) + timedelta(days=rng.randint(0, 5)),
                AT + timedelta(minutes=rng.randint(0, 600)),
                rng.randint(1, 200),
                rng.choice(methods),
            )
            for payment_id in range(rng.randint(0, 5))
        ]
        rng.shuffle(sales)
        rng.shuffle(payments)

        account = _account(sales, payments)

        assert len(account.rows) == len(sales) + len(payments)
        recorded = {("sale", sale.id): sale.recorded_at for sale in sales}
        recorded |= {("payment", payment.id): payment.recorded_at for payment in payments}
        keys = [
            ledger_key(row.date, recorded[(row.kind, identity)], rank, identity)
            for row, rank, identity in (
                (row, 0, row.sale_id) if isinstance(row, SaleRow) else (row, 1, row.payment_id)
                for row in account.rows
            )
        ]
        assert keys == sorted(keys)
