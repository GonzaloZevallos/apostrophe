"""Sets how many decimals a business shows, rescaling its stored amounts once when it
first raises them above 0 (docs/adr/0080, amending docs/adr/0058).

This is the one use case that writes a business's decimals: nothing else may write
`money_format`. It never reads the stored scale (the adapter's SQL does, in the same
transaction), commits once, and on any failure rolls back, so the change is all or nothing.
"""

from __future__ import annotations

from typing import Protocol

from app.shared.money import checked_decimals
from app.shared.transaction import Transaction


class MoneyFormatWriter(Protocol):
    def apply_decimals(self, business_id: int, decimals: int) -> None:
        """Raises `RescaleBusy`, `AmountTooLargeToRescale`, `RescaleCheckFailed` or
        `DecimalsBelowRecordedAmounts`; commits nothing."""
        ...


class ApplyDecimals:
    def __init__(self, writer: MoneyFormatWriter, transaction: Transaction) -> None:
        self._writer = writer
        self._transaction = transaction

    def execute(self, business_id: int, decimals: int) -> None:
        shown = checked_decimals(decimals)
        try:
            self._writer.apply_decimals(business_id, shown)
        except BaseException:
            self._transaction.rollback()
            raise
        self._transaction.commit()
