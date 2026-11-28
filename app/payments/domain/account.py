"""A customer's account as a plain ledger walk (CONTEXT.md: Payment, Balance,
Settlement, Credit; ADR-0012; the ledger-walk ADR
`docs/adr/20261120-the-customer-account-is-a-ledger-walk-not-a-settlement-view.md`).

One row per Sale and one row per later Payment, ordered by `ledger_key`:
`(date, recorded_at, Sale before Payment, id)`. That is a plain ledger walk, not the
Settlement order: a Sale adds what it owes at its start (`opening_owed`) and a
Payment subtracts its full amount, whatever Sales it settles.

A Sale with a Deposit (a partial on-the-spot amount, ADR-20261125) adds its whole total
and is followed at once by a `DepositRow` that subtracts the Deposit, carrying the
Sale's own date. A `DepositRow` is not a Payment: it has no `payment_id`, is never an
entry of the ledger and has no `ledger_key`; like a Payment row it carries `is_partial`.

Every row carries its own `running_balance` and `standing`, read only from
`standing_of`. A row can go below zero mid-ledger (a Payment dated before its Sale, or
recorded before a same-day Sale): its `standing` is then `credit`, a point in the
ledger and never a stored Credit. A Payment row also carries `is_partial`, true only
when the balance after it is still above zero; only this module works it out.

The newest row's running balance equals `settle().balance`, because both sum the same
deltas; `settle()` decides only the Balance, Owing since and standing of the account.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from app.payments.domain.settlement import (
    LaterPaymentEntry,
    Ledger,
    OwedSale,
    Standing,
    settle,
    standing_of,
)
from app.shared.payment_method import PaymentMethodLabel

HowPaid = Literal["paid", "deposit", "owing", "none"]

# A row's own `date` field shadows the `date` type for any field declared after it in
# the same class body; every later annotation in `PaymentRow` (e.g.
# `paid_on`) uses this alias instead (the same device `app/sales/domain/sale.py` uses
# for `SaleDate`).
RowDate = date


def _how_paid(sale: OwedSale) -> HowPaid:
    if sale.is_deposit:
        return "deposit"
    if sale.on_the_spot_method is not None:
        return "paid"
    return "owing" if sale.total > 0 else "none"


@dataclass(frozen=True)
class SaleRow:
    date: RowDate
    running_balance: int
    standing: Standing
    sale_id: int
    number: int
    total: int
    how_paid: HowPaid
    payment_method: PaymentMethodLabel | None
    kind: Literal["sale"] = "sale"


@dataclass(frozen=True)
class PaymentRow:
    """One later Payment, whole: its full amount and whether the balance after it is
    still above zero."""

    date: RowDate
    running_balance: int
    standing: Standing
    payment_id: int
    paid_on: RowDate
    amount: int
    method: PaymentMethodLabel
    is_partial: bool
    kind: Literal["payment"] = "payment"


@dataclass(frozen=True)
class DepositRow:
    """The Deposit of the Sale right before it: its own amount and whether the balance
    after it is still above zero. Never a Payment, so it has no `payment_id`."""

    date: RowDate
    running_balance: int
    standing: Standing
    sale_id: int
    amount: int
    method: PaymentMethodLabel
    is_partial: bool
    kind: Literal["deposit"] = "deposit"


AccountRow = SaleRow | PaymentRow | DepositRow


def _sale_row_adds(sale: OwedSale) -> int:
    """What a Sale row adds to the running balance: its whole total when a Deposit row
    follows to subtract the Deposit, else what it owes at its start."""
    return sale.total if sale.is_deposit else sale.opening_owed


@dataclass(frozen=True)
class Account:
    rows: tuple[AccountRow, ...]
    balance: int
    owing_since: RowDate | None
    standing: Standing


LedgerKey = tuple[date, datetime, int, int]

SALE_RANK = 0
PAYMENT_RANK = 1


def ledger_key(row_date: date, recorded_at: datetime, kind_rank: int, id: int) -> LedgerKey:
    """The account's one sort key: `(date, recorded_at, Sale = 0 / Payment = 1, id)`."""
    return (row_date, recorded_at, kind_rank, id)


def account_of(sales: Sequence[OwedSale], payments: Sequence[LaterPaymentEntry]) -> Account:
    result = settle(Ledger(tuple(sales), tuple(payments)))

    entries: list[tuple[LedgerKey, OwedSale | LaterPaymentEntry]] = [
        (ledger_key(sale.date, sale.recorded_at, SALE_RANK, sale.id), sale) for sale in sales
    ]
    entries += [
        (ledger_key(payment.paid_on, payment.recorded_at, PAYMENT_RANK, payment.id), payment)
        for payment in payments
    ]
    entries.sort(key=lambda entry: entry[0])

    rows: list[AccountRow] = []
    running = 0
    for _, entry in entries:
        if isinstance(entry, OwedSale):
            running += _sale_row_adds(entry)
            rows.append(
                SaleRow(
                    date=entry.date,
                    running_balance=running,
                    standing=standing_of(running),
                    sale_id=entry.id,
                    number=entry.number,
                    total=entry.total,
                    how_paid=_how_paid(entry),
                    payment_method=entry.on_the_spot_method,
                )
            )
            if entry.is_deposit:
                deposit_method = entry.on_the_spot_method
                assert deposit_method is not None, "a Deposit always names its payment method"
                running -= entry.on_the_spot_amount
                rows.append(
                    DepositRow(
                        date=entry.date,
                        running_balance=running,
                        standing=standing_of(running),
                        sale_id=entry.id,
                        amount=entry.on_the_spot_amount,
                        method=deposit_method,
                        is_partial=running > 0,
                    )
                )
            continue
        method = entry.method
        assert method is not None, "an account's own later payments always carry a method"
        running -= entry.amount
        rows.append(
            PaymentRow(
                date=entry.paid_on,
                running_balance=running,
                standing=standing_of(running),
                payment_id=entry.id,
                paid_on=entry.paid_on,
                amount=entry.amount,
                method=method,
                is_partial=running > 0,
            )
        )

    return Account(
        rows=tuple(rows),
        balance=result.balance,
        owing_since=result.owing_since,
        standing=result.standing,
    )
