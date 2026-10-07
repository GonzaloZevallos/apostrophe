"""A customer's account, laid out from `settle()`'s result (CONTEXT.md: Payment,
Balance, Settlement, Credit; ADR-0012).

Rows are ordered `(date, sales before payments, recorded_at, id)` (the plan's
invariant). Every row carries its own `running_balance` and `standing`, read only
from `standing_of`: nothing here compares a raw balance.

The running balance is a plain chronological walk, independent of `settle()`'s own
amount-only matching: a sale row moves it by the sale's whole total (`0` for one paid
on the spot), and a later payment's split moves it by the amount that split applied,
in the payment's own date order. When a payment is dated before the sale it settles
(PRD round-1, Q1), its row's running balance goes below zero and reads "A favor"
until the sale row that follows brings it back — that figure is only this row's own,
never the account's final balance.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime
from typing import Literal

from app.payments.domain.settlement import (
    LaterPaymentEntry,
    Ledger,
    OwedSale,
    PaymentMethod,
    Split,
    Standing,
    settle,
    standing_of,
)

HowPaid = Literal["cash", "transfer", "owing", "none"]

# A row's own `date` field shadows the `date` type for any field declared after it in
# the same class body; every later annotation in `PaymentRow` and `CreditRow` (e.g.
# `paid_on`) uses this alias instead (the same device `app/sales/domain/sale.py` uses
# for `SaleDate`).
RowDate = date


def _how_paid(sale: OwedSale) -> HowPaid:
    match sale.on_the_spot_method:
        case PaymentMethod.CASH:
            return "cash"
        case PaymentMethod.TRANSFER:
            return "transfer"
        case None:
            return "owing" if sale.total > 0 else "none"


@dataclass(frozen=True)
class SaleRow:
    date: RowDate
    running_balance: int
    standing: Standing
    sale_id: int
    total: int
    how_paid: HowPaid
    kind: Literal["sale"] = "sale"


@dataclass(frozen=True)
class PaymentRow:
    """One split of a later payment: the whole payment, for the Borrar cobro
    confirmation, plus the one sale this row's split went to."""

    date: RowDate
    running_balance: int
    standing: Standing
    payment_id: int
    paid_on: RowDate
    amount: int
    method: PaymentMethod
    applied_to: Split
    kind: Literal["payment"] = "payment"


@dataclass(frozen=True)
class CreditRow:
    """Whatever one later payment has left over every debt."""

    date: RowDate
    running_balance: int
    standing: Standing
    payment_id: int
    paid_on: RowDate
    amount: int
    method: PaymentMethod
    credit_amount: int
    kind: Literal["credit"] = "credit"


AccountRow = SaleRow | PaymentRow | CreditRow


@dataclass(frozen=True)
class Account:
    rows: tuple[AccountRow, ...]
    balance: int
    owing_since: RowDate | None
    standing: Standing


_Key = tuple[date, int, datetime, int]


def account_of(sales: Sequence[OwedSale], payments: Sequence[LaterPaymentEntry]) -> Account:
    ledger = Ledger(tuple(sales), tuple(payments))
    result = settle(ledger)
    splits_by_payment = {settlement.payment_id: settlement for settlement in result.payments}

    entries: list[tuple[_Key, int, AccountRow]] = []
    for sale in sales:
        delta = 0 if sale.paid_on_the_spot else sale.total
        sale_row = SaleRow(
            date=sale.date,
            running_balance=0,
            standing="settled",
            sale_id=sale.id,
            total=sale.total,
            how_paid=_how_paid(sale),
        )
        entries.append(((sale.date, 0, sale.recorded_at, sale.id), delta, sale_row))

    for payment in payments:
        method = payment.method
        assert method is not None, "an account's own later payments always carry a method"
        settlement = splits_by_payment[payment.id]
        key = (payment.paid_on, 1, payment.recorded_at, payment.id)
        for split in settlement.splits:
            payment_row = PaymentRow(
                date=payment.paid_on,
                running_balance=0,
                standing="settled",
                payment_id=payment.id,
                paid_on=payment.paid_on,
                amount=payment.amount,
                method=method,
                applied_to=split,
            )
            entries.append((key, -split.amount, payment_row))
        if settlement.leftover > 0:
            credit_row = CreditRow(
                date=payment.paid_on,
                running_balance=0,
                standing="settled",
                payment_id=payment.id,
                paid_on=payment.paid_on,
                amount=payment.amount,
                method=method,
                credit_amount=settlement.leftover,
            )
            entries.append((key, -settlement.leftover, credit_row))

    entries.sort(key=lambda entry: entry[0])

    rows: list[AccountRow] = []
    running = 0
    for _, delta, entry_row in entries:
        running += delta
        rows.append(
            replace(entry_row, running_balance=running, standing=standing_of(running))
        )

    return Account(
        rows=tuple(rows),
        balance=result.balance,
        owing_since=result.owing_since,
        standing=result.standing,
    )
