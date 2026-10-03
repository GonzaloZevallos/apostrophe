"""The ports results declares toward each owner (plan: "Ports"). One port per owning
hexagon, each answering only results' own types or `app.shared` (plan invariant:
results' ports answer only types declared under `app/results/` or `app/shared/`; no
port signature or answer carries a class or `Literal` from another hexagon) — not the
owner's own domain or adapter types, so results never imports another hexagon's
`domain/` or `application/` (ADR-0006).

Every port is built `(Session, business_id)` per request (plan: "Wiring"); none of
them takes `today` itself for anything but `StockFigures.read`, which needs it to
compute days left the way `stock_level` does.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Literal, Protocol

from app.results.domain.periods import Period
from app.shared.grams import Grams


@dataclass(frozen=True)
class SalesSummary:
    total: int
    count: int
    grams_sold: Grams
    grams_gifted: Grams


class PeriodSales(Protocol):
    """Sales figures for each of `periods`, in a fixed number of statements whatever
    the number of sales (plan invariant): implemented in `app/sales/adapters/`."""

    def summaries(self, periods: Sequence[Period]) -> Mapping[Period, SalesSummary]: ...


@dataclass(frozen=True)
class CostOfGoods:
    amount: int
    pending: bool


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
    cost_of_goods: Mapping[Period, CostOfGoods]
    purchases: Mapping[Period, int]


class StockFigures(Protocol):
    """One `lots_and_draws` load answers the panel's stock rows, cost of goods and
    purchases together (plan invariant): implemented in `app/stock/adapters/`."""

    def read(self, today: date, periods: Sequence[Period]) -> StockFiguresAnswer: ...


class PeriodExpenses(Protocol):
    """Implemented in `app/expenses/adapters/`."""

    def totals(self, periods: Sequence[Period]) -> Mapping[Period, int]: ...


class PaymentsReceived(Protocol):
    """Every payment counted on its own `paid_on` date, on-the-spot and later alike
    (PRD: "What Caja counts"): implemented in `app/payments/adapters/`."""

    def totals(self, periods: Sequence[Period]) -> Mapping[Period, int]: ...


@dataclass(frozen=True)
class DebtorRow:
    customer_id: int
    name: str
    balance: int
    owing_since: date


@dataclass(frozen=True)
class Debts:
    """`debtors` arrives in `debtors()` order (payments-domain): by balance, then
    owing since, then name. The panel's own teaser re-sorts and cuts this; it never
    re-queries for it."""

    total_owed: int
    sales_owing_count: int
    debtors: tuple[DebtorRow, ...]


class DebtSummary(Protocol):
    """Implemented in `app/payments/adapters/`, over `view_accounts.debtors()`."""

    def read(self) -> Debts: ...
