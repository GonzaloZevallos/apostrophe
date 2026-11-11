from datetime import date
from decimal import Decimal

from app.products.application.errors import ProductArchived
from app.products.application.manage_products import get_product
from app.products.application.ports import MoneyFormatReader, PricingSettingsReader, Products
from app.products.domain.product import PriceEntry, Product
from app.shared.money import MoneyFormat, domain_amount_within
from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from app.shared.transaction import Transaction


def record_price_entry(
    products: Products,
    settings: PricingSettingsReader,
    money_format: MoneyFormatReader,
    transaction: Transaction,
    product_id: int,
    effective_from: date,
    list_price: Decimal,
    bulk_price: Decimal | None = None,
    bulk_minimum: Quantity | None = None,
    vip_price: Decimal | None = None,
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
    # Amounts become domain amounts only here, checked by value against the business's
    # decimals (docs/adr/0058); a value the switches dropped is never checked.
    shown = money_format.current()
    entry = PriceEntry.of(
        effective_from,
        _whole_amount(list_price, shown),
        None if bulk_price is None else _whole_amount(bulk_price, shown),
        bulk_minimum,
        vip_price=None if vip_price is None else _whole_amount(vip_price, shown),
    )
    return _record(products, transaction, product, entry)


def _whole_amount(amount: Decimal, shown: MoneyFormat) -> int:
    return domain_amount_within(amount, shown)


def record_imported_price_entry(
    products: Products,
    money_format: MoneyFormatReader,
    transaction: Transaction,
    product_id: int,
    effective_from: date,
    list_price: int,
    bulk_price: int | None,
    bulk_minimum: Quantity | None,
    vip_price: int | None,
) -> PriceEntry:
    """The spreadsheet import's own write: it has already switched on what its sheet
    needs, so the entry is stored as the sheet says (docs/adr/0034). Its amounts are checked
    by value against the business's decimals like typed ones (docs/adr/0058)."""
    product = get_product(products, product_id)
    shown = money_format.current()
    entry = PriceEntry.of(
        effective_from,
        _whole_amount(Decimal(list_price), shown),
        None if bulk_price is None else _whole_amount(Decimal(bulk_price), shown),
        bulk_minimum,
        vip_price=None if vip_price is None else _whole_amount(Decimal(vip_price), shown),
    )
    return _record(products, transaction, product, entry)


def _record(
    products: Products, transaction: Transaction, product: Product, entry: PriceEntry
) -> PriceEntry:
    product.record_price(entry)
    try:
        stored = products.save(product)
    except ReferenceRefused:
        transaction.rollback()
        # Gone or archived is the variety's own refusal (`get_variety` raises it for a
        # missing one); a variety still live and present re-raises the signal as it came.
        product_id = product.id
        assert product_id is not None
        if get_product(products, product_id).is_archived:
            raise ProductArchived(product_id) from None
        raise
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
