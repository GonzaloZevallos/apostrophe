"""Settlement: which sale a later payment covers, worked out live, never stored
(CONTEXT.md: Payment, Balance, Owing since, Settlement, Credit, Sales still owing;
ADR-0012).

`settle()` is the one place a customer's balance, owing since, sales still owing and
standing are computed (the plan's invariant): no other module, SQL query or front code
walks or sums sales against payments to show a figure, the guarded insert's backstop
aside.

An on-the-spot payment settles its own sale alone and never enters this walk: a sale
paid on the spot is excluded before matching starts (CONTEXT.md: On-the-spot payment).
Owed sales are matched against later payments oldest debt first, plain FIFO by amount,
whatever a payment's own date — never limited to sales dated on or before it (PRD
round-1, Q1). Whatever a payment has left over every debt is a credit, never floored
to $0 (CONTEXT.md: Credit).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from typing import Literal


class PaymentMethod(StrEnum):
    CASH = "cash"
    TRANSFER = "transfer"


Standing = Literal["owes", "credit", "settled"]


def standing_of(balance: int) -> Standing:
    """The only place a balance's sign is tested (the plan's invariant): every
    sign-dependent label reads `standing`, never a comparison of a raw balance."""
    if balance > 0:
        return "owes"
    if balance < 0:
        return "credit"
    return "settled"


@dataclass(frozen=True)
class OwedSale:
    """One sale of a customer's ledger. `on_the_spot_method` is the method it was
    paid in on the spot, or `None` for a sale left owing; `paid_on_the_spot` is
    derived from it, never stored twice."""

    id: int
    date: date
    recorded_at: datetime
    total: int
    on_the_spot_method: PaymentMethod | None = None

    @property
    def paid_on_the_spot(self) -> bool:
        return self.on_the_spot_method is not None


@dataclass(frozen=True)
class LaterPaymentEntry:
    """A later payment on the ledger. `method` is `None` only for a candidate not
    yet recorded (`settle_candidate`'s own job): `settle`'s walk never reads it, it
    only ever surfaces through the account."""

    id: int
    paid_on: date
    recorded_at: datetime
    amount: int
    method: PaymentMethod | None = None


@dataclass(frozen=True)
class Ledger:
    """One customer's whole settlement input: every sale, on-the-spot ones
    included, and every later payment."""

    sales: tuple[OwedSale, ...]
    payments: tuple[LaterPaymentEntry, ...]


@dataclass(frozen=True)
class Split:
    """The part of a later payment that went to one sale (CONTEXT.md: Settlement)."""

    sale_id: int
    sale_date: date
    amount: int


@dataclass(frozen=True)
class PaymentSettlement:
    """One later payment's own answer: which sales it reached, oldest first, and
    whatever is left over every debt (a credit, `0` when none)."""

    payment_id: int
    splits: tuple[Split, ...]
    leftover: int


@dataclass(frozen=True)
class SaleSettlement:
    """One owed sale's own answer: what is still owed on it, `0` once it is fully
    paid by later payments."""

    sale_id: int
    still_owed: int


@dataclass(frozen=True)
class SettleResult:
    payments: tuple[PaymentSettlement, ...]
    sales: tuple[SaleSettlement, ...]
    balance: int
    owing_since: date | None
    standing: Standing
    still_owing: frozenset[int]


def settle(ledger: Ledger) -> SettleResult:
    """The one pure walk (ADR-0012): owed sales oldest debt first `(date,
    recorded_at, id)`, later payments oldest first `(paid_on, recorded_at, id)`,
    matched by amount alone. Sorts its own inputs, so the result never depends on
    the order sales or payments were recorded in."""
    owed_sales = sorted(
        (sale for sale in ledger.sales if not sale.paid_on_the_spot),
        key=lambda sale: (sale.date, sale.recorded_at, sale.id),
    )
    later_payments = sorted(
        ledger.payments, key=lambda payment: (payment.paid_on, payment.recorded_at, payment.id)
    )

    remaining: dict[int, int] = {sale.id: sale.total for sale in owed_sales}
    order = [sale.id for sale in owed_sales]
    date_by_id = {sale.id: sale.date for sale in owed_sales}

    cursor = 0
    payment_settlements: list[PaymentSettlement] = []
    for payment in later_payments:
        left = payment.amount
        splits: list[Split] = []
        while left > 0 and cursor < len(order):
            sale_id = order[cursor]
            owed = remaining[sale_id]
            if owed <= 0:
                cursor += 1
                continue
            take = min(owed, left)
            splits.append(Split(sale_id, date_by_id[sale_id], take))
            remaining[sale_id] -= take
            left -= take
            if remaining[sale_id] == 0:
                cursor += 1
        payment_settlements.append(PaymentSettlement(payment.id, tuple(splits), left))

    still_owing = frozenset(sale_id for sale_id in order if remaining[sale_id] > 0)
    owing_since = next((date_by_id[sale_id] for sale_id in order if remaining[sale_id] > 0), None)
    balance = sum(sale.total for sale in owed_sales) - sum(
        payment.amount for payment in later_payments
    )

    return SettleResult(
        payments=tuple(payment_settlements),
        sales=tuple(SaleSettlement(sale_id, remaining[sale_id]) for sale_id in order),
        balance=balance,
        owing_since=owing_since,
        standing=standing_of(balance),
        still_owing=still_owing,
    )
