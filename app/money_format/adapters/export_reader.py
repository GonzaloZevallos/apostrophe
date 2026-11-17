"""Reads the `{scale, decimals}` the business export states beside its tables
(docs/adr/0058). This hexagon is the only one that reads the `money_format` table
(docs/adr/0034); the removal command reaches it through its own `MoneyFormatRead` port."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.business_removal.domain.export_document import ExportedMoney
from app.db import MoneyFormatMissing
from app.money_format.adapters.tables import MoneyFormatRow


class SqlMoneyFormatRead:
    def __init__(self, session: Session) -> None:
        self._session = session

    def of(self, business_id: int) -> ExportedMoney:
        row = self._session.execute(
            select(MoneyFormatRow.scale, MoneyFormatRow.decimals).where(
                MoneyFormatRow.business_id == business_id
            )
        ).one_or_none()
        if row is None:
            raise MoneyFormatMissing
        return ExportedMoney(scale=row.scale, decimals=row.decimals)
