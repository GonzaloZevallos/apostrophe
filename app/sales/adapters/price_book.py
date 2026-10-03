"""`PriceBook` over `SqlVarieties` (docs/adr/0004): built for one business, so every
price lookup inherits that business's filter."""

from datetime import date

from sqlalchemy.orm import Session

from app.sales.domain.pricing import BulkQuote, PriceQuote, VarietyPricing
from app.varieties.adapters.sql_varieties import SqlVarieties
from app.varieties.domain.variety import PriceEntry


class SqlPriceBook:
    def __init__(self, session: Session, business_id: int) -> None:
        self._varieties = SqlVarieties(session, business_id)

    def for_variety(self, variety_id: int, day: date) -> VarietyPricing | None:
        variety = self._varieties.get(variety_id)
        if variety is None:
            return None
        entry = variety.current_price(day)
        return VarietyPricing(variety_id=variety_id, current=_quote(entry))


def _quote(entry: PriceEntry | None) -> PriceQuote | None:
    if entry is None:
        return None
    bulk = None if entry.bulk is None else BulkQuote(entry.bulk.price, entry.bulk.minimum)
    return PriceQuote(list_price=entry.list_price, bulk=bulk)
