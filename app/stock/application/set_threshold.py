"""`PUT /stock/products/{variety_id}/threshold`'s use case (CONTEXT.md: Low-stock
threshold). The variety is checked through `VarietyCatalog` before any write, the same
404 `variety.not_found` as every other stock use case that takes a `variety_id`.
"""

from __future__ import annotations

from datetime import date

from app.shared.quantity import Quantity
from app.shared.transaction import Transaction
from app.stock.application.errors import VarietyNotFound
from app.stock.application.ports import (
    Draws,
    StockEntries,
    Thresholds,
    VarietyCatalog,
    WithdrawalDraws,
)
from app.stock.application.read_stock import VarietyStock, read_variety_stock
from app.stock.application.variety_use import require_usable
from app.stock.domain.threshold import Threshold


def set_threshold(
    entries: StockEntries,
    draws: Draws,
    withdrawals: WithdrawalDraws,
    thresholds: Thresholds,
    catalog: VarietyCatalog,
    transaction: Transaction,
    variety_id: int,
    quantity: Quantity | None,
    today: date,
) -> VarietyStock:
    if not catalog.exists(variety_id):
        raise VarietyNotFound()
    require_usable(catalog, variety_id, keeps=False)
    if quantity is None:
        thresholds.clear(variety_id)
    else:
        thresholds.set(variety_id, Threshold.of(quantity))
    transaction.commit()
    return read_variety_stock(entries, draws, withdrawals, thresholds, variety_id, today)
