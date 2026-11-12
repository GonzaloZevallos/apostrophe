"""Implements accounts' `BusinessOpening` port (docs/adr/0006): a new business gets its
`money_format` row, `"$"`, 0 decimals, scale 2 (hundredths, docs/adr/0058), inside the
same transaction that opens it. Every amount statement goes through `app/db.py`'s money helper,
so a new business stores its amounts at scale 2 while the existing ones stay at 0; the tests'
`money_scale` fixture passes another scale through `create_app`. Accounts never imports this
module; `app/main.py` wires it into `CompositeOpening`.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.money_format.adapters.tables import MoneyFormatRow
from app.shared.language import BusinessLanguage


class MoneyFormatOpening:
    def __init__(self, session: Session, scale: int = 2) -> None:
        self._session = session
        self._scale = scale

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        self._session.add(
            MoneyFormatRow(business_id=business_id, symbol="$", decimals=0, scale=self._scale)
        )
