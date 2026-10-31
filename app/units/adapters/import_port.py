"""Implements the import's `UnitsImport` port (`app/spreadsheet_import/application/ports.py`)
for one business: the unit the sheet's products use is found or added, never renamed."""

from sqlalchemy.orm import Session

from app.units.adapters.sql_units import SqlUnits
from app.units.application.manage_units import imported_unit


class UnitsImport:
    def __init__(self, session: Session, business_id: int) -> None:
        self._units = SqlUnits(session, business_id)

    def grams_unit_id(self) -> int:
        return imported_unit(self._units).id
