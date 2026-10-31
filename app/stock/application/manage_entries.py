from datetime import date, datetime

from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from app.shared.transaction import Transaction
from app.stock.application.errors import VarietyNotFound
from app.stock.application.ports import StockEntries, UnitsReader, VarietyCatalog
from app.stock.application.unit_check import confirm_admitted, require_admitted
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


def record_entry(
    entries: StockEntries,
    catalog: VarietyCatalog,
    units: UnitsReader,
    transaction: Transaction,
    *,
    entry_date: date,
    variety_id: int,
    origin: Origin,
    quantity: Quantity,
    total_cost: int | None,
    note: str | None,
    today: date,
    recorded_at: datetime,
) -> StockEntry:
    """Checks run in this order: the variety (404), then the domain rules (422), then the
    product's unit (422, `quantity.too_many_decimals`), so a foreign or unknown variety
    never reaches the grams, cost or date rules. The unit is read again after the write
    and before the commit: a unit that lost decimals in between undoes the entry."""
    _check_variety(catalog, variety_id)
    entry = StockEntry.of(
        entry_date, variety_id, origin, quantity, total_cost, note, today, recorded_at
    )
    checked = [(variety_id, quantity)]
    require_admitted(units, checked)
    try:
        stored = entries.add(entry)
    except ReferenceRefused:
        transaction.rollback()
        _check_variety(catalog, variety_id)
        raise
    confirm_admitted(units, transaction, checked)
    transaction.commit()
    return stored


def edit_entry(
    entries: StockEntries,
    catalog: VarietyCatalog,
    units: UnitsReader,
    transaction: Transaction,
    entry_id: int,
    *,
    entry_date: date,
    variety_id: int,
    origin: Origin,
    quantity: Quantity,
    total_cost: int | None,
    note: str | None,
    today: date,
) -> StockEntry:
    """Checks run in this order: the entry (404), then the variety (404, or archived),
    then the domain rules (422). `recorded_at` carries through from the stored entry: an edit
    never changes it, whatever the entry's grams were already drawn into (ADR-0009).
    The unit check runs only on a quantity the edit changes or moves to another product:
    an edit of the date, cost, origin or note never refuses a quantity it holds."""
    existing = get_entry(entries, entry_id)
    _check_variety(catalog, variety_id, keeps=variety_id == existing.variety_id)
    updated = StockEntry.of(
        entry_date,
        variety_id,
        origin,
        quantity,
        total_cost,
        note,
        today,
        existing.recorded_at,
        existing.id,
    )
    changed = quantity != existing.quantity or variety_id != existing.variety_id
    checked = [(variety_id, quantity)] if changed else []
    require_admitted(units, checked)
    try:
        stored = entries.save(updated)
    except ReferenceRefused:
        transaction.rollback()
        _check_variety(catalog, variety_id, keeps=variety_id == existing.variety_id)
        raise
    confirm_admitted(units, transaction, checked)
    transaction.commit()
    return stored


def delete_entry(entries: StockEntries, transaction: Transaction, entry_id: int) -> None:
    """A hard delete, never refused because the entry's grams were already drawn into
    (ADR-0009)."""
    entry = get_entry(entries, entry_id)
    assert entry.id is not None
    entries.remove(entry.id)
    transaction.commit()
