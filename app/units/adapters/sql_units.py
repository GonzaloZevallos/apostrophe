from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.unit import Unit
from app.units.adapters.tables import UnitRow
from app.units.domain.unit import UnitDraft, UnitName


class SqlUnits:
    """The `Units` port over SQLAlchemy, for one business. Every statement filters on that
    business; a unit of another business is, from here, a unit that does not exist
    (docs/adr/0004). Writes flush; the use case commits."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def add(self, draft: UnitDraft) -> Unit:
        row = UnitRow(
            business_id=self._business_id,
            name=draft.name.value,
            name_key=draft.name.folded,
            label=draft.label.value,
            decimals=draft.decimals,
        )
        self._session.add(row)
        self._session.flush()
        return unit_of(row)

    def by_name(self, name: UnitName) -> Unit | None:
        statement = select(UnitRow).where(
            UnitRow.business_id == self._business_id, UnitRow.name_key == name.folded
        )
        row = self._session.scalar(statement)
        return None if row is None else unit_of(row)


def unit_of(row: UnitRow) -> Unit:
    return Unit(id=row.id, name=row.name, label=row.label, decimals=row.decimals)
