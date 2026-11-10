from datetime import date, datetime
from decimal import Decimal

from app.shared.money import money_within
from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from app.shared.transaction import Transaction
from app.stock.application.errors import VarietyNotFound
from app.stock.application.ports import MoneyFormatReader, StockEntries, VarietyCatalog
from app.stock.application.variety_use import require_usable
from app.stock.domain.entry import Origin, StockEntry
from app.stock.domain.errors import EntryNotFound


def get_entry(entries: StockEntries, entry_id: int) -> StockEntry:
    entry = entries.by_id(entry_id)
    if entry is None:
        raise EntryNotFound(entry_id)
    return entry


def _check_variety(catalog: VarietyCatalog, variety_id: int, *, keeps: bool = False) -> None:
    """The variety is missing (404) or archived (also gone to the caller). An entry edit
    that `keeps` its own variety may stay on it even when it is archived: existing
    records stay workable (ADR-0009); only a new reference needs a usable variety."""
    if not catalog.exists(variety_id):
        raise VarietyNotFound()
    require_usable(catalog, variety_id, keeps=keeps)


def _whole_cost(money_format: MoneyFormatReader, total_cost: Decimal | None) -> int | None:
    """A request's cost as a domain amount, checked by value against the business's own
    decimals (docs/adr/0058); `None` stays `None`."""
    if total_cost is None:
        return None
    return money_within(total_cost, money_format.current()).whole_units()


def record_entry(
    entries: StockEntries,
    catalog: VarietyCatalog,
    money_format: MoneyFormatReader,
    transaction: Transaction,
    *,
    entry_date: date,
    variety_id: int,
    origin: Origin,
    quantity: Quantity,
    total_cost: Decimal | None,
    note: str | None,
    today: date,
    recorded_at: datetime,
) -> StockEntry:
    """Checks run in this order: the variety (404), then the domain rules (422), so a
    foreign or unknown variety never reaches the grams, cost or date rules."""
    _check_variety(catalog, variety_id)
    entry = StockEntry.of(
        entry_date,
        variety_id,
        origin,
        quantity,
        _whole_cost(money_format, total_cost),
        note,
        today,
        recorded_at,
    )
    try:
        stored = entries.add(entry)
    except ReferenceRefused:
        transaction.rollback()
        _check_variety(catalog, variety_id)
        raise
    transaction.commit()
    return stored


def edit_entry(
    entries: StockEntries,
    catalog: VarietyCatalog,
    money_format: MoneyFormatReader,
    transaction: Transaction,
    entry_id: int,
    *,
    entry_date: date,
    variety_id: int,
    origin: Origin,
    quantity: Quantity,
    total_cost: Decimal | None,
    note: str | None,
    today: date,
) -> StockEntry:
    """Checks run in this order: the entry (404), then the variety (404, or archived),
    then the domain rules (422). `recorded_at` carries through from the stored entry: an edit
    never changes it, whatever the entry's grams were already drawn into (ADR-0009)."""
    existing = get_entry(entries, entry_id)
    _check_variety(catalog, variety_id, keeps=variety_id == existing.variety_id)
    updated = StockEntry.of(
        entry_date,
        variety_id,
        origin,
        quantity,
        _whole_cost(money_format, total_cost),
        note,
        today,
        existing.recorded_at,
        existing.id,
    )
    try:
        stored = entries.save(updated)
    except ReferenceRefused:
        transaction.rollback()
        _check_variety(catalog, variety_id, keeps=variety_id == existing.variety_id)
        raise
    transaction.commit()
    return stored


def delete_entry(entries: StockEntries, transaction: Transaction, entry_id: int) -> None:
    """A hard delete, never refused because the entry's grams were already drawn into
    (ADR-0009)."""
    entry = get_entry(entries, entry_id)
    assert entry.id is not None
    entries.remove(entry.id)
    transaction.commit()
