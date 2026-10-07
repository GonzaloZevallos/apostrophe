from datetime import date, datetime

from app.shared.grams import Grams
from app.shared.transaction import Transaction
from app.stock.application.errors import VarietyArchived, VarietyNotFound
from app.stock.application.ports import StockEntries, VarietyCatalog
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
    if not keeps and not catalog.usable(variety_id):
        raise VarietyArchived()


def record_entry(
    entries: StockEntries,
    catalog: VarietyCatalog,
    transaction: Transaction,
    *,
    entry_date: date,
    variety_id: int,
    origin: Origin,
    grams: Grams,
    total_cost: int | None,
    note: str | None,
    today: date,
    recorded_at: datetime,
) -> StockEntry:
    """Checks run in this order: the variety (404), then the domain rules (422), so a
    foreign or unknown variety never reaches the grams, cost or date rules."""
    _check_variety(catalog, variety_id)
    entry = StockEntry.of(
        entry_date, variety_id, origin, grams, total_cost, note, today, recorded_at
    )
    stored = entries.add(entry)
    transaction.commit()
    return stored


def edit_entry(
    entries: StockEntries,
    catalog: VarietyCatalog,
    transaction: Transaction,
    entry_id: int,
    *,
    entry_date: date,
    variety_id: int,
    origin: Origin,
    grams: Grams,
    total_cost: int | None,
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
        grams,
        total_cost,
        note,
        today,
        existing.recorded_at,
        existing.id,
    )
    stored = entries.save(updated)
    transaction.commit()
    return stored


def delete_entry(entries: StockEntries, transaction: Transaction, entry_id: int) -> None:
    """A hard delete, never refused because the entry's grams were already drawn into
    (ADR-0009)."""
    entry = get_entry(entries, entry_id)
    assert entry.id is not None
    entries.remove(entry.id)
    transaction.commit()
