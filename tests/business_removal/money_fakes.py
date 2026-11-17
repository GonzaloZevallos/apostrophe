"""The money format read the removal use case takes, for the tests that run it over fakes."""

from __future__ import annotations

from app.business_removal.domain.export_document import ExportedMoney
from app.db import MoneyFormatMissing

WHOLE_UNITS = ExportedMoney(scale=0, decimals=0)


class FakeMoneyFormat:
    def __init__(self, money: ExportedMoney = WHOLE_UNITS, *, missing: bool = False) -> None:
        self._money = None if missing else money
        self.read_for: list[int] = []

    def of(self, business_id: int) -> ExportedMoney:
        self.read_for.append(business_id)
        if self._money is None:
            raise MoneyFormatMissing
        return self._money
