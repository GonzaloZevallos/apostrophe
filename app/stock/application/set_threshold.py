"""`PUT /stock/products/{product_id}/threshold`'s use case (CONTEXT.md: Low-stock
threshold). The variety is checked through `VarietyCatalog` before any write, the same
404 `variety.not_found` as every other stock use case that takes a `variety_id`. A
threshold finer than the product's unit is refused before any write (`quantity.too_many_decimals`).
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
    UnitsReader,
    VarietyCatalog,
    WithdrawalDraws,
)
from app.stock.application.read_stock import VarietyStock, read_variety_stock
from app.stock.application.unit_check import confirm_admitted, require_admitted
from app.stock.application.variety_use import require_usable
from app.stock.domain.threshold import Threshold


def set_threshold(
    entries: StockEntries,
    draws: Draws,
    withdrawals: WithdrawalDraws,
    thresholds: Thresholds,
    catalog: VarietyCatalog,
    units: UnitsReader,
    transaction: Transaction,
    variety_id: int,
    quantity: Quantity | None,
    today: date,
) -> VarietyStock:
    if not catalog.exists(variety_id):
        raise VarietyNotFound()
    require_usable(catalog, variety_id, keeps=False)
    threshold = None if quantity is None else Threshold.of(quantity)
    checked = [] if quantity is None else [(variety_id, quantity)]
    require_admitted(units, checked)
    if threshold is None:
        thresholds.clear(variety_id)
    else:
        thresholds.set(variety_id, threshold)
    # The unit may have lost decimals since the first read: ask again, before committing.
    confirm_admitted(units, transaction, checked)
    transaction.commit()
    return read_variety_stock(entries, draws, withdrawals, thresholds, variety_id, today)
