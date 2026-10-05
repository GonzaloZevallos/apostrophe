"""The ports results declares toward each owner (plan: "Ports"; ADR-0013 amendment
GH-70). One port per owning hexagon, each answering only results' own types or
`app.shared` (plan invariant: results' ports answer only types declared under
`app/results/` or `app/shared/`; no port signature or answer carries a class or
`Literal` from another hexagon) — not the owner's own domain or adapter types, so
results never imports another hexagon's `domain/` or `application/` (ADR-0006).

Every port is built `(Session, business_id)` per request (plan: "Wiring"); none of
them takes `today` itself for anything but `StockFigures.read`, which needs it to
compute days left the way `stock_level` does.

What results needs from the rest of the business (docs/adr/0006, ADR-0020). Each
port is built for one business; a record of another business is, from here, a record
that does not exist (docs/adr/0004).

`DrawCosts` and `StockFigures.read`'s `draws` both answer one row per draw — a sale
line (sold or gifted) or a negative adjustment (shortfall) — already costed through
`app.stock.domain.allocation.allocate`, called once per variety for the whole business
(the plan's invariant: no other code multiplies grams by a cost or rounds a cost of
goods). `SalesLedger`, `PaymentsLedger`, `ExpensesLedger` and `Purchases` answer plain,
already-stored facts; `period_figures.scan`/`totals_between` is the one place any of
these are summed, for both `GET /analysis` and `GET /panel` (ADR-0013 amendment GH-70:
the panel is no longer a second author of profit or cash). The record shapes
themselves live in `app.results.domain.ledger`: a port is application, but what it
answers is a domain type.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Literal, Protocol

from app.results.domain.ledger import (
    DrawRow,
    ExpenseRecord,
    PaymentRecord,
    PurchaseRecord,
    SaleRecord,
)
from app.shared.grams import Grams

# Results' own copy of stock's `Status` (stock-domain), with the same values: results
# never imports `app.stock.domain` (ADR-0006), so this port answers its own literal
# instead of the owner's.
StockStatus = Literal["no_entries", "sold_out", "low", "ok"]


@dataclass(frozen=True)
class StockRow:
    variety_id: int
    name: str
    grams: Grams
    status: StockStatus
    sold_out_since: date | None
    threshold: Grams | None
    days_left: int | None


@dataclass(frozen=True)
class StockFiguresAnswer:
    rows: tuple[StockRow, ...]
    draws: tuple[DrawRow, ...]


class StockFigures(Protocol):
    """One `lots_and_draws` load answers the panel's stock rows and its draws
    together (plan invariant): implemented in `app/stock/adapters/`. `read_panel`
    feeds `draws` into `period_figures.scan`, exactly as `DrawCosts.rows()` feeds
    `analyse` — never a second cost-of-goods or purchases sum here."""

    def read(self, today: date) -> StockFiguresAnswer: ...


@dataclass(frozen=True)
class DebtorRow:
    customer_id: int
    name: str
    balance: int
    owing_since: date


@dataclass(frozen=True)
class Debts:
    """`debtors` arrives in `debtors()` order (payments-domain): oldest debt first,
    ties broken by `fold`ed name then id. The panel's own teaser re-sorts (by balance,
    then owing since, then name) and cuts this; it never re-queries for it."""

    total_owed: int
    sales_owing_count: int
    debtors: tuple[DebtorRow, ...]


class DebtSummary(Protocol):
    """Implemented in `app/payments/adapters/`, over `view_accounts.debtors()`."""

    def read(self) -> Debts: ...


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
    the earliest stock entry of any origin, for the first record (ADR-0020: "First
    record" is the minimum date across sales, stock entries, payments and expenses).
    Built for one business."""

    def purchases(self) -> Sequence[PurchaseRecord]:
        """Purchase-origin entries only."""
        ...

    def earliest_entry_day(self) -> date | None:
        """The earliest stock entry of any origin, or `None` with no stock entry at
        all yet."""
        ...
