"""`PriceBook` over `SqlVarieties` (docs/adr/0004): built for one business, so every
price lookup inherits that business's filter.

`PlannedPriceBook` answers the same shape from the plain `PriceHistoryRow`s of an
import's plan phase, before anything is written: no database, no variety id, a
caller-assigned local ordinal instead (the plan's invariant: ids inside an owner check
are local ordinals that never leave that call). Neither book reimplements "latest on or
before" — that stays `Variety.current_price`'s job alone.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date

from sqlalchemy.orm import Session

from app.products.adapters.sql_products import SqlProducts
from app.products.domain.product import PriceEntry, Product, ProductName, ProductRuleBroken
from app.sales.domain.pricing import BulkQuote, PriceQuote, VarietyPricing
from app.spreadsheet_import.domain.rows import PriceHistoryRow


class SqlPriceBook:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id
        self._varieties = SqlProducts(session, business_id)

    def for_variety(self, variety_id: int, day: date) -> VarietyPricing | None:
        variety = self._varieties.get(variety_id)
        # An archived variety takes no new sale line: it answers as a missing one
        # (docs/adr/0032).
        if variety is None or variety.is_archived:
            return None
        entry = variety.current_price(day)
        # The VIP price is a row of the VIP type, already on the entry (docs/adr/0059).
        return VarietyPricing(
            variety_id=variety_id, current=_quote(entry, None if entry is None else entry.vip_price)
        )


class PlannedPriceBook:
    """A price book built once per import run from the plain price-history rows,
    grouped by the local ordinal the caller assigned each variety key. Rows that
    would break a varieties.md rule (a duplicate date, bad bulk terms, ...) are left
    out of the planned history silently: `VarietiesImport.check_price_history`, over
    the same rows, is what reports them."""

    def __init__(
        self,
        price_history: Sequence[PriceHistoryRow],
        variety_keys: Mapping[str, str],
        ordinals: Mapping[str, int],
    ) -> None:
        grouped: dict[int, list[PriceHistoryRow]] = {}
        names: dict[int, str] = {}
        for row in price_history:
            key = variety_keys.get(row.variety)
            if key is None:
                continue
            ordinal = ordinals.get(key)
            if ordinal is None:
                continue
            grouped.setdefault(ordinal, []).append(row)
            names.setdefault(ordinal, row.variety)
        self._varieties = {
            ordinal: _build_variety(names[ordinal], rows) for ordinal, rows in grouped.items()
        }

    def for_variety(self, variety_id: int, day: date) -> VarietyPricing | None:
        return _planned_pricing(self._varieties.get(variety_id), variety_id, day)


def _planned_pricing(variety: Product | None, variety_id: int, day: date) -> VarietyPricing | None:
    if variety is None:
        return None
    entry = variety.current_price(day)
    # The import writes every entry with a bulk price with VIP price = bulk price
    # (docs/adr/0034), so the plan prices it the same way.
    vip_price = None if entry is None or entry.bulk is None else entry.bulk.price
    return VarietyPricing(variety_id=variety_id, current=_quote(entry, vip_price))


def _build_variety(name_source: str, rows: Sequence[PriceHistoryRow]) -> Product:
    variety = Product(ProductName.of(name_source))
    for row in rows:
        try:
            entry = PriceEntry.of(row.effective, row.list_price, row.bulk_price, row.bulk_minimum)
            variety.record_price(entry)
        except ProductRuleBroken:
            continue
    return variety


def _quote(entry: PriceEntry | None, vip_price: int | None) -> PriceQuote | None:
    if entry is None:
        return None
    bulk = None if entry.bulk is None else BulkQuote(entry.bulk.price, entry.bulk.minimum)
    return PriceQuote(list_price=entry.list_price, bulk=bulk, vip_price=vip_price)
