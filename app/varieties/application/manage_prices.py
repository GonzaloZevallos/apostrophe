from datetime import date

from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from app.shared.transaction import Transaction
from app.varieties.application.errors import VarietyArchived
from app.varieties.application.manage_varieties import get_variety
from app.varieties.application.ports import PricingSettingsReader, Varieties
from app.varieties.domain.variety import PriceEntry, Variety


def record_price_entry(
    varieties: Varieties,
    settings: PricingSettingsReader,
    transaction: Transaction,
    variety_id: int,
    effective_from: date,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: Quantity | None = None,
    vip_price: int | None = None,
) -> PriceEntry:
    """A rule that is off stores nothing on the new entry, whatever was sent, and nothing
    is copied forward from an earlier entry (docs/adr/0034). The settings are read once,
    before the entry is built, so a dropped value is never validated."""
    variety = get_variety(varieties, variety_id)
    switches = settings.current()
    if not switches.is_bulk_pricing:
        bulk_price, bulk_minimum = None, None
    if not switches.is_vip_customers:
        vip_price = None
    entry = PriceEntry.of(effective_from, list_price, bulk_price, bulk_minimum, vip_price=vip_price)
    return _record(varieties, transaction, variety, entry)


def record_imported_price_entry(
    varieties: Varieties,
    transaction: Transaction,
    variety_id: int,
    effective_from: date,
    list_price: int,
    bulk_price: int | None,
    bulk_minimum: Quantity | None,
    vip_price: int | None,
) -> PriceEntry:
    """The spreadsheet import's own write: it has already switched on what its sheet
    needs, so the entry is stored as the sheet says (docs/adr/0034)."""
    variety = get_variety(varieties, variety_id)
    entry = PriceEntry.of(effective_from, list_price, bulk_price, bulk_minimum, vip_price=vip_price)
    return _record(varieties, transaction, variety, entry)


def _record(
    varieties: Varieties, transaction: Transaction, variety: Variety, entry: PriceEntry
) -> PriceEntry:
    variety.record_price(entry)
    try:
        stored = varieties.save(variety)
    except ReferenceRefused:
        transaction.rollback()
        # Gone or archived is the variety's own refusal (`get_variety` raises it for a
        # missing one); a variety still live and present re-raises the signal as it came.
        variety_id = variety.id
        assert variety_id is not None
        if get_variety(varieties, variety_id).is_archived:
            raise VarietyArchived(variety_id) from None
        raise
    transaction.commit()
    return next(e for e in stored.price_entries if e.effective_from == entry.effective_from)


def delete_price_entry(
    varieties: Varieties, transaction: Transaction, variety_id: int, entry_id: int
) -> None:
    variety = get_variety(varieties, variety_id)
    variety.delete_price(entry_id)
    varieties.save(variety)
    transaction.commit()


def current_price(varieties: Varieties, variety_id: int, on: date) -> PriceEntry | None:
    return get_variety(varieties, variety_id).current_price(on)
