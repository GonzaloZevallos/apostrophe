"""Sets a business's money format, its symbol and its decimals, rescaling its stored amounts
once when it first raises the decimals above 0 (docs/adr/0080, amending docs/adr/0058).

This is the one use case that writes a business's money format: nothing else may write
`money_format`. It builds the format first, so a symbol or decimals the rules refuse never
reaches the store. It never reads the stored scale (the adapter's SQL does, in the same
transaction), commits once, and on any failure rolls back, so the change is all or nothing:
a refused lowering leaves the symbol as it was too.
"""

from __future__ import annotations

from typing import Protocol

from app.money_format.domain.change import MoneyFormatChange
from app.shared.money import MoneyFormat
from app.shared.transaction import Transaction


class MoneyFormatWriter(Protocol):
    def apply(self, business_id: int, money_format: MoneyFormat) -> MoneyFormatChange:
        """Raises `RescaleBusy`, `AmountTooLargeToRescale`, `RescaleCheckFailed` or
        `DecimalsBelowRecordedAmounts`; commits nothing."""
        ...


class ApplyMoneyFormat:
    def __init__(self, writer: MoneyFormatWriter, transaction: Transaction) -> None:
        self._writer = writer
        self._transaction = transaction

    def execute(self, business_id: int, symbol: str, decimals: int) -> MoneyFormatChange:
        money_format = MoneyFormat.of(symbol, decimals)
        try:
            change = self._writer.apply(business_id, money_format)
        except BaseException:
            self._transaction.rollback()
            raise
        self._transaction.commit()
        return change
