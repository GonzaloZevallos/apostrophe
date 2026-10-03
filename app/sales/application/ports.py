"""What sales needs from the rest of the business, and the sales repository itself
(docs/adr/0001, docs/adr/0004). Each port is built for one business; a record of
another business is, from here, a record that does not exist.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app.sales.domain.pricing import VarietyPricing
from app.sales.domain.sale import CustomerFact, Sale
from app.shared.grams import Grams


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
class LineCost:
    """One sale line's cost of goods (ADR-0009): `costed` is `None` exactly when none
    of the line's grams is costed yet, never a $0 standing in for "not yet known".
    `pending_grams` is the part of the line with no lot behind it."""

    costed: int | None
    pending_grams: Grams


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
