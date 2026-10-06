"""`GET /stock`'s use case: a business's total grams, every variety's own stock level
and its entries (CONTEXT.md: Stock, Stock status, Days left; ADR-0009). Computed only
through `stock_level` over `history` (stock-application) — never a SQL aggregate.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.shared.grams import Grams
from app.stock.application.history import history
from app.stock.application.ports import (
    Draws,
    StockEntries,
    Thresholds,
    VarietyCatalog,
    WithdrawalDraws,
)
from app.stock.domain.entry import StockEntry
from app.stock.domain.stock_level import StockLevel, stock_level
from app.stock.domain.threshold import Threshold


@dataclass(frozen=True)
class VarietyStock:
    variety_id: int
    level: StockLevel
    threshold: Threshold | None


@dataclass(frozen=True)
class StockView:
    total: Grams
    varieties: list[VarietyStock]
    entries: list[StockEntry]


def read_stock(
    entries: StockEntries,
    draws: Draws,
    withdrawals: WithdrawalDraws,
    catalog: VarietyCatalog,
    thresholds: Thresholds,
    today: date,
) -> StockView:
    grouped = history(entries, draws, withdrawals, None)
    threshold_map = thresholds.all()

    varieties: list[VarietyStock] = []
    total = 0
    for variety_id in sorted(catalog.ids()):
        lots, variety_draws = grouped.get(variety_id, ([], []))
        threshold = threshold_map.get(variety_id)
        level = stock_level(lots, variety_draws, threshold, today)
        varieties.append(VarietyStock(variety_id, level, threshold))
        total += level.grams.hundredths

    sorted_entries = sorted(
        entries.for_varieties(None),
        key=lambda entry: (entry.entry_date, entry.recorded_at, entry.id),
        reverse=True,
    )
    return StockView(Grams(total), varieties, sorted_entries)


def read_variety_stock(
    entries: StockEntries,
    draws: Draws,
    withdrawals: WithdrawalDraws,
    thresholds: Thresholds,
    variety_id: int,
    today: date,
) -> VarietyStock:
    """The same computation as `read_stock`, narrowed to one variety: used after
    `set_threshold` writes, so the route can answer that variety's own row without a
    second full sweep."""
    narrowed = {variety_id}
    grouped = history(entries, draws, withdrawals, narrowed)
    lots, variety_draws = grouped.get(variety_id, ([], []))
    threshold = thresholds.get(variety_id)
    level = stock_level(lots, variety_draws, threshold, today)
    return VarietyStock(variety_id, level, threshold)
