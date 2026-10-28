from typing import Protocol

from app.products.domain.product import NameHolder, Product, ProductName
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


class PricingSettingsReader(Protocol):
    """The business's pricing switches, read through the one port varieties declares for
    them (docs/adr/0006); the pricing_settings hexagon implements it, wired in
    `app/main.py`. A business with no row is an error, never a default (docs/adr/0034)."""

    def current(self) -> PricingSettings: ...
