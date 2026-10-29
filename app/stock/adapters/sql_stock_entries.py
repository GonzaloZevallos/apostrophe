from collections.abc import Collection

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import flush_or_refuse
from app.shared.quantity import Quantity
from app.stock.adapters.tables import StockEntryRow
from app.stock.domain.entry import Origin, StockEntry


class SqlStockEntries:
    """The `StockEntries` port over SQLAlchemy, for one business. Every statement
    filters on that business; an entry of another business is, from here, an entry
    that does not exist (docs/adr/0004). Writes flush; the use case commits."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def by_id(self, entry_id: int) -> StockEntry | None:
        row = self._row(entry_id)
        return None if row is None else _entry(row)

    def add(self, entry: StockEntry) -> StockEntry:
        row = StockEntryRow(
            business_id=self._business_id,
            entry_date=entry.entry_date,
            variety_id=entry.variety_id,
            origin=entry.origin.value,
            grams_hundredths=entry.quantity.hundredths,
            total_cost=entry.total_cost,
            note=entry.note,
            recorded_at=entry.recorded_at,
        )
        self._session.add(row)
        flush_or_refuse(self._session)
        return _entry(row)

    def save(self, entry: StockEntry) -> StockEntry:
        assert entry.id is not None, "save takes an entry that was added"
        row = self._row(entry.id)
        assert row is not None, "save takes an entry of this business"
        row.entry_date = entry.entry_date
        row.variety_id = entry.variety_id
        row.origin = entry.origin.value
        row.grams_hundredths = entry.quantity.hundredths
        row.total_cost = entry.total_cost
        row.note = entry.note
        flush_or_refuse(self._session)
        return _entry(row)

    def remove(self, entry_id: int) -> None:
        row = self._row(entry_id)
        assert row is not None, "remove takes an entry of this business"
        self._session.delete(row)
        self._session.flush()

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[StockEntry]:
        statement = select(StockEntryRow).where(StockEntryRow.business_id == self._business_id)
        if variety_ids is not None:
            statement = statement.where(StockEntryRow.variety_id.in_(variety_ids))
        return [_entry(row) for row in self._session.scalars(statement)]

    def _row(self, entry_id: int) -> StockEntryRow | None:
        statement = select(StockEntryRow).where(
            StockEntryRow.id == entry_id, StockEntryRow.business_id == self._business_id
        )
        return self._session.scalar(statement)


def _entry(row: StockEntryRow) -> StockEntry:
    return StockEntry(
        entry_date=row.entry_date,
        variety_id=row.variety_id,
        origin=Origin(row.origin),
        quantity=Quantity(row.grams_hundredths),
        total_cost=row.total_cost,
        note=row.note,
        recorded_at=row.recorded_at,
        id=row.id,
    )
