"""`GET /stock`'s use case: a business's total grams, every variety's own stock level
and its entries (CONTEXT.md: Stock, Stock status, Days left; ADR-0009). Computed only
through `stock_level` over `business_history` (stock-application) — never a SQL aggregate.
`business_history` hands back the stock entry rows it read, so the entries list reuses
them and `GET /stock` reads `stock_entry` once (GH-125).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.shared.quantity import Quantity
from app.stock.application.history import business_history, history
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
    total: Quantity
    varieties: list[VarietyStock]
    entries: list[StockEntry]


def read_stock(
    entries: StockEntries,
    draws: Draws,
    withdrawals: WithdrawalDraws,
    catalog: VarietyCatalog,
    thresholds: Thresholds,
    today: date,
    *,
    archived: bool = False,
) -> StockView:
    business = business_history(entries, draws, withdrawals)
    grouped = business.grouped
    threshold_map = thresholds.all()

    def level_of(variety_id: int) -> StockLevel:
        lots, variety_draws = grouped.get(variety_id, ([], []))
        return stock_level(lots, variety_draws, threshold_map.get(variety_id), today)

    # The total counts every variety, archived ones included: their grams are still on
    # hand (docs/adr/0032). The rows are the listed varieties, or the archived ones when
    # asked; rows and total stop sharing a filter.
    levels = {variety_id: level_of(variety_id) for variety_id in grouped}
    total = sum(level.quantity.hundredths for level in levels.values())
    varieties = [
        VarietyStock(
            variety_id,
            levels[variety_id] if variety_id in levels else level_of(variety_id),
            threshold_map.get(variety_id),
        )
        for variety_id in sorted(catalog.archived_ids() if archived else catalog.listed_ids())
    ]

    sorted_entries = sorted(
        business.entries,
        key=lambda entry: (entry.entry_date, entry.recorded_at, entry.id),
        reverse=True,
    )
    return StockView(Quantity(total), varieties, sorted_entries)


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
