"""`PUT /stock/varieties/{variety_id}/threshold`'s use case (CONTEXT.md: Low-stock
threshold). The variety is checked through `VarietyCatalog` before any write, the same
404 `variety.not_found` as every other stock use case that takes a `variety_id`.
"""

from __future__ import annotations

from datetime import date

from app.shared.grams import Grams
from app.shared.transaction import Transaction
from app.stock.application.errors import VarietyArchived, VarietyNotFound
from app.stock.application.ports import Draws, StockEntries, Thresholds, VarietyCatalog
from app.stock.application.read_stock import VarietyStock, read_variety_stock
from app.stock.domain.threshold import Threshold


def set_threshold(
    entries: StockEntries,
    draws: Draws,
    thresholds: Thresholds,
    catalog: VarietyCatalog,
    transaction: Transaction,
    variety_id: int,
    grams: Grams | None,
    today: date,
) -> VarietyStock:
    if not catalog.exists(variety_id):
        raise VarietyNotFound()
    if not catalog.usable(variety_id):
        raise VarietyArchived()
    if grams is None:
        thresholds.clear(variety_id)
    else:
        thresholds.set(variety_id, Threshold.of(grams))
    transaction.commit()
    return read_variety_stock(entries, draws, thresholds, variety_id, today)
