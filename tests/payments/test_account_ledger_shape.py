"""The account's ledger shape with Deposits (ADR-20261125): randomised ledgers from
fixed seeds, checked against an oracle written here from the generator's own records,
plus the named ledgers that always run.

The oracle never reads `opening_owed`, `is_deposit`, `ledger_key` or `settle()`: the
last running balance is `sum(total) - sum(every on-the-spot amount) - sum(later
payments)`.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.payments.domain.account import (
    PAYMENT_RANK,
    SALE_RANK,
    Account,
    DepositRow,
    PaymentRow,
    SaleRow,
    account_of,
    ledger_key,
)
from app.payments.domain.settlement import LaterPaymentEntry, Ledger, OwedSale, settle
from app.shared.payment_method import PaymentMethodLabel

CASH = PaymentMethodLabel(1, "Cash", "banknote")
TRANSFER = PaymentMethodLabel(2, "Transfer", "bank")
DAY = date(2026, 9, 1)
NOON = datetime(2026, 9, 1, 12, 0)
SEEDS = range(60)
CATEGORIES = ("paid", "deposit", "owing", "zero_paid", "zero_owing")


@dataclass(frozen=True)
class SaleRecord:
    id: int
    day: date
    recorded_at: datetime
    total: int
    amount: int
    method: PaymentMethodLabel | None


@dataclass(frozen=True)
class PaymentRecord:
    id: int
    day: date
    recorded_at: datetime
    amount: int


def _sale_record(rng: random.Random, id: int) -> SaleRecord:
    day = DAY + timedelta(days=rng.randrange(0, 6))
    recorded_at = NOON + timedelta(hours=rng.randrange(0, 3))
    category = rng.choice(CATEGORIES)
    if category == "paid":
        total = rng.randrange(1, 50) * 100
        return SaleRecord(id, day, recorded_at, total, total, CASH)
    if category == "deposit":
        total = rng.randrange(2, 50) * 100
        return SaleRecord(id, day, recorded_at, total, rng.randrange(1, total // 100) * 100, CASH)
    if category == "owing":
        return SaleRecord(id, day, recorded_at, rng.randrange(1, 50) * 100, 0, None)
    if category == "zero_paid":
        return SaleRecord(id, day, recorded_at, 0, 0, CASH)
    return SaleRecord(id, day, recorded_at, 0, 0, None)


def _payment_record(rng: random.Random, id: int) -> PaymentRecord:
    day = DAY + timedelta(days=rng.randrange(-3, 9))
    recorded_at = NOON + timedelta(hours=rng.randrange(0, 3))
    return PaymentRecord(id, day, recorded_at, rng.randrange(1, 30) * 100)


def _ledger(seed: int) -> tuple[list[SaleRecord], list[PaymentRecord]]:
    rng = random.Random(seed)
    sales = [_sale_record(rng, id) for id in range(1, rng.randrange(2, 9))]
    payments = [_payment_record(rng, id) for id in range(100, 100 + rng.randrange(0, 5))]
    return sales, payments


def _domain(
    sales: list[SaleRecord], payments: list[PaymentRecord]
) -> tuple[list[OwedSale], list[LaterPaymentEntry]]:
    return (
        [
            OwedSale(
                id=sale.id,
                date=sale.day,
                recorded_at=sale.recorded_at,
                total=sale.total,
                number=sale.id,
                on_the_spot_method=sale.method,
                on_the_spot_amount=sale.amount,
            )
            for sale in sales
        ],
        [
            LaterPaymentEntry(
                payment.id, payment.day, payment.recorded_at, payment.amount, TRANSFER
            )
            for payment in payments
        ],
    )


def _is_deposit_record(sale: SaleRecord) -> bool:
    return 0 < sale.amount < sale.total


def _check(sales: list[SaleRecord], payments: list[PaymentRecord]) -> Account:
    owed, entries = _domain(sales, payments)
    account = account_of(owed, entries)

    oracle = (
        sum(sale.total for sale in sales)
        - sum(sale.amount for sale in sales)
        - sum(payment.amount for payment in payments)
    )
    assert account.rows[-1].running_balance == oracle
    assert account.rows[-1].running_balance == settle(Ledger(tuple(owed), tuple(entries))).balance

    deposits = 0
    for index, row in enumerate(account.rows):
        if not isinstance(row, DepositRow):
            continue
        deposits += 1
        owner = account.rows[index - 1]
        assert isinstance(owner, SaleRow)
        assert owner.sale_id == row.sale_id
        assert not hasattr(row, "payment_id")
    assert deposits == sum(1 for sale in sales if _is_deposit_record(sale))

    keys = {
        ("sale", sale.id): ledger_key(sale.day, sale.recorded_at, SALE_RANK, sale.id)
        for sale in sales
    }
    keys |= {
        ("payment", payment.id): ledger_key(
            payment.day, payment.recorded_at, PAYMENT_RANK, payment.id
        )
        for payment in payments
    }
    walked = [
        keys[("sale", row.sale_id)]
        if isinstance(row, SaleRow)
        else keys[("payment", row.payment_id)]
        for row in account.rows
        if not isinstance(row, DepositRow)
    ]
    assert len(walked) == len(sales) + len(payments)
    assert walked == sorted(walked)
    return account


def test_every_seeded_ledger_reconciles_and_keeps_its_deposit_rows_beside_their_sales() -> None:
    saw_deposit = saw_zero_paid = saw_payment_before_deposit = saw_credit = False
    for seed in SEEDS:
        sales, payments = _ledger(seed)
        account = _check(sales, payments)

        saw_deposit |= any(_is_deposit_record(sale) for sale in sales)
        saw_zero_paid |= any(sale.total == 0 and sale.method is not None for sale in sales)
        saw_payment_before_deposit |= any(
            payment.day < sale.day
            for payment in payments
            for sale in sales
            if _is_deposit_record(sale)
        )
        saw_credit |= any(row.standing == "credit" for row in account.rows)

    assert saw_deposit
    assert saw_zero_paid
    assert saw_payment_before_deposit
    assert saw_credit


def test_three_thousand_paid_then_a_five_thousand_deposit_sale_then_a_later_payment() -> None:
    sales = [
        OwedSale(1, DAY, NOON, 3_000, 1, CASH, 3_000),
        OwedSale(2, DAY + timedelta(days=1), NOON, 5_000, 2, CASH, 2_000),
    ]
    payments = [LaterPaymentEntry(10, DAY + timedelta(days=2), NOON, 1_000, TRANSFER)]

    account = account_of(sales, payments)

    assert [(row.kind, row.running_balance) for row in account.rows] == [
        ("sale", 0),
        ("sale", 5_000),
        ("deposit", 3_000),
        ("payment", 2_000),
    ]
    deposit_row = account.rows[2]
    assert isinstance(deposit_row, DepositRow)
    assert deposit_row.is_partial
    assert account.balance == 2_000


def test_a_deposit_fully_covered_later_leaves_the_account_settled() -> None:
    sales = [OwedSale(1, DAY, NOON, 5_000, 1, CASH, 2_000)]
    payments = [LaterPaymentEntry(10, DAY + timedelta(days=1), NOON, 3_000, TRANSFER)]

    account = account_of(sales, payments)

    assert [(row.kind, row.running_balance, row.standing) for row in account.rows] == [
        ("sale", 5_000, "owes"),
        ("deposit", 3_000, "owes"),
        ("payment", 0, "settled"),
    ]
    assert (account.balance, account.standing) == (0, "settled")


def test_a_payment_dated_before_its_deposit_sale_is_a_credit_until_the_sale_arrives() -> None:
    sales = [OwedSale(1, DAY, NOON, 5_000, 1, CASH, 2_000)]
    payments = [LaterPaymentEntry(10, DAY - timedelta(days=1), NOON, 4_000, TRANSFER)]

    account = account_of(sales, payments)

    assert [(row.kind, row.running_balance, row.standing) for row in account.rows] == [
        ("payment", -4_000, "credit"),
        ("sale", 1_000, "owes"),
        ("deposit", -1_000, "credit"),
    ]
    assert account.rows[-1].running_balance == account.balance


def test_two_sales_with_equal_date_and_recorded_at_read_the_lower_id_first() -> None:
    higher = OwedSale(2, DAY, NOON, 500, 2, CASH, 200)
    lower = OwedSale(1, DAY, NOON, 300, 1, None, 0)

    account = account_of([higher, lower], [])

    assert [(row.kind, row.running_balance) for row in account.rows] == [
        ("sale", 300),
        ("sale", 800),
        ("deposit", 600),
    ]
    assert [row.sale_id for row in account.rows if not isinstance(row, PaymentRow)] == [1, 2, 2]


def test_zero_sales_paid_on_the_spot_and_owing_move_nothing() -> None:
    paid = OwedSale(1, DAY, NOON, 0, 1, CASH, 0)
    owing = OwedSale(2, DAY, NOON, 0, 2, None, 0)

    account = account_of([paid, owing], [])

    assert [(row.kind, row.running_balance, row.standing) for row in account.rows] == [
        ("sale", 0, "settled"),
        ("sale", 0, "settled"),
    ]
    assert [row.how_paid for row in account.rows if isinstance(row, SaleRow)] == ["paid", "none"]
