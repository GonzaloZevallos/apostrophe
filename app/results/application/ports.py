"""What results needs from the rest of the business (docs/adr/0006, ADR-0013). Each
port is built for one business; a record of another business is, from here, a record
that does not exist (docs/adr/0004).

`DrawCosts` answers one row per draw — a sale line (sold or gifted) or a negative
adjustment (shortfall) — already costed through `app.stock.domain.allocation.allocate`,
called once per variety for the whole business (the plan's invariant: no other code
multiplies grams by a cost or rounds a cost of goods). The other four ports answer
plain, already-stored facts; `period_figures` is the one place they are summed. The
record shapes themselves live in `app.results.domain.ledger`: a port is application,
but what it answers is a domain type.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from typing import Protocol

from app.results.domain.ledger import (
    DrawRow,
    ExpenseRecord,
    PaymentRecord,
    PurchaseRecord,
    SaleRecord,
)

__all__ = [
    "DrawCosts",
    "DrawRow",
    "ExpenseRecord",
    "ExpensesLedger",
    "PaymentRecord",
    "PaymentsLedger",
    "PurchaseRecord",
    "Purchases",
    "SaleRecord",
    "SalesLedger",
]


class DrawCosts(Protocol):
    """Every draw of one business, costed fresh on every read (ADR-0009). Built for
    one business."""

    def rows(self) -> Sequence[DrawRow]: ...


class SalesLedger(Protocol):
    """Every sale of one business. Built for one business."""

    def all(self) -> Sequence[SaleRecord]: ...


class PaymentsLedger(Protocol):
    """Every payment of one business, on-the-spot and later alike. Built for one
    business."""

    def all(self) -> Sequence[PaymentRecord]: ...


class ExpensesLedger(Protocol):
    """Every expense of one business. Built for one business."""

    def all(self) -> Sequence[ExpenseRecord]: ...


class Purchases(Protocol):
    """Flower purchases, for cash and the purchases line (CONTEXT.md: Purchase), and
    the earliest stock entry of any origin, for the first record (ADR-0013: "First
    record" is the minimum date across sales, stock entries, payments and expenses).
    Built for one business."""

    def purchases(self) -> Sequence[PurchaseRecord]:
        """Purchase-origin entries only."""
        ...

    def earliest_entry_day(self) -> date | None:
        """The earliest stock entry of any origin, or `None` with no stock entry at
        all yet."""
        ...
