"""Reads how one business shows money: its symbol and decimals, never the scale it stores
amounts at (docs/adr/0058). Each use case that needs the format declares its own
`current() -> MoneyFormat` protocol (docs/adr/0055) and this class satisfies it."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import MoneyFormatMissing
from app.money_format.adapters.tables import MoneyFormatRow
from app.shared.money import MoneyFormat


class SqlMoneyFormat:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def current(self) -> MoneyFormat:
        row = self._session.execute(
            select(MoneyFormatRow.symbol, MoneyFormatRow.decimals).where(
                MoneyFormatRow.business_id == self._business_id
            )
        ).one_or_none()
        if row is None:
            raise MoneyFormatMissing
        return MoneyFormat(symbol=row.symbol, decimals=row.decimals)
