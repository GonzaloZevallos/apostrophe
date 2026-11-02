"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets its
`money_format` row, `"$"`, 0 decimals, scale 0, inside the same transaction that opens
it. Scale 0 for every business until the part that routes every amount statement through
`app/db.py`'s money helper moves new businesses to scale 2 (docs/adr/0058). Accounts never
imports this module; `app/main.py` wires it into `CompositeOpening`.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.money_format.adapters.tables import MoneyFormatRow
from app.shared.language import BusinessLanguage


class MoneyFormatOpening:
    def __init__(self, session: Session) -> None:
        self._session = session

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        self._session.add(MoneyFormatRow(business_id=business_id, symbol="$", decimals=0, scale=0))
