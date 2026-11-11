from collections.abc import Mapping, Sequence
from datetime import date
from typing import Protocol

from app.products.domain.product import NameHolder, Product, ProductName
from app.shared.money import MoneyFormat
from app.shared.pricing_settings import PricingSettings


class Products(Protocol):
    """The varieties of one business: the business is fixed when the store is built,
    so nothing here can reach another business's varieties (docs/adr/0004). `add` and
    `save` write without committing and return the variety as stored, with every id.
    There is no `all()`: a reader chooses `listed()` or `archived()`, or `get()` and
    reads `is_archived` itself."""

    def add(self, product: Product) -> Product: ...

    def get(self, product_id: int) -> Product | None:
        """Any variety of the business, archived or not."""
        ...

    def listed(self) -> list[Product]:
        """The unarchived varieties, by name. There is no read that picks for the caller:
        a caller chooses `listed` or `archived`, or `get` and reads `is_archived`."""
        ...

    def archived(self) -> list[Product]:
        """The archived varieties, by name."""
        ...

    def save(self, product: Product) -> Product: ...

    def name_holder(self, name: ProductName, *, other_than: int | None = None) -> NameHolder | None:
        """Who holds `name` in this business, archived varieties included."""
        ...

    def has_history(self, product_id: int) -> bool:
        """Any sale line or any stock entry of the variety, worked out live."""
        ...

    def remove_price_entries(self, product_id: int) -> None: ...

    def remove_unused(self, product_id: int) -> bool:
        """One guarded delete: the variety goes only while it still has no history, and
        `False` says it did not."""
        ...


class ProductLeaving(Protocol):
    """What another capability removes of its own when a variety is deleted (a stock
    threshold, catalog attributes): built for one business, writes without committing."""

    def leaving(self, product_id: int) -> None: ...


class MoneyFormatReader(Protocol):
    """How the business shows money: its symbol and decimals, never the scale it stores
    amounts at (docs/adr/0055, docs/adr/0058). Built for one business."""

    def current(self) -> MoneyFormat: ...


class PricingSettingsReader(Protocol):
    """The business's pricing switches, read through the one port varieties declares for
    them (docs/adr/0006); the pricing_settings hexagon implements it, wired in
    `app/main.py`. A business with no row is an error, never a default (docs/adr/0034)."""

    def current(self) -> PricingSettings: ...


class VipTypePrices(Protocol):
    """The VIP price of a Price entry, kept as a row of the business's VIP type
    (docs/adr/0059) and reached only through this port: products never imports
    `customer_types`. Built for one business; writes without committing. A business with
    no VIP type has no VIP price to store and none to read."""

    def vip_type_id(self) -> int | None: ...

    def record(self, product_id: int, entry_id: int, effective_on: date, price: int) -> None:
        """One VIP-type row tied to the entry, with its date. Rows are never edited."""
        ...

    def prices_of(self, entry_ids: Sequence[int]) -> Mapping[int, int]:
        """The VIP price by entry id, for the entries that have one: one read whatever the
        number of entries. Empty when the business has no VIP type."""
        ...

    def remove_for_entry(self, entry_id: int) -> None: ...

    def remove_for_product(self, product_id: int) -> None: ...
