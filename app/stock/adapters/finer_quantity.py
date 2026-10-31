"""Stock's clauses for the unit's lowering guard, one per quantity column it records: a stock
entry, a withdrawal line and a threshold whose quantity is not a multiple of the step. Units
declares the clause's shape and never reads these tables; `app/main.py` hands the builders
over (docs/adr/0055)."""

from sqlalchemy import ColumnElement, exists

from app.products.adapters.tables import ProductRow
from app.stock.adapters.tables import StockEntryRow, StockThresholdRow, StockWithdrawalLineRow


def finer_stock_entries(unit_id: int, business_id: int, step: int) -> ColumnElement[bool]:
    return exists().where(
        StockEntryRow.variety_id == ProductRow.id,
        ProductRow.unit_id == unit_id,
        ProductRow.business_id == business_id,
        StockEntryRow.business_id == business_id,
        StockEntryRow.grams_hundredths % step != 0,
    )


def finer_withdrawal_lines(unit_id: int, business_id: int, step: int) -> ColumnElement[bool]:
    return exists().where(
        StockWithdrawalLineRow.variety_id == ProductRow.id,
        ProductRow.unit_id == unit_id,
        ProductRow.business_id == business_id,
        StockWithdrawalLineRow.business_id == business_id,
        StockWithdrawalLineRow.grams_hundredths % step != 0,
    )


def finer_thresholds(unit_id: int, business_id: int, step: int) -> ColumnElement[bool]:
    return exists().where(
        StockThresholdRow.variety_id == ProductRow.id,
        ProductRow.unit_id == unit_id,
        ProductRow.business_id == business_id,
        StockThresholdRow.business_id == business_id,
        StockThresholdRow.threshold_hundredths % step != 0,
    )
