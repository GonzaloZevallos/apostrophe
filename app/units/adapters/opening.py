"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets its
one default unit inside the same transaction that opens it. Accounts never imports this
module; `app/main.py` is the composition root that wires it in."""

from sqlalchemy.orm import Session

from app.shared.language import BusinessLanguage
from app.units.adapters.sql_units import SqlUnits
from app.units.application.manage_units import open_default_unit


class UnitsOpening:
    def __init__(self, session: Session) -> None:
        self._session = session

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        open_default_unit(SqlUnits(self._session, business_id))
