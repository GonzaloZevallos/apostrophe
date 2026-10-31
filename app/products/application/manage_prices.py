from datetime import date

from app.products.application.errors import ProductArchived
from app.products.application.manage_products import get_product
from app.products.application.ports import PricingSettingsReader, Products, UnitsReader
from app.products.domain.product import PriceEntry, Product
from app.shared.quantity import Quantity, TooManyDecimals
from app.shared.reference import ReferenceRefused
from app.shared.transaction import Transaction


def record_price_entry(
    products: Products,
    settings: PricingSettingsReader,
    units: UnitsReader,
    transaction: Transaction,
    product_id: int,
    effective_from: date,
    list_price: int,
    bulk_price: int | None = None,
    bulk_minimum: Quantity | None = None,
    vip_price: int | None = None,
) -> PriceEntry:
    """A rule that is off stores nothing on the new entry, whatever was sent, and nothing
    is copied forward from an earlier entry (docs/adr/0034). The settings are read once,
    before the entry is built, so a dropped value is never validated."""
    product = get_product(products, product_id)
    switches = settings.current()
    if not switches.is_bulk_pricing:
        bulk_price, bulk_minimum = None, None
    if not switches.is_vip_customers:
        vip_price = None
    entry = PriceEntry.of(effective_from, list_price, bulk_price, bulk_minimum, vip_price=vip_price)
    return _record(products, units, transaction, product, entry)


def record_imported_price_entry(
    products: Products,
    units: UnitsReader,
    transaction: Transaction,
    product_id: int,
    effective_from: date,
    list_price: int,
    bulk_price: int | None,
    bulk_minimum: Quantity | None,
    vip_price: int | None,
) -> PriceEntry:
    """The spreadsheet import's own write: it has already switched on what its sheet
    needs, so the entry is stored as the sheet says (docs/adr/0034)."""
    product = get_product(products, product_id)
    entry = PriceEntry.of(effective_from, list_price, bulk_price, bulk_minimum, vip_price=vip_price)
    return _record(products, units, transaction, product, entry)


def _bulk_minimum_admitted(units: UnitsReader, product_id: int, entry: PriceEntry) -> bool:
    """Whether the entry's bulk minimum fits the product's unit; an entry with no bulk
    terms has nothing to check. A product missing from the map is an internal error."""
    if entry.bulk is None:
        return True
    unit = units.units_of([product_id])[product_id]
    return unit.admits(entry.bulk.minimum)


def _record(
    products: Products,
    units: UnitsReader,
    transaction: Transaction,
    product: Product,
    entry: PriceEntry,
) -> PriceEntry:
    product_id = product.id
    assert product_id is not None
    if not _bulk_minimum_admitted(units, product_id, entry):
        raise TooManyDecimals()
    product.record_price(entry)
    try:
        stored = products.save(product)
    except ReferenceRefused:
        transaction.rollback()
        # Gone or archived is the variety's own refusal (`get_variety` raises it for a
        # missing one); a variety still live and present re-raises the signal as it came.
        if get_product(products, product_id).is_archived:
            raise ProductArchived(product_id) from None
        raise
    # The unit may have lost decimals since the first read: ask again, before committing.
    if not _bulk_minimum_admitted(units, product_id, entry):
        transaction.rollback()
        raise TooManyDecimals()
    transaction.commit()
    return next(e for e in stored.price_entries if e.effective_from == entry.effective_from)


def delete_price_entry(
    products: Products, transaction: Transaction, product_id: int, entry_id: int
) -> None:
    product = get_product(products, product_id)
    product.delete_price(entry_id)
    products.save(product)
    transaction.commit()


def current_price(products: Products, product_id: int, on: date) -> PriceEntry | None:
    return get_product(products, product_id).current_price(on)
