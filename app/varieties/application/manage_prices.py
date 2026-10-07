from datetime import date

from app.shared.grams import Grams
from app.shared.reference import ReferenceRefused
from app.shared.transaction import Transaction
from app.varieties.application.errors import VarietyArchived
from app.varieties.application.manage_varieties import get_variety
from app.varieties.application.ports import Varieties
from app.varieties.domain.variety import PriceEntry


def record_price_entry(
    varieties: Varieties,
    transaction: Transaction,
    variety_id: int,
    effective_from: date,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: Grams | None = None,
) -> PriceEntry:
    variety = get_variety(varieties, variety_id)
    variety.record_price(PriceEntry.of(effective_from, list_price, bulk_price, bulk_minimum))
    try:
        stored = varieties.save(variety)
    except ReferenceRefused:
        transaction.rollback()
        # Gone or archived is the variety's own refusal (`get_variety` raises it for a
        # missing one); a variety still live and present re-raises the signal as it came.
        if get_variety(varieties, variety_id).is_archived:
            raise VarietyArchived(variety_id) from None
        raise
    transaction.commit()
    return next(e for e in stored.price_entries if e.effective_from == effective_from)


def delete_price_entry(
    varieties: Varieties, transaction: Transaction, variety_id: int, entry_id: int
) -> None:
    variety = get_variety(varieties, variety_id)
    variety.delete_price(entry_id)
    varieties.save(variety)
    transaction.commit()


def current_price(varieties: Varieties, variety_id: int, on: date) -> PriceEntry | None:
    return get_variety(varieties, variety_id).current_price(on)
