from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.shared.grams import Grams
from app.varieties.adapters.tables import PriceEntryRow, VarietyRow
from app.varieties.domain.variety import PriceEntry, Variety, VarietyName


class SqlVarieties:
    """The `Varieties` port over SQLAlchemy, for one business. Every statement filters
    on that business; a variety of another business is, from here, a variety that does
    not exist (docs/adr/0004). Writes flush; the use case commits."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def add(self, variety: Variety) -> Variety:
        row = VarietyRow(
            business_id=self._business_id, name=variety.name.value, name_key=variety.name.key
        )
        row.price_entries = [self._entry_row(e) for e in variety.price_entries]
        self._session.add(row)
        self._session.flush()
        return _variety(row)

    def get(self, variety_id: int) -> Variety | None:
        row = self._row(variety_id)
        return None if row is None else _variety(row)

    def all(self) -> list[Variety]:
        statement = (
            select(VarietyRow)
            .where(VarietyRow.business_id == self._business_id)
            .options(selectinload(VarietyRow.price_entries))
            .order_by(VarietyRow.name_key)
        )
        return [_variety(row) for row in self._session.scalars(statement)]

    def save(self, variety: Variety) -> Variety:
        assert variety.id is not None, "save takes a variety that was added"
        row = self._row(variety.id)
        assert row is not None, "save takes a variety of this business"
        row.name = variety.name.value
        row.name_key = variety.name.key
        kept = {e.id for e in variety.price_entries if e.id is not None}
        row.price_entries = [
            *(r for r in row.price_entries if r.id in kept),
            *(self._entry_row(e) for e in variety.price_entries if e.id is None),
        ]
        self._session.flush()
        return _variety(row)

    def name_taken(self, name: VarietyName, *, other_than: int | None = None) -> bool:
        statement = (
            select(func.count())
            .select_from(VarietyRow)
            .where(VarietyRow.business_id == self._business_id, VarietyRow.name_key == name.key)
        )
        if other_than is not None:
            statement = statement.where(VarietyRow.id != other_than)
        return self._session.scalar(statement) != 0

    def _row(self, variety_id: int) -> VarietyRow | None:
        statement = select(VarietyRow).where(
            VarietyRow.id == variety_id, VarietyRow.business_id == self._business_id
        )
        return self._session.scalar(statement)

    def _entry_row(self, entry: PriceEntry) -> PriceEntryRow:
        return PriceEntryRow(
            business_id=self._business_id,
            effective_from=entry.effective_from,
            list_price=entry.list_price,
            bulk_price=entry.bulk.price if entry.bulk else None,
            bulk_minimum_hundredths=entry.bulk.minimum.hundredths if entry.bulk else None,
        )


def _variety(row: VarietyRow) -> Variety:
    return Variety(
        name=VarietyName(row.name),
        price_entries=tuple(_entry(r) for r in row.price_entries),
        id=row.id,
    )


def _entry(row: PriceEntryRow) -> PriceEntry:
    minimum = row.bulk_minimum_hundredths
    return PriceEntry.of(
        effective_from=row.effective_from,
        list_price=row.list_price,
        bulk_price=row.bulk_price,
        bulk_minimum=None if minimum is None else Grams(minimum),
        id=row.id,
    )
