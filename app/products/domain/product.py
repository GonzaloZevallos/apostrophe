"""A variety and its price history (CONTEXT.md: Variety, Price entry, Current price).

`Variety` is the aggregate root: its price entries are only recorded or deleted
through it, so "one price entry per variety per effective date" holds in one place.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from typing import ClassVar

from app.shared.names import NameProblem, collapse_spaces, name_key, name_problem
from app.shared.quantity import Quantity

NAME_MAX_LENGTH = 60


class ProductRuleBroken(ValueError):
    """A rule of varieties and their prices was broken; the message says which."""

    code: ClassVar[str] = "variety.rule_broken"


class InvalidName(ProductRuleBroken):
    code: ClassVar[str] = "variety.name_invalid"


class InvalidPriceEntry(ProductRuleBroken):
    code: ClassVar[str] = "variety.price_entry_invalid"


class VipPriceNotBelowList(ProductRuleBroken):
    code: ClassVar[str] = "variety.vip_price_not_below_list"


class DuplicateEffectiveDate(ProductRuleBroken):
    code: ClassVar[str] = "variety.duplicate_effective_date"


class UnknownPriceEntry(ProductRuleBroken):
    code: ClassVar[str] = "variety.price_entry_not_found"


class ProductArchived(LookupError):
    """An archived variety is read-only: for anything new it is gone (docs/product/varieties.md)."""

    code: ClassVar[str] = "variety.archived"

    def __init__(self, product_id: int | None = None) -> None:
        super().__init__("the variety is archived")
        self.product_id = product_id


@dataclass(frozen=True)
class ProductName:
    """A variety's name, with inner whitespace collapsed. Two names that differ only in
    case are the same name (`key`)."""

    value: str

    def __post_init__(self) -> None:
        problem = name_problem(self.value, NAME_MAX_LENGTH)
        if problem is NameProblem.EMPTY:
            raise InvalidName("a variety needs a name")
        if problem is NameProblem.UNTRIMMED:
            raise InvalidName("a variety name has no leading, trailing or repeated spaces")
        if problem is NameProblem.TOO_LONG:
            raise InvalidName(f"a variety name has at most {NAME_MAX_LENGTH} characters")

    @classmethod
    def of(cls, raw: str) -> ProductName:
        return cls(collapse_spaces(raw))

    @property
    def key(self) -> str:
        return name_key(self.value)


@dataclass(frozen=True)
class BulkTerms:
    price: int
    minimum: Quantity


@dataclass(frozen=True)
class PriceEntry:
    """Prices are whole pesos per gram (docs/adr/0001)."""

    effective_from: date
    list_price: int
    bulk: BulkTerms | None = None
    # For VIP customers (CONTEXT.md: VIP price). `None` means no VIP price; it is never
    # compared with the bulk price.
    vip_price: int | None = None
    id: int | None = None

    def __post_init__(self) -> None:
        if self.list_price <= 0:
            raise InvalidPriceEntry("the list price must be positive")
        if self.bulk is not None:
            self._check_bulk(self.bulk)
        if self.vip_price is not None:
            if self.vip_price <= 0:
                raise InvalidPriceEntry("the VIP price must be positive")
            if self.vip_price >= self.list_price:
                raise VipPriceNotBelowList("the VIP price must be lower than the list price")

    def _check_bulk(self, bulk: BulkTerms) -> None:
        if bulk.price <= 0:
            raise InvalidPriceEntry("the bulk price must be positive")
        if bulk.price >= self.list_price:
            raise InvalidPriceEntry("the bulk price must be lower than the list price")
        if not bulk.minimum.is_positive:
            raise InvalidPriceEntry("the bulk minimum must be more than zero grams")

    @classmethod
    def of(
        cls,
        effective_from: date,
        list_price: int,
        bulk_price: int | None = None,
        bulk_minimum: Quantity | None = None,
        id: int | None = None,
        vip_price: int | None = None,
    ) -> PriceEntry:
        if bulk_price is None and bulk_minimum is None:
            return cls(effective_from, list_price, None, vip_price, id)
        if bulk_price is None or bulk_minimum is None:
            raise InvalidPriceEntry("a bulk price and a bulk minimum go together")
        return cls(effective_from, list_price, BulkTerms(bulk_price, bulk_minimum), vip_price, id)


class NameHolder(Enum):
    """Who holds a name within one business: a live variety, or an archived one that
    keeps its name reserved (docs/adr/0032)."""

    LIVE = "live"
    ARCHIVED = "archived"


@dataclass
class Product:
    name: ProductName
    unit_id: int
    price_entries: tuple[PriceEntry, ...] = ()
    id: int | None = None
    archived_at: datetime | None = None

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def archive(self, at: datetime) -> None:
        """Takes the variety out of every list and picker. Idempotent: the first instant
        stays. Never refused because of history; only deleting is guarded by it."""
        if self.archived_at is None:
            self.archived_at = at

    def restore(self) -> None:
        self.archived_at = None

    def _require_live(self) -> None:
        if self.is_archived:
            raise ProductArchived

    def rename(self, name: ProductName) -> None:
        self._require_live()
        self.name = name

    def record_price(self, entry: PriceEntry) -> None:
        self._require_live()
        if any(e.effective_from == entry.effective_from for e in self.price_entries):
            raise DuplicateEffectiveDate(
                f"{self.name.value} already has a price effective from {entry.effective_from}"
            )
        self.price_entries = (*self.price_entries, entry)

    def delete_price(self, entry_id: int) -> None:
        """A mistaken entry is deleted, never rewritten (docs/adr/0003)."""
        self._require_live()
        remaining = tuple(e for e in self.price_entries if e.id != entry_id)
        if len(remaining) == len(self.price_entries):
            raise UnknownPriceEntry(f"{self.name.value} has no price entry {entry_id}")
        self.price_entries = remaining

    def current_price(self, on: date) -> PriceEntry | None:
        effective = (e for e in self.price_entries if e.effective_from <= on)
        return max(effective, key=lambda e: e.effective_from, default=None)

    def price_history(self) -> tuple[PriceEntry, ...]:
        """Newest first."""
        return tuple(sorted(self.price_entries, key=lambda e: e.effective_from, reverse=True))
