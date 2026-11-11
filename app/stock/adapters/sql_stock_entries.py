from collections.abc import Collection

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import (
    domain_amount,
    flush_or_refuse,
    money_of_domain,
    money_scale_factor,
    money_stored_value,
    scaled,
)
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
        factor = money_scale_factor(self._session, self._business_id)
        found = self._session.execute(
            select(StockEntryRow, scaled(StockEntryRow.total_cost, factor)).where(
                StockEntryRow.id == entry_id, StockEntryRow.business_id == self._business_id
            )
        ).first()
        return None if found is None else _entry(found[0], self._units(found[1]))

    def add(self, entry: StockEntry) -> StockEntry:
        row = StockEntryRow(
            business_id=self._business_id,
            entered_on=entry.entry_date,
            variety_id=entry.variety_id,
            origin=entry.origin.value,
            grams_hundredths=entry.quantity.hundredths,
            total_cost=self._stored(entry.total_cost),
            note=entry.note,
            recorded_at=entry.recorded_at,
        )
        self._session.add(row)
        flush_or_refuse(self._session)
        return _entry(row, entry.total_cost)

    def save(self, entry: StockEntry) -> StockEntry:
        assert entry.id is not None, "save takes an entry that was added"
        row = self._row(entry.id)
        assert row is not None, "save takes an entry of this business"
        row.entered_on = entry.entry_date
        row.variety_id = entry.variety_id
        row.origin = entry.origin.value
        row.grams_hundredths = entry.quantity.hundredths
        row.total_cost = self._stored(entry.total_cost)
        row.note = entry.note
        flush_or_refuse(self._session)
        return _entry(row, entry.total_cost)

    def remove(self, entry_id: int) -> None:
        row = self._row(entry_id)
        assert row is not None, "remove takes an entry of this business"
        self._session.delete(row)
        self._session.flush()

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[StockEntry]:
        factor = money_scale_factor(self._session, self._business_id)
        statement = select(StockEntryRow, scaled(StockEntryRow.total_cost, factor)).where(
            StockEntryRow.business_id == self._business_id
        )
        if variety_ids is not None:
            statement = statement.where(StockEntryRow.variety_id.in_(variety_ids))
        return [
            _entry(row, self._units(hundredths))
            for row, hundredths in self._session.execute(statement)
        ]

    def _units(self, hundredths: int | None) -> int | None:
        """A read amount as the domain's int, in the unit of the business's decimals."""
        return (
            None
            if hundredths is None
            else domain_amount(self._session, self._business_id, hundredths)
        )

    def _stored(self, units: int | None) -> int | None:
        """A domain cost as the integer this business's column holds."""
        if units is None:
            return None
        return money_stored_value(
            self._session,
            self._business_id,
            money_of_domain(self._session, self._business_id, units),
        )

    def _row(self, entry_id: int) -> StockEntryRow | None:
        statement = select(StockEntryRow).where(
            StockEntryRow.id == entry_id, StockEntryRow.business_id == self._business_id
        )
        return self._session.scalar(statement)


def _entry(row: StockEntryRow, total_cost: int | None) -> StockEntry:
    return StockEntry(
        entry_date=row.entered_on,
        variety_id=row.variety_id,
        origin=Origin(row.origin),
        quantity=Quantity(row.grams_hundredths),
        total_cost=total_cost,
        note=row.note,
        recorded_at=row.recorded_at,
        id=row.id,
    )
