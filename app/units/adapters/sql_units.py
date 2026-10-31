from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import flush_or_refuse
from app.shared.names import name_key
from app.shared.reference import ReferenceRefused
from app.shared.unit import Unit
from app.units.adapters.tables import UnitRow
from app.units.domain.unit import UnitDraft, UnitInUse, UnitName, UnitNameTaken


class SqlUnits:
    """The `Units` port over SQLAlchemy, for one business. Every statement filters on that
    business; a unit of another business is, from here, a unit that does not exist
    (docs/adr/0004). Writes flush; the use case commits.

    `IntegrityError` is never let through: it would carry SQL, and which constraint fired
    is told apart here by which statement raised it, not by parsing the error text."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def list(self) -> list[Unit]:
        statement = (
            select(UnitRow).where(UnitRow.business_id == self._business_id).order_by(UnitRow.id)
        )
        return [unit_of(row) for row in self._session.scalars(statement)]

    def by_id(self, unit_id: int) -> Unit | None:
        row = self._row(unit_id)
        return None if row is None else unit_of(row)

    def by_name(self, name: UnitName) -> Unit | None:
        statement = select(UnitRow).where(
            UnitRow.business_id == self._business_id, UnitRow.name_key == name.folded
        )
        row = self._session.scalar(statement)
        return None if row is None else unit_of(row)

    def count(self) -> int:
        statement = (
            select(func.count()).select_from(UnitRow).where(UnitRow.business_id == self._business_id)
        )
        return self._session.scalar(statement) or 0

    def add(self, draft: UnitDraft) -> Unit:
        row = UnitRow(
            business_id=self._business_id,
            name=draft.name.value,
            name_key=draft.name.folded,
            label=draft.label.value,
            decimals=draft.decimals,
        )
        self._session.add(row)
        self._flush_naming()
        return unit_of(row)

    def save(self, unit: Unit) -> Unit:
        row = self._row(unit.id)
        assert row is not None, "save takes a unit of this business"
        row.name = unit.name
        row.name_key = name_key(unit.name)
        row.label = unit.label
        row.decimals = unit.decimals
        self._flush_naming()
        return unit_of(row)

    def remove(self, unit_id: int) -> None:
        row = self._row(unit_id)
        assert row is not None, "remove takes a unit of this business"
        self._session.delete(row)
        try:
            flush_or_refuse(self._session)
        except ReferenceRefused:
            raise UnitInUse from None

    def _flush_naming(self) -> None:
        try:
            self._session.flush()
        except IntegrityError:
            raise UnitNameTaken from None

    def _row(self, unit_id: int) -> UnitRow | None:
        statement = select(UnitRow).where(
            UnitRow.id == unit_id, UnitRow.business_id == self._business_id
        )
        return self._session.scalar(statement)


def unit_of(row: UnitRow) -> Unit:
    return Unit(id=row.id, name=row.name, label=row.label, decimals=row.decimals)
