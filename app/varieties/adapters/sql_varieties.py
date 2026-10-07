from sqlalchemy import ColumnElement, delete, exists, select
from sqlalchemy.orm import Session, selectinload

from app.db import flush_or_refuse
from app.sales.adapters.tables import SaleLineRow
from app.shared.grams import Grams
from app.shared.reference import ReferenceRefused
from app.stock.adapters.tables import StockEntryRow, StockWithdrawalLineRow
from app.varieties.adapters.tables import PriceEntryRow, VarietyRow
from app.varieties.domain.variety import NameHolder, PriceEntry, Variety, VarietyName


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

    def listed(self) -> list[Variety]:
        return self._by_name(VarietyRow.archived_at.is_(None))

    def archived(self) -> list[Variety]:
        return self._by_name(VarietyRow.archived_at.is_not(None))

    def _by_name(self, archival: ColumnElement[bool]) -> list[Variety]:
        statement = (
            select(VarietyRow)
            .where(VarietyRow.business_id == self._business_id, archival)
            .options(selectinload(VarietyRow.price_entries))
            .order_by(VarietyRow.name_key)
        )
        return [_variety(row) for row in self._session.scalars(statement)]

    def save(self, variety: Variety) -> Variety:
        assert variety.id is not None, "save takes a variety that was added"
        row = self._row(variety.id)
        if row is None:
            # Deleted by a partner since it was read: the caller asks its own lookup.
            raise ReferenceRefused
        row.name = variety.name.value
        row.name_key = variety.name.key
        row.archived_at = variety.archived_at
        kept = {e.id for e in variety.price_entries if e.id is not None}
        row.price_entries = [
            *(r for r in row.price_entries if r.id in kept),
            *(self._entry_row(e) for e in variety.price_entries if e.id is None),
        ]
        flush_or_refuse(self._session)
        return _variety(row)

    def name_holder(self, name: VarietyName, *, other_than: int | None = None) -> NameHolder | None:
        statement = select(VarietyRow.archived_at).where(
            VarietyRow.business_id == self._business_id, VarietyRow.name_key == name.key
        )
        if other_than is not None:
            statement = statement.where(VarietyRow.id != other_than)
        found = self._session.execute(statement).first()
        if found is None:
            return None
        return NameHolder.LIVE if found.archived_at is None else NameHolder.ARCHIVED

    def has_history(self, variety_id: int) -> bool:
        return bool(self._session.scalar(select(self._history_exists(variety_id))))

    def remove_price_entries(self, variety_id: int) -> None:
        self._session.execute(
            delete(PriceEntryRow).where(
                PriceEntryRow.variety_id == variety_id,
                PriceEntryRow.business_id == self._business_id,
            )
        )
        self._session.expire_all()

    def remove_unused(self, variety_id: int) -> bool:
        """One statement: the history check and the delete cannot be pulled apart by a
        sale, an entry or a withdrawal recorded in between (the foreign keys close the rest)."""
        statement = (
            delete(VarietyRow)
            .where(
                VarietyRow.id == variety_id,
                VarietyRow.business_id == self._business_id,
                ~self._history_exists(variety_id),
            )
            .returning(VarietyRow.id)
        )
        removed = self._session.execute(statement).first()
        self._session.expire_all()
        return removed is not None

    def _history_exists(self, variety_id: int) -> ColumnElement[bool]:
        lines = exists().where(
            SaleLineRow.variety_id == variety_id, SaleLineRow.business_id == self._business_id
        )
        entries = exists().where(
            StockEntryRow.variety_id == variety_id, StockEntryRow.business_id == self._business_id
        )
        withdrawn = exists().where(
            StockWithdrawalLineRow.variety_id == variety_id,
            StockWithdrawalLineRow.business_id == self._business_id,
        )
        return lines | entries | withdrawn

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
            vip_price=entry.vip_price,
        )


def _variety(row: VarietyRow) -> Variety:
    return Variety(
        name=VarietyName(row.name),
        price_entries=tuple(_entry(r) for r in row.price_entries),
        id=row.id,
        archived_at=row.archived_at,
    )


def _entry(row: PriceEntryRow) -> PriceEntry:
    minimum = row.bulk_minimum_hundredths
    return PriceEntry.of(
        effective_from=row.effective_from,
        list_price=row.list_price,
        bulk_price=row.bulk_price,
        bulk_minimum=None if minimum is None else Grams(minimum),
        vip_price=row.vip_price,
        id=row.id,
    )
