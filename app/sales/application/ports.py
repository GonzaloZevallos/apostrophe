"""What sales needs from the rest of the business, and the sales repository itself
(docs/adr/0001, docs/adr/0004). Each port is built for one business; a record of
another business is, from here, a record that does not exist.
"""

from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from types import MappingProxyType
from typing import Protocol

from app.sales.domain.pricing import VarietyPricing
from app.sales.domain.sale import CustomerFact, Sale, SaleLine
from app.shared.pricing_settings import PricingSettings
from app.shared.quantity import Quantity


class PriceBook(Protocol):
    """A business's varieties, read for pricing. Built for one business."""

    def for_variety(self, variety_id: int, day: date) -> VarietyPricing | None:
        """`None` when the variety does not exist in this business. A variety that
        exists but has no current price on `day` is a `VarietyPricing` whose
        `current` is `None`."""
        ...


class CustomerFacts(Protocol):
    """A business's customers, read for the facts pricing and sales need. Built for
    one business."""

    def get(self, customer_id: int) -> CustomerFact | None:
        """`None` when the customer does not exist in this business."""
        ...


class PricingSettingsReader(Protocol):
    """The business's pricing switches (docs/adr/0034). Built for one business; read
    once per save, and that one value prices every line of the save."""

    def current(self) -> PricingSettings: ...


class Sales(Protocol):
    """The sales of one business (docs/adr/0004): built for it, every statement
    filters on it, and it never commits (CODING_STANDARDS §9) — the use case commits
    once, through `Transaction`. There is no general `save`: a sale's lines and
    on-the-spot payment are fixed once recorded, so the only writes are `add`,
    `assign_customer` and `delete`."""

    def add(self, sale: Sale) -> Sale:
        """Insert the sale with its lines and payment; return it with ids."""
        ...

    def get(self, sale_id: int) -> Sale | None: ...

    def list(self, date_from: date | None, date_to: date | None) -> list[Sale]:
        """Both ends inclusive and optional; an inverted range answers `[]`. Ordered
        by `(sale_date DESC, id DESC)`."""
        ...

    def assign_customer(self, sale_id: int, customer_id: int) -> None:
        """Only on a sale that has none: an update guarded by `customer_id IS NULL`
        on the sale and its payment. Raises `CustomerAlreadyAssigned` when the sale
        already has one."""
        ...

    def delete(self, sale_id: int) -> None:
        """A hard delete: the sale, its lines and its payment."""
        ...


@dataclass(frozen=True)
class SaleViewCustomer:
    """A sale's customer as a screen needs it (docs/adr/0011): the current name and
    VIP flag, read fresh — not as they were at recording time (ADR-0003)."""

    id: int
    name: str
    vip: bool


@dataclass(frozen=True)
class SaleViewLine:
    """One stored `SaleLine`, with its variety's current name attached."""

    line: SaleLine
    variety_name: str


@dataclass(frozen=True)
class SaleView:
    """A sale labelled with what a screen needs to show it (docs/adr/0011): the
    stored `Sale` itself, its customer's current name and VIP flag (`None` for a
    sale without one), and each line's variety name. Read-only: nothing here is
    ever written back."""

    sale: Sale
    customer: SaleViewCustomer | None
    lines: tuple[SaleViewLine, ...]


class SaleViews(Protocol):
    """Sales joined with the names a screen needs (docs/adr/0011), for one business.
    A read port, like `CustomerFacts`: `SqlSales` answers it directly, over the same
    rows `Sales` writes, never a second store."""

    def get_view(self, sale_id: int) -> SaleView | None:
        """`None` when the sale does not exist in this business."""
        ...

    def list_views(self, date_from: date | None, date_to: date | None) -> Sequence[SaleView]:
        """Same ordering and range semantics as `Sales.list`."""
        ...


@dataclass(frozen=True)
class CustomerSettlement:
    """One customer's settlement as sales reads it: the signed `balance` and, per sale
    id, the amount still owed. `still_owed` holds exactly the sales `settle()` reports
    (every sale not paid on the spot, a paid one at 0) and is read-only."""

    balance: int
    still_owed: Mapping[int, int]

    def __post_init__(self) -> None:
        object.__setattr__(self, "still_owed", MappingProxyType(dict(self.still_owed)))


class OwingSales(Protocol):
    """Which of a business's sales settlement still shows as owed (CONTEXT.md: Sales
    still owing), from the customers' own payments. Built for one business.

    Sales never imports `app.payments` (CODING_STANDARDS section 1; the plan's
    invariant): the one implementation,
    `app.payments.adapters.settlements.SqlOwingSales`, is wired onto
    `app.state.owing_sales` in `app/main.py` and reached from here only through this
    port — the same shape `LineCosts` already uses for stock.
    """

    def still_owing(self, customer_ids: Collection[int]) -> frozenset[int]:
        """The ids of sales of these customers that are not yet fully paid once
        later payments are applied oldest debt first. A sale with no customer is
        never in it: settlement never sees one."""
        ...

    def settlement_of(self, customer_id: int) -> CustomerSettlement:
        """The customer's balance and the amount still owed per sale for every sale
        `settle()` reports: every sale not paid on the spot, a paid one at 0; sales
        paid on the spot are absent. A customer with no ledger answers a balance of 0
        and an empty mapping."""
        ...


class BusinessNames(Protocol):
    """The current name of the business, read fresh on every call. Built for one
    business."""

    def current(self) -> str | None:
        """`None` when the business has no row."""
        ...


@dataclass(frozen=True)
class LineCost:
    """One sale line's cost of goods (ADR-0009): `costed` is `None` exactly when none
    of the line's grams is costed yet, never a $0 standing in for "not yet known".
    `pending_quantity` is the part of the line with no lot behind it."""

    costed: int | None
    pending_quantity: Quantity


class LineCosts(Protocol):
    """Cost of goods for the lines of one sale, allocated fresh on every read — never
    frozen, never stored on the line itself (ADR-0009). Built for one business.

    Sales never imports `app.stock` (CODING_STANDARDS section 1): the one
    implementation, `app.stock.adapters.line_costs.SqlLineCosts`, is wired onto
    `app.state.line_costs` in `app/main.py` and reached from here only through this
    port.
    """

    def for_sale(self, sale: Sale) -> list[LineCost]:
        """One `LineCost` per line of `sale`, in the same order as `sale.lines`."""
        ...
